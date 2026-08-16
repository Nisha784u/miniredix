import express, { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { MiniRedis } from '../engine/MiniRedis.js';
import { Persistence } from '../engine/Persistence.js';
import { executeCommand } from '../engine/CommandExecutor.js';
import { parseCommand } from '../engine/CommandParser.js';

/**
 * Shared API layer.
 *
 * This module is imported by two entry points:
 *  - src/server/plugin.ts   (Vite dev server middleware, local development)
 *  - api/[...path].ts       (Vercel serverless function, production)
 *
 * Both entry points share this single module instance, so `db` and
 * `commandHistory` below act as one in-memory store per running process.
 *
 * On Vercel, each serverless function invocation may run in a fresh
 * container (cold start), so this state is NOT guaranteed to persist
 * across requests indefinitely — see README "Persistence" section for
 * details. Locally (`npm run dev`), the Node process stays alive for the
 * whole dev session and state is also flushed to disk via the AOF file
 * in `.data/`.
 */

// Vercel sets the VERCEL env var on all serverless functions. Filesystem
// writes there are not persistent (and may not even be writable outside
// /tmp), so we disable AOF persistence in that environment rather than
// pretending to persist data that will vanish on the next cold start.
const isServerless = Boolean(process.env['VERCEL']);

export const db = new MiniRedis();

export let persistence: Persistence | null = null;
if (!isServerless) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const dataDir = path.resolve(__dirname, '../../.data');
  persistence = new Persistence(dataDir);
  persistence.load(db);
  persistence.open();
}

// Command history (in-memory, last 500)
export interface HistoryEntry {
  id: number;
  command: string;
  result: string | null;
  error: string | null;
  success: boolean;
  executionTimeMs: number;
  timestamp: number;
}
const commandHistory: HistoryEntry[] = [];
let historyId = 0;

function pushHistory(entry: Omit<HistoryEntry, 'id'>) {
  commandHistory.unshift({ id: ++historyId, ...entry });
  if (commandHistory.length > 500) commandHistory.length = 500;
}

function isMutating(cmd: string): boolean {
  const name = cmd.trim().split(/\s+/)[0]?.toUpperCase();
  return ['SET', 'DEL', 'FLUSHALL', 'EXPIRE', 'PERSIST', 'RENAME'].includes(name ?? '');
}

function appendToPersistence(command: string): void {
  if (!persistence) return;
  const ts = Date.now();
  let parsed;
  try { parsed = parseCommand(command); } catch { return; }
  const { name, args } = parsed;

  switch (name) {
    case 'SET': {
      const key = args[0] ?? '';
      const value = args[1] ?? '';
      const entry = db.getEntry(key);
      persistence.append({ cmd: 'SET', key, value, expiresAt: entry?.expiresAt ?? null, ts });
      break;
    }
    case 'DEL':
      persistence.append({ cmd: 'DEL', keys: args, ts });
      break;
    case 'FLUSHALL':
      persistence.append({ cmd: 'FLUSHALL', ts });
      break;
    case 'EXPIRE': {
      const key = args[0] ?? '';
      const entry = db.getEntry(key);
      persistence.append({ cmd: 'EXPIRE', key, expiresAt: entry?.expiresAt ?? null, ts });
      break;
    }
    case 'PERSIST':
      persistence.append({ cmd: 'PERSIST', key: args[0] ?? '', ts });
      break;
    case 'RENAME':
      persistence.append({ cmd: 'RENAME', key: args[0] ?? '', newKey: args[1] ?? '', ts });
      break;
  }
}

/** Builds a fresh Express app wired to the shared `db` / `commandHistory` above. */
export function createApiApp() {
  const app = express();
  app.use(express.json({ limit: '16kb' }));

  // Reject malformed JSON with 400 instead of 500
  app.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof SyntaxError && 'status' in err && err.status === 400) {
      res.status(400).json({ success: false, error: 'ERR malformed JSON body' });
      return;
    }
    next(err);
  });

  const limiter = rateLimit({
    windowMs: 60_000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api', limiter);

  // POST /api/command
  app.post('/api/command', (req: Request, res: Response) => {
    const { command } = req.body as { command?: unknown };
    if (typeof command !== 'string' || command.trim().length === 0) {
      res.status(400).json({ success: false, error: 'ERR missing or invalid command field' });
      return;
    }

    const outcome = executeCommand(db, command);

    // Persist mutating commands (no-op when persistence is disabled, e.g. on Vercel)
    if (outcome.success && isMutating(command)) {
      appendToPersistence(command);
    }

    pushHistory({
      command: outcome.command,
      result: outcome.result,
      error: outcome.error,
      success: outcome.success,
      executionTimeMs: outcome.executionTimeMs,
      timestamp: outcome.timestamp,
    });

    res.json({
      success: outcome.success,
      result: outcome.result,
      error: outcome.error,
      executionTimeMs: outcome.executionTimeMs,
      timestamp: outcome.timestamp,
    });
  });

  // GET /api/stats
  app.get('/api/stats', (_req: Request, res: Response) => {
    res.json(db.getStats());
  });

  // GET /api/keys
  app.get('/api/keys', (req: Request, res: Response) => {
    const pattern = typeof req.query['pattern'] === 'string' ? req.query['pattern'] : '*';
    const keys = db.keys(pattern);
    const entries = keys.map((key) => {
      const entry = db.getEntry(key);
      const ttl = db.ttl(key);
      return {
        key,
        value: entry?.value ?? '',
        type: 'string',
        ttl,
        createdAt: entry?.createdAt ?? null,
        updatedAt: entry?.updatedAt ?? null,
        expiresAt: entry?.expiresAt ?? null,
      };
    });
    res.json({ keys: entries, total: entries.length });
  });

  // GET /api/key/:key
  app.get('/api/key/:key', (req: Request, res: Response) => {
    const key = decodeURIComponent(String(req.params['key'] ?? ''));
    const entry = db.getEntry(key);
    if (!entry) {
      res.status(404).json({ error: 'ERR key not found' });
      return;
    }
    res.json({ key, ...entry, ttl: db.ttl(key), type: 'string' });
  });

  // DELETE /api/key/:key
  app.delete('/api/key/:key', (req: Request, res: Response) => {
    const key = decodeURIComponent(String(req.params['key'] ?? ''));
    const deleted = db.del(key);
    if (deleted > 0 && persistence) {
      persistence.append({ cmd: 'DEL', keys: [key], ts: Date.now() });
    }
    res.json({ deleted });
  });

  // GET /api/history
  app.get('/api/history', (_req: Request, res: Response) => {
    res.json({ history: commandHistory.slice(0, 200) });
  });

  // DELETE /api/history
  app.delete('/api/history', (_req: Request, res: Response) => {
    commandHistory.length = 0;
    res.json({ cleared: true });
  });

  // GET /api/health
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      engine: 'MiniRedix',
      version: '1.0.0',
      uptime: db.getStats().uptimeSeconds,
      tcpPort: 6399,
    });
  });

  // POST /api/compact
  app.post('/api/compact', (_req: Request, res: Response) => {
    if (persistence) persistence.compact(db);
    res.json({ ok: true });
  });

  // Error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[API]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
