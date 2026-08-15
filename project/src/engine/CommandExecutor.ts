import { MiniRedis } from './MiniRedis.js';
import { parseCommand } from './CommandParser.js';
import { CommandResult } from './types.js';

export function executeCommand(db: MiniRedis, raw: string): CommandResult {
  const start = performance.now();
  const timestamp = Date.now();

  let result: string | null = null;
  let error: string | null = null;
  let success = false;

  try {
    const cmd = parseCommand(raw);
    const { name, args } = cmd;

    switch (name) {
      case 'SET': {
        // SET key value [EX seconds]
        let expiresAt: number | null | undefined = undefined;
        if (args[2] !== undefined) {
          // Support: SET key value EX seconds (future: PX, EXAT)
          const seconds = Number(args[2]);
          if (!Number.isInteger(seconds) || seconds <= 0) {
            throw new Error('ERR invalid expire time in SET');
          }
          expiresAt = Date.now() + seconds * 1000;
        }
        result = db.set(args[0], args[1], expiresAt);
        break;
      }
      case 'GET': {
        const val = db.get(args[0]);
        result = val !== null ? val : '(nil)';
        break;
      }
      case 'DEL': {
        const n = db.del(...args);
        result = `(integer) ${n}`;
        break;
      }
      case 'EXISTS': {
        const n = db.exists(...args);
        result = `(integer) ${n}`;
        break;
      }
      case 'KEYS': {
        const pattern = args[0] ?? '*';
        const ks = db.keys(pattern);
        if (ks.length === 0) result = '(empty list)';
        else result = ks.map((k, i) => `${i + 1}) "${k}"`).join('\n');
        break;
      }
      case 'FLUSHALL': {
        result = db.flushAll();
        break;
      }
      case 'EXPIRE': {
        const secs = Number(args[1]);
        const n = db.expire(args[0], secs);
        result = `(integer) ${n}`;
        break;
      }
      case 'TTL': {
        const t = db.ttl(args[0]);
        result = `(integer) ${t}`;
        break;
      }
      case 'PERSIST': {
        const n = db.persist(args[0]);
        result = `(integer) ${n}`;
        break;
      }
      case 'TYPE': {
        result = db.type(args[0]);
        break;
      }
      case 'RENAME': {
        result = db.rename(args[0], args[1]);
        break;
      }
      case 'INFO': {
        const stats = db.getStats();
        result = [
          `# Server`,
          `uptime_in_seconds:${stats.uptimeSeconds}`,
          `started_at:${new Date(stats.startedAt).toISOString()}`,
          ``,
          `# Keyspace`,
          `total_keys:${stats.totalKeys}`,
          `expiring_keys:${stats.expiringKeys}`,
          `memory_estimate_bytes:${stats.memoryEstimateBytes}`,
          ``,
          `# Stats`,
          `commands_executed:${stats.commandsExecuted}`,
          `commands_succeeded:${stats.commandsSucceeded}`,
          `commands_failed:${stats.commandsFailed}`,
        ].join('\n');
        break;
      }
    }
    success = true;
  } catch (err) {
    error = err instanceof Error ? err.message : 'ERR unknown error';
    success = false;
  }

  db.recordResult(success);
  const executionTimeMs = parseFloat((performance.now() - start).toFixed(3));

  return { success, result, error, executionTimeMs, command: raw.trim(), timestamp };
}
