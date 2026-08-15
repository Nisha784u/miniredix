import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MiniRedis } from '../src/engine/MiniRedis';

describe('MiniRedis Engine', () => {
  let db: MiniRedis;

  beforeEach(() => {
    db = new MiniRedis();
  });

  // --- SET / GET ---
  describe('SET + GET', () => {
    it('stores and retrieves a value', () => {
      db.set('name', 'Nisha');
      expect(db.get('name')).toBe('Nisha');
    });

    it('returns null for missing keys', () => {
      expect(db.get('missing')).toBeNull();
    });

    it('overwrites existing value', () => {
      db.set('key', 'first');
      db.set('key', 'second');
      expect(db.get('key')).toBe('second');
    });

    it('preserves createdAt when overwriting', () => {
      db.set('k', 'v1');
      const entry1 = db.getEntry('k');
      db.set('k', 'v2');
      const entry2 = db.getEntry('k');
      expect(entry2!.createdAt).toBe(entry1!.createdAt);
    });
  });

  // --- DEL ---
  describe('DEL', () => {
    it('deletes a key', () => {
      db.set('k', 'v');
      expect(db.del('k')).toBe(1);
      expect(db.get('k')).toBeNull();
    });

    it('returns 0 when key does not exist', () => {
      expect(db.del('nope')).toBe(0);
    });

    it('deletes multiple keys', () => {
      db.set('a', '1');
      db.set('b', '2');
      db.set('c', '3');
      expect(db.del('a', 'b', 'missing')).toBe(2);
      expect(db.get('a')).toBeNull();
      expect(db.get('c')).toBe('3');
    });
  });

  // --- EXISTS ---
  describe('EXISTS', () => {
    it('returns 1 for existing key', () => {
      db.set('x', 'val');
      expect(db.exists('x')).toBe(1);
    });

    it('returns 0 for missing key', () => {
      expect(db.exists('nope')).toBe(0);
    });

    it('counts multiple keys', () => {
      db.set('a', '1');
      db.set('b', '2');
      expect(db.exists('a', 'b', 'c')).toBe(2);
    });
  });

  // --- KEYS ---
  describe('KEYS', () => {
    it('returns all keys with *', () => {
      db.set('a', '1');
      db.set('b', '2');
      const k = db.keys('*');
      expect(k).toContain('a');
      expect(k).toContain('b');
    });

    it('returns empty array when store is empty', () => {
      expect(db.keys()).toHaveLength(0);
    });

    it('filters by prefix pattern', () => {
      db.set('user:alice', 'a');
      db.set('user:bob', 'b');
      db.set('session', 's');
      const k = db.keys('user:*');
      expect(k).toContain('user:alice');
      expect(k).toContain('user:bob');
      expect(k).not.toContain('session');
    });
  });

  // --- FLUSHALL ---
  describe('FLUSHALL', () => {
    it('removes all keys', () => {
      db.set('a', '1');
      db.set('b', '2');
      expect(db.flushAll()).toBe('OK');
      expect(db.keys()).toHaveLength(0);
    });
  });

  // --- EXPIRE / TTL ---
  describe('EXPIRE + TTL', () => {
    it('sets a TTL on a key', () => {
      db.set('k', 'v');
      expect(db.expire('k', 60)).toBe(1);
      const ttl = db.ttl('k');
      expect(ttl).toBeGreaterThan(58);
      expect(ttl).toBeLessThanOrEqual(60);
    });

    it('returns 0 expire on missing key', () => {
      expect(db.expire('nope', 60)).toBe(0);
    });

    it('returns -1 TTL for key without expiry', () => {
      db.set('k', 'v');
      expect(db.ttl('k')).toBe(-1);
    });

    it('returns -2 TTL for missing key', () => {
      expect(db.ttl('nope')).toBe(-2);
    });

    it('key becomes unavailable after TTL expires', () => {
      vi.useFakeTimers();
      db.set('k', 'v');
      db.expire('k', 1);
      expect(db.get('k')).toBe('v');
      vi.advanceTimersByTime(1500);
      expect(db.get('k')).toBeNull();
      vi.useRealTimers();
    });

    it('TTL returns -2 after key expires', () => {
      vi.useFakeTimers();
      db.set('k', 'v');
      db.expire('k', 1);
      vi.advanceTimersByTime(2000);
      expect(db.ttl('k')).toBe(-2);
      vi.useRealTimers();
    });
  });

  // --- PERSIST ---
  describe('PERSIST', () => {
    it('removes expiry from a key', () => {
      db.set('k', 'v');
      db.expire('k', 60);
      expect(db.persist('k')).toBe(1);
      expect(db.ttl('k')).toBe(-1);
    });

    it('returns 0 if key has no expiry', () => {
      db.set('k', 'v');
      expect(db.persist('k')).toBe(0);
    });
  });

  // --- RENAME ---
  describe('RENAME', () => {
    it('renames a key', () => {
      db.set('old', 'value');
      db.rename('old', 'new');
      expect(db.get('new')).toBe('value');
      expect(db.get('old')).toBeNull();
    });

    it('throws on missing key', () => {
      expect(() => db.rename('nope', 'other')).toThrow('ERR no such key');
    });
  });

  // --- TYPE ---
  describe('TYPE', () => {
    it('returns string for string keys', () => {
      db.set('k', 'v');
      expect(db.type('k')).toBe('string');
    });

    it('returns none for missing key', () => {
      expect(db.type('nope')).toBe('none');
    });
  });

  // --- STATS ---
  describe('getStats', () => {
    it('returns accurate key count', () => {
      db.set('a', '1');
      db.set('b', '2');
      expect(db.getStats().totalKeys).toBe(2);
    });

    it('counts expiring keys separately', () => {
      db.set('a', '1');
      db.set('b', '2');
      db.expire('b', 60);
      const stats = db.getStats();
      expect(stats.expiringKeys).toBe(1);
    });

    it('tracks command counts', () => {
      db.recordResult(true);
      db.recordResult(true);
      db.recordResult(false);
      const stats = db.getStats();
      expect(stats.commandsExecuted).toBe(3);
      expect(stats.commandsSucceeded).toBe(2);
      expect(stats.commandsFailed).toBe(1);
    });
  });

  // --- Expired key in KEYS ---
  describe('expired key cleanup', () => {
    it('excludes expired keys from KEYS', () => {
      vi.useFakeTimers();
      db.set('live', 'v');
      db.set('dying', 'v');
      db.expire('dying', 1);
      vi.advanceTimersByTime(2000);
      const keys = db.keys();
      expect(keys).toContain('live');
      expect(keys).not.toContain('dying');
      vi.useRealTimers();
    });

    it('excludes expired keys from EXISTS', () => {
      vi.useFakeTimers();
      db.set('k', 'v');
      db.expire('k', 1);
      vi.advanceTimersByTime(2000);
      expect(db.exists('k')).toBe(0);
      vi.useRealTimers();
    });
  });
});
