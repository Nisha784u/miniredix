/**
 * End-to-end test that starts the ACTUAL REST API (Express) and TCP server,
 * then makes real HTTP requests and real TCP socket connections against them.
 *
 * No mocks. The same MiniRedis engine instance is shared between REST and TCP,
 * exactly as in the Vite dev plugin (src/server/plugin.ts).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import rateLimit from 'express-rate-limit';
import net from 'net';
import http from 'http';
import { MiniRedis } from '../src/engine/MiniRedis.js';
import { executeCommand } from '../src/engine/CommandExecutor.js';
import { createTcpServer } from '../src/engine/TcpServer.js';
import { parseCommand } from '../src/engine/CommandParser.js';
import { Persistence } from '../src/engine/Persistence.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- Shared engine instance (same pattern as plugin.ts) ----
const db = new MiniRedis();
const dataDir = path.resolve(__dirname, '../.data-e2e');
const persistence = new Persistence(dataDir);
persistence.open();

// ---- Mutating-command detection (same as plugin.ts) ----
function isMutating(cmd: string): boolean {
  const name = cmd.trim().split(/\s+/)[0]?.toUpperCase();
  return ['SET', 'DEL', 'FLUSHALL', 'EXPIRE', 'PERSIST', 'RENAME'].includes(name ?? '');
}

function appendToPersistence(command: string): void {
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

// ---- Build the Express app (mirrors plugin.ts exactly) ----
function buildApp() {
  const app = express();
  app.use(express.json({ limit: '16kb' }));
  const limiter = rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true, legacyHeaders: false });
  app.use('/api', limiter);

  app.post('/api/command', (req, res) => {
    const { command } = req.body as { command?: unknown };
    if (typeof command !== 'string' || command.trim().length === 0) {
      res.status(400).json({ success: false, error: 'ERR missing or invalid command field' });
      return;
    }
    const outcome = executeCommand(db, command);
    if (outcome.success && isMutating(command)) {
      appendToPersistence(command);
    }
    res.json({ success: outcome.success, result: outcome.result, error: outcome.error, executionTimeMs: outcome.executionTimeMs, timestamp: outcome.timestamp });
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', engine: 'MiniRedix', version: '1.0.0', uptime: db.getStats().uptimeSeconds, tcpPort: TCP_PORT });
  });

  app.get('/api/keys', (req, res) => {
    const pattern = typeof req.query['pattern'] === 'string' ? req.query['pattern'] : '*';
    const keys = db.keys(pattern);
    const entries = keys.map((key) => {
      const entry = db.getEntry(key);
      const ttl = db.ttl(key);
      return { key, value: entry?.value ?? '', type: 'string', ttl, createdAt: entry?.createdAt ?? null, updatedAt: entry?.updatedAt ?? null, expiresAt: entry?.expiresAt ?? null };
    });
    res.json({ keys: entries, total: entries.length });
  });

  app.get('/api/key/:key', (req, res) => {
    const key = decodeURIComponent(String(req.params['key'] ?? ''));
    const entry = db.getEntry(key);
    if (!entry) { res.status(404).json({ error: 'ERR key not found' }); return; }
    res.json({ key, ...entry, ttl: db.ttl(key), type: 'string' });
  });

  return app;
}

// ---- HTTP helper ----
function httpRequest(server: http.Server, method: string, urlPath: string, body?: unknown): Promise<{ status: number; json: any }> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as net.AddressInfo;
    const options: http.RequestOptions = {
      hostname: '127.0.0.1',
      port: addr.port,
      path: urlPath,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode ?? 0, json: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode ?? 0, json: { raw: data } }); }
      });
    });
    req.on('error', reject);
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

// ---- TCP helper ----
function tcpCommand(port: number, ...commands: string[]): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    let buffer = '';
    const responses: string[] = [];
    let expected = commands.length;

    client.connect(port, '127.0.0.1', () => {
      for (const cmd of commands) {
        client.write(cmd + '\r\n');
      }
    });

    client.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        // Skip the greeting line
        if (trimmed.startsWith('MiniRedix 1.0.0')) continue;
        if (trimmed === 'Goodbye') continue;
        responses.push(trimmed);
        if (responses.length >= expected) {
          client.end();
        }
      }
    });

    client.on('error', reject);
    client.on('close', () => resolve(responses));
  });
}

// ---- Ports ----
const TCP_PORT = 16501;
let tcpServer: net.Server;
let httpServer: http.Server;

beforeAll(async () => {
  // Start the real TCP server with the shared db instance
  tcpServer = createTcpServer(db, { port: TCP_PORT, host: '127.0.0.1' });

  // Start the real Express HTTP server with the shared db instance
  const app = buildApp();
  httpServer = http.createServer(app);
  await new Promise<void>((resolve) => {
    httpServer.listen(0, '127.0.0.1', resolve);
  });

  // Wait for TCP server to be ready
  if (!tcpServer.listening) {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('TCP server listen timeout')), 5000);
      tcpServer.on('listening', () => { clearTimeout(timeout); resolve(); });
      tcpServer.on('error', (err) => { clearTimeout(timeout); reject(err); });
    });
  }
});

afterAll(() => {
  tcpServer.close();
  httpServer.close();
});

describe('REST API — real HTTP requests', () => {
  it('POST /api/command SET api_user Nisha → success', async () => {
    const res = await httpRequest(httpServer, 'POST', '/api/command', { command: 'SET api_user Nisha' });
    expect(res.status).toBe(200);
    expect(res.json.success).toBe(true);
    expect(res.json.result).toBe('OK');
  });

  it('POST /api/command GET api_user → returns "Nisha"', async () => {
    const res = await httpRequest(httpServer, 'POST', '/api/command', { command: 'GET api_user' });
    expect(res.status).toBe(200);
    expect(res.json.success).toBe(true);
    expect(res.json.result).toBe('Nisha');
  });

  it('EXISTS api_user → (integer) 1', async () => {
    const res = await httpRequest(httpServer, 'POST', '/api/command', { command: 'EXISTS api_user' });
    expect(res.json.success).toBe(true);
    expect(res.json.result).toBe('(integer) 1');
  });

  it('EXPIRE api_user 120 → (integer) 1, then TTL shows remaining time', async () => {
    const res = await httpRequest(httpServer, 'POST', '/api/command', { command: 'EXPIRE api_user 120' });
    expect(res.json.success).toBe(true);
    expect(res.json.result).toBe('(integer) 1');

    const ttlRes = await httpRequest(httpServer, 'POST', '/api/command', { command: 'TTL api_user' });
    expect(ttlRes.json.success).toBe(true);
    const ttlVal = parseInt(ttlRes.json.result.replace('(integer) ', ''));
    expect(ttlVal).toBeGreaterThan(0);
    expect(ttlVal).toBeLessThanOrEqual(120);
  });

  it('KEYS * → includes api_user', async () => {
    const res = await httpRequest(httpServer, 'POST', '/api/command', { command: 'KEYS *' });
    expect(res.json.success).toBe(true);
    expect(res.json.result).toContain('api_user');
  });

  it('DEL api_user → (integer) 1, then GET returns (nil)', async () => {
    const delRes = await httpRequest(httpServer, 'POST', '/api/command', { command: 'DEL api_user' });
    expect(delRes.json.success).toBe(true);
    expect(delRes.json.result).toBe('(integer) 1');

    const getRes = await httpRequest(httpServer, 'POST', '/api/command', { command: 'GET api_user' });
    expect(getRes.json.success).toBe(true);
    expect(getRes.json.result).toBe('(nil)');
  });

  it('invalid command → error', async () => {
    const res = await httpRequest(httpServer, 'POST', '/api/command', { command: 'BOGUS unknown' });
    expect(res.json.success).toBe(false);
    expect(res.json.error).toContain('unknown command');
  });

  it('malformed request (missing command field) → 400', async () => {
    const res = await httpRequest(httpServer, 'POST', '/api/command', { notCommand: true });
    expect(res.status).toBe(400);
    expect(res.json.success).toBe(false);
  });

  it('GET /api/health → status ok', async () => {
    const res = await httpRequest(httpServer, 'GET', '/api/health');
    expect(res.status).toBe(200);
    expect(res.json.status).toBe('ok');
    expect(res.json.engine).toBe('MiniRedix');
  });
});

describe('TCP server — real socket connections', () => {
  it('SET tcp_user Nisha → OK', async () => {
    const responses = await tcpCommand(TCP_PORT, 'SET tcp_user Nisha');
    expect(responses[0]).toBe('OK');
  });

  it('GET tcp_user → Nisha', async () => {
    const responses = await tcpCommand(TCP_PORT, 'GET tcp_user');
    expect(responses[0]).toBe('Nisha');
  });

  it('EXISTS tcp_user → (integer) 1', async () => {
    const responses = await tcpCommand(TCP_PORT, 'EXISTS tcp_user');
    expect(responses[0]).toBe('(integer) 1');
  });

  it('DEL tcp_user → (integer) 1, then GET → (nil)', async () => {
    const responses = await tcpCommand(TCP_PORT, 'DEL tcp_user', 'GET tcp_user');
    expect(responses[0]).toBe('(integer) 1');
    expect(responses[1]).toBe('(nil)');
  });
});

describe('Cross-interface data sharing — same engine instance', () => {
  it('key set via REST is visible via TCP', async () => {
    // Set via REST API
    const restRes = await httpRequest(httpServer, 'POST', '/api/command', { command: 'SET shared_key CrossWorkz' });
    expect(restRes.json.success).toBe(true);

    // Get via TCP
    const tcpResponses = await tcpCommand(TCP_PORT, 'GET shared_key');
    expect(tcpResponses[0]).toBe('CrossWorkz');
  });

  it('key set via TCP is visible via REST API', async () => {
    // Set via TCP
    const tcpResponses = await tcpCommand(TCP_PORT, 'SET tcp_to_rest HelloFromTCP');
    expect(tcpResponses[0]).toBe('OK');

    // Get via REST API
    const restRes = await httpRequest(httpServer, 'POST', '/api/command', { command: 'GET tcp_to_rest' });
    expect(restRes.json.success).toBe(true);
    expect(restRes.json.result).toBe('HelloFromTCP');
  });

  it('DEL via REST removes key that was set via TCP', async () => {
    // Set via TCP
    await tcpCommand(TCP_PORT, 'SET del_cross DeleteMe');
    // Delete via REST
    const delRes = await httpRequest(httpServer, 'POST', '/api/command', { command: 'DEL del_cross' });
    expect(delRes.json.result).toBe('(integer) 1');
    // Confirm gone via TCP
    const tcpResponses = await tcpCommand(TCP_PORT, 'GET del_cross');
    expect(tcpResponses[0]).toBe('(nil)');
  });
});
