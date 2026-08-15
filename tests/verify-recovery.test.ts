/**
 * Live AOF recovery demonstration test.
 * Verifies the full persistence lifecycle with a real AOF file on disk.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MiniRedis } from '../src/engine/MiniRedis';
import { Persistence } from '../src/engine/Persistence';
import { executeCommand } from '../src/engine/CommandExecutor';
import { parseCommand } from '../src/engine/CommandParser';
import fs from 'fs';
import path from 'path';
import os from 'os';

const MUTATING = new Set(['SET', 'DEL', 'FLUSHALL', 'EXPIRE', 'PERSIST', 'RENAME']);

describe('Live AOF Recovery Demo', () => {
  let dir: string;

  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aof-demo-')); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('full lifecycle: SET → restart → verify → DEL → restart → verify gone → FLUSHALL → restart → verify empty', () => {
    const aofPath = () => path.join(dir, 'miniredis.aof');

    // Helper: start a fresh server instance
    const start = () => {
      const db = new MiniRedis();
      const p = new Persistence(dir);
      p.load(db);
      p.open();
      return { db, p };
    };

    // Helper: run command + persist if mutating
    const run = (s: { db: MiniRedis; p: Persistence }, cmd: string) => {
      const r = executeCommand(s.db, cmd);
      if (r.success && MUTATING.has(parseCommand(cmd).name)) {
        const parsed = parseCommand(cmd);
        const ts = Date.now();
        if (parsed.name === 'SET') {
          const entry = s.db.getEntry(parsed.args[0]!);
          s.p.append({ cmd: 'SET', key: parsed.args[0]!, value: parsed.args[1]!, expiresAt: entry?.expiresAt ?? null, ts });
        } else if (parsed.name === 'DEL') {
          s.p.append({ cmd: 'DEL', keys: parsed.args, ts });
        } else if (parsed.name === 'FLUSHALL') {
          s.p.append({ cmd: 'FLUSHALL', ts });
        }
      }
      return r;
    };

    // ===== STEP 1: Start server, SET two keys =====
    let s = start();
    expect(run(s, 'SET persistent_user Nisha').result).toBe('OK');
    expect(run(s, 'SET persistent_project MiniRedis').result).toBe('OK');
    expect(s.db.get('persistent_user')).toBe('Nisha');
    expect(s.db.get('persistent_project')).toBe('MiniRedis');
    s.p.close();

    // Verify AOF file exists on disk
    expect(fs.existsSync(aofPath())).toBe(true);
    const aofContents = fs.readFileSync(aofPath(), 'utf8');
    expect(aofContents).toContain('persistent_user');
    expect(aofContents).toContain('Nisha');
    expect(aofContents).toContain('persistent_project');
    expect(aofContents).toContain('MiniRedis');

    // ===== STEP 2: Restart, verify recovery =====
    s = start();
    expect(s.db.get('persistent_user')).toBe('Nisha');
    expect(s.db.get('persistent_project')).toBe('MiniRedis');

    // ===== STEP 3: DEL one key =====
    expect(run(s, 'DEL persistent_user').result).toBe('(integer) 1');
    expect(s.db.get('persistent_user')).toBeNull();
    s.p.close();

    // ===== STEP 4: Restart, verify deleted key stays deleted =====
    s = start();
    expect(s.db.get('persistent_user')).toBeNull();
    expect(s.db.get('persistent_project')).toBe('MiniRedis');

    // ===== STEP 5: Create keys, FLUSHALL =====
    expect(run(s, 'SET testkey1 value1').result).toBe('OK');
    expect(run(s, 'SET testkey2 value2').result).toBe('OK');
    // persistent_project survived, plus testkey1 and testkey2 = 3
    expect(s.db.keys()).toHaveLength(3);
    expect(run(s, 'FLUSHALL').result).toBe('OK');
    expect(s.db.keys()).toHaveLength(0);
    s.p.close();

    // ===== STEP 6: Restart, verify FLUSHALL persisted =====
    s = start();
    expect(s.db.keys()).toHaveLength(0);
    expect(s.db.get('testkey1')).toBeNull();
    expect(s.db.get('testkey2')).toBeNull();
    expect(s.db.get('persistent_project')).toBeNull();
    s.p.close();
  });
});
