import { describe, it, expect, beforeEach, vi } from 'vitest';
import { parseCommand } from '../src/engine/CommandParser';
import { MiniRedis } from '../src/engine/MiniRedis';
import { executeCommand } from '../src/engine/CommandExecutor';

describe('CommandParser', () => {
  it('parses SET with key and value', () => {
    const cmd = parseCommand('SET name Nisha');
    expect(cmd.name).toBe('SET');
    expect(cmd.args).toEqual(['name', 'Nisha']);
  });

  it('parses GET', () => {
    const cmd = parseCommand('GET name');
    expect(cmd.name).toBe('GET');
    expect(cmd.args).toEqual(['name']);
  });

  it('is case-insensitive for command name', () => {
    const cmd = parseCommand('set key val');
    expect(cmd.name).toBe('SET');
  });

  it('handles quoted values', () => {
    const cmd = parseCommand('SET key "hello world"');
    expect(cmd.args[1]).toBe('hello world');
  });

  it('handles single-quoted values', () => {
    const cmd = parseCommand("SET key 'foo bar'");
    expect(cmd.args[1]).toBe('foo bar');
  });

  it('throws on unknown command', () => {
    expect(() => parseCommand('INVALIDCMD foo')).toThrow("ERR unknown command 'INVALIDCMD'");
  });

  it('throws on empty command', () => {
    expect(() => parseCommand('')).toThrow('ERR empty command');
    expect(() => parseCommand('   ')).toThrow('ERR empty command');
  });

  it('throws on too few arguments for SET', () => {
    expect(() => parseCommand('SET key')).toThrow("ERR wrong number of arguments for 'SET' command");
  });

  it('throws on too few arguments for GET', () => {
    expect(() => parseCommand('GET')).toThrow("ERR wrong number of arguments for 'GET' command");
  });

  it('throws on too many arguments for GET', () => {
    expect(() => parseCommand('GET a b')).toThrow("ERR wrong number of arguments for 'GET' command");
  });

  it('throws on invalid EXPIRE seconds', () => {
    expect(() => parseCommand('EXPIRE key notanumber')).toThrow('ERR value is not an integer or out of range');
  });

  it('rejects commands longer than 4096 chars', () => {
    expect(() => parseCommand('SET ' + 'x'.repeat(4100))).toThrow('ERR command too long');
  });

  it('parses KEYS with no args (defaults to *)', () => {
    const cmd = parseCommand('KEYS');
    expect(cmd.name).toBe('KEYS');
    expect(cmd.args).toHaveLength(0);
  });

  it('parses FLUSHALL', () => {
    const cmd = parseCommand('FLUSHALL');
    expect(cmd.name).toBe('FLUSHALL');
    expect(cmd.args).toHaveLength(0);
  });

  it('parses DEL with multiple keys', () => {
    const cmd = parseCommand('DEL a b c');
    expect(cmd.args).toEqual(['a', 'b', 'c']);
  });
});

describe('CommandExecutor', () => {
  let db: MiniRedis;

  beforeEach(() => { db = new MiniRedis(); });

  it('executes SET and returns OK', () => {
    const r = executeCommand(db, 'SET k v');
    expect(r.success).toBe(true);
    expect(r.result).toBe('OK');
  });

  it('executes GET on existing key', () => {
    db.set('k', 'hello');
    const r = executeCommand(db, 'GET k');
    expect(r.success).toBe(true);
    expect(r.result).toBe('hello');
  });

  it('executes GET on missing key returns (nil)', () => {
    const r = executeCommand(db, 'GET nope');
    expect(r.result).toBe('(nil)');
  });

  it('executes DEL', () => {
    db.set('k', 'v');
    const r = executeCommand(db, 'DEL k');
    expect(r.success).toBe(true);
    expect(r.result).toBe('(integer) 1');
  });

  it('executes EXISTS', () => {
    db.set('k', 'v');
    const r = executeCommand(db, 'EXISTS k');
    expect(r.result).toBe('(integer) 1');
  });

  it('executes KEYS', () => {
    db.set('a', '1');
    const r = executeCommand(db, 'KEYS *');
    expect(r.success).toBe(true);
    expect(r.result).toContain('"a"');
  });

  it('executes FLUSHALL', () => {
    db.set('k', 'v');
    const r = executeCommand(db, 'FLUSHALL');
    expect(r.success).toBe(true);
    expect(db.keys()).toHaveLength(0);
  });

  it('executes EXPIRE', () => {
    db.set('k', 'v');
    const r = executeCommand(db, 'EXPIRE k 60');
    expect(r.result).toBe('(integer) 1');
  });

  it('executes TTL', () => {
    db.set('k', 'v');
    const r = executeCommand(db, 'TTL k');
    expect(r.result).toBe('(integer) -1');
  });

  it('returns error for invalid command', () => {
    const r = executeCommand(db, 'NOTACOMMAND');
    expect(r.success).toBe(false);
    expect(r.error).toContain('ERR unknown command');
  });

  it('returns error for wrong arity', () => {
    const r = executeCommand(db, 'GET');
    expect(r.success).toBe(false);
    expect(r.error).toContain('ERR wrong number');
  });

  it('includes executionTimeMs', () => {
    const r = executeCommand(db, 'SET k v');
    expect(typeof r.executionTimeMs).toBe('number');
    expect(r.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('executes SET with TTL', () => {
    const r = executeCommand(db, 'SET session abc 120');
    expect(r.success).toBe(true);
    const ttl = db.ttl('session');
    expect(ttl).toBeGreaterThan(118);
    expect(ttl).toBeLessThanOrEqual(120);
  });

  it('executes INFO', () => {
    const r = executeCommand(db, 'INFO');
    expect(r.success).toBe(true);
    expect(r.result).toContain('uptime_in_seconds');
    expect(r.result).toContain('total_keys');
  });

  it('executes PERSIST', () => {
    db.set('k', 'v');
    db.expire('k', 60);
    const r = executeCommand(db, 'PERSIST k');
    expect(r.result).toBe('(integer) 1');
    expect(db.ttl('k')).toBe(-1);
  });

  it('executes TYPE', () => {
    db.set('k', 'v');
    const r = executeCommand(db, 'TYPE k');
    expect(r.result).toBe('string');
  });

  it('executes RENAME', () => {
    db.set('old', 'val');
    const r = executeCommand(db, 'RENAME old new');
    expect(r.success).toBe(true);
    expect(db.get('new')).toBe('val');
    expect(db.get('old')).toBeNull();
  });

  it('expired key not retrievable', () => {
    vi.useFakeTimers();
    db.set('k', 'v');
    db.expire('k', 1);
    vi.advanceTimersByTime(2000);
    const r = executeCommand(db, 'GET k');
    expect(r.result).toBe('(nil)');
    vi.useRealTimers();
  });
});
