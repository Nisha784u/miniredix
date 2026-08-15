import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MiniRedis } from '../src/engine/MiniRedis';
import { Persistence } from '../src/engine/Persistence';
import fs from 'fs';
import path from 'path';
import os from 'os';

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'miniredis-test-'));
  return dir;
}

function cleanup(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe('Persistence', () => {
  let dir: string;
  let db: MiniRedis;
  let persistence: Persistence;

  beforeEach(() => {
    dir = makeTempDir();
    db = new MiniRedis();
    persistence = new Persistence(dir);
  });

  afterEach(() => {
    persistence.close();
    cleanup(dir);
  });

  it('appends and loads SET entries', () => {
    persistence.open();
    persistence.append({ cmd: 'SET', key: 'k', value: 'v', expiresAt: null, ts: Date.now() });
    persistence.close();

    const db2 = new MiniRedis();
    const p2 = new Persistence(dir);
    p2.load(db2);
    expect(db2.get('k')).toBe('v');
    p2.close();
  });

  it('does not restore expired entries', () => {
    persistence.open();
    // Write entry that already expired
    const past = Date.now() - 5000;
    persistence.append({ cmd: 'SET', key: 'k', value: 'v', expiresAt: past, ts: Date.now() - 6000 });
    persistence.close();

    const db2 = new MiniRedis();
    const p2 = new Persistence(dir);
    p2.load(db2);
    expect(db2.get('k')).toBeNull();
    p2.close();
  });

  it('replays DEL after SET', () => {
    persistence.open();
    persistence.append({ cmd: 'SET', key: 'k', value: 'v', expiresAt: null, ts: Date.now() });
    persistence.append({ cmd: 'DEL', keys: ['k'], ts: Date.now() });
    persistence.close();

    const db2 = new MiniRedis();
    const p2 = new Persistence(dir);
    p2.load(db2);
    expect(db2.get('k')).toBeNull();
    p2.close();
  });

  it('replays FLUSHALL', () => {
    persistence.open();
    persistence.append({ cmd: 'SET', key: 'a', value: '1', expiresAt: null, ts: Date.now() });
    persistence.append({ cmd: 'SET', key: 'b', value: '2', expiresAt: null, ts: Date.now() });
    persistence.append({ cmd: 'FLUSHALL', ts: Date.now() });
    persistence.close();

    const db2 = new MiniRedis();
    const p2 = new Persistence(dir);
    p2.load(db2);
    expect(db2.keys()).toHaveLength(0);
    p2.close();
  });

  it('replays PERSIST (removes TTL)', () => {
    persistence.open();
    const future = Date.now() + 60_000;
    persistence.append({ cmd: 'SET', key: 'k', value: 'v', expiresAt: future, ts: Date.now() });
    persistence.append({ cmd: 'PERSIST', key: 'k', ts: Date.now() });
    persistence.close();

    const db2 = new MiniRedis();
    const p2 = new Persistence(dir);
    p2.load(db2);
    expect(db2.ttl('k')).toBe(-1);
    p2.close();
  });

  it('compact writes current state and reloads correctly', () => {
    db.set('a', '1');
    db.set('b', '2');
    db.expire('b', 3600);
    persistence.open();
    persistence.compact(db);

    const db2 = new MiniRedis();
    const p2 = new Persistence(dir);
    p2.load(db2);
    expect(db2.get('a')).toBe('1');
    expect(db2.get('b')).toBe('2');
    expect(db2.ttl('b')).toBeGreaterThan(3590);
    p2.close();
  });

  it('skips malformed AOF lines', () => {
    const aofPath = path.join(dir, 'miniredis.aof');
    fs.writeFileSync(aofPath, 'not json\n{"cmd":"SET","key":"k","value":"v","expiresAt":null,"ts":1}\n');

    const db2 = new MiniRedis();
    const p2 = new Persistence(dir);
    p2.load(db2);
    // The valid line should be processed
    expect(db2.get('k')).toBe('v');
    p2.close();
  });
});
