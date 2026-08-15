/**
 * End-to-end persistence recovery test.
 *
 * This test does NOT mock anything — it creates a real MiniRedis instance,
 * a real Persistence layer backed by the filesystem, executes real commands,
 * then tears everything down and creates a FRESH instance that reloads from
 * the AOF file. This simulates a real server restart.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MiniRedis } from '../src/engine/MiniRedis';
import { Persistence } from '../src/engine/Persistence';
import { executeCommand } from '../src/engine/CommandExecutor';
import { parseCommand } from '../src/engine/CommandParser';
import type { AofEntry } from '../src/engine/Persistence';
import fs from 'fs';
import path from 'path';
import os from 'os';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'miniredis-recovery-'));
}

const MUTATING = new Set(['SET', 'DEL', 'FLUSHALL', 'EXPIRE', 'PERSIST', 'RENAME']);

/** Mirrors the server plugin: execute + append to AOF for mutating commands */
function run(db: MiniRedis, persistence: Persistence, cmd: string) {
  const result = executeCommand(db, cmd);
  if (result.success && MUTATING.has(parseCommand(cmd).name)) {
    appendToPersistence(persistence, db, cmd);
  }
  return result;
}

function appendToPersistence(persistence: Persistence, db: MiniRedis, command: string): void {
  const ts = Date.now();
  const parsed = parseCommand(command);
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
      persistence.append({ cmd: 'EXPIRE', key, expiresAt: entry?.expiresAt ?? null, ts } satisfies AofEntry);
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

interface ServerSession {
  db: MiniRedis;
  persistence: Persistence;
}

function startServer(dataDir: string): ServerSession {
  const db = new MiniRedis();
  const persistence = new Persistence(dataDir);
  persistence.load(db);
  persistence.open();
  return { db, persistence };
}

function stopServer(session: ServerSession) {
  session.persistence.flushSync();
  session.persistence.close();
}

/** Convenience: run a command on a session */
function runCmd(session: ServerSession, cmd: string) {
  return run(session.db, session.persistence, cmd);
}

describe('Persistence Recovery (end-to-end restart)', () => {
  let dir: string;

  beforeEach(() => { dir = makeTempDir(); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('recovers SET values after full restart', () => {
    // --- Session 1: write data ---
    const s1 = startServer(dir);
    const r1 = runCmd(s1, 'SET persistent_user Nisha');
    expect(r1.success).toBe(true);
    expect(r1.result).toBe('OK');
    const r2 = runCmd(s1, 'SET persistent_project MiniRedis');
    expect(r2.success).toBe(true);
    // verify in-memory before restart
    expect(s1.db.get('persistent_user')).toBe('Nisha');
    expect(s1.db.get('persistent_project')).toBe('MiniRedis');
    stopServer(s1);

    // --- Session 2: fresh instance, reload from AOF ---
    const s2 = startServer(dir);
    expect(s2.db.get('persistent_user')).toBe('Nisha');
    expect(s2.db.get('persistent_project')).toBe('MiniRedis');
    stopServer(s2);
  });

  it('recovers values set with quoted strings (parser-based persistence)', () => {
    const s1 = startServer(dir);
    runCmd(s1, 'SET greeting "Hello World"');
    expect(s1.db.get('greeting')).toBe('Hello World');
    stopServer(s1);

    const s2 = startServer(dir);
    expect(s2.db.get('greeting')).toBe('Hello World');
    stopServer(s2);
  });

  it('deleted key does NOT come back after restart', () => {
    // --- Session 1: create then delete ---
    const s1 = startServer(dir);
    runCmd(s1, 'SET persistent_user Nisha');
    runCmd(s1, 'SET persistent_project MiniRedis');
    const delRes = runCmd(s1, 'DEL persistent_user');
    expect(delRes.result).toBe('(integer) 1');
    expect(s1.db.get('persistent_user')).toBeNull();
    expect(s1.db.get('persistent_project')).toBe('MiniRedis');
    stopServer(s1);

    // --- Session 2: fresh instance ---
    const s2 = startServer(dir);
    expect(s2.db.get('persistent_user')).toBeNull();
    expect(s2.db.get('persistent_project')).toBe('MiniRedis');
    stopServer(s2);
  });

  it('FLUSHALL persists — keys remain deleted after restart', () => {
    // --- Session 1: create keys then flush ---
    const s1 = startServer(dir);
    runCmd(s1, 'SET testkey1 value1');
    runCmd(s1, 'SET testkey2 value2');
    expect(s1.db.keys()).toHaveLength(2);
    const flushRes = runCmd(s1, 'FLUSHALL');
    expect(flushRes.result).toBe('OK');
    expect(s1.db.keys()).toHaveLength(0);
    stopServer(s1);

    // --- Session 2: fresh instance ---
    const s2 = startServer(dir);
    expect(s2.db.keys()).toHaveLength(0);
    expect(s2.db.get('testkey1')).toBeNull();
    expect(s2.db.get('testkey2')).toBeNull();
    stopServer(s2);
  });

  it('AOF file actually exists on disk and contains entries', () => {
    const s1 = startServer(dir);
    runCmd(s1, 'SET disk_check yes');
    stopServer(s1);

    const aofPath = path.join(dir, 'miniredis.aof');
    expect(fs.existsSync(aofPath)).toBe(true);
    const contents = fs.readFileSync(aofPath, 'utf8');
    expect(contents).toContain('disk_check');
    expect(contents).toContain('SET');
  });

  it('multiple restarts chain correctly (SET then UPDATE then restart)', () => {
    // Session 1
    const s1 = startServer(dir);
    runCmd(s1, 'SET counter one');
    stopServer(s1);

    // Session 2: update
    const s2 = startServer(dir);
    expect(s2.db.get('counter')).toBe('one');
    runCmd(s2, 'SET counter two');
    stopServer(s2);

    // Session 3: verify update survived
    const s3 = startServer(dir);
    expect(s3.db.get('counter')).toBe('two');
    stopServer(s3);
  });
});
