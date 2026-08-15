import { StoreEntry, StoreStats } from './types.js';

export class MiniRedis {
  private store: Map<string, StoreEntry> = new Map();
  private startedAt: number = Date.now();
  private commandsExecuted: number = 0;
  private commandsSucceeded: number = 0;
  private commandsFailed: number = 0;

  // Called by the persistence layer to restore saved state without side effects
  restoreEntry(key: string, entry: StoreEntry): void {
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) return;
    this.store.set(key, entry);
  }

  recordResult(success: boolean): void {
    this.commandsExecuted++;
    if (success) this.commandsSucceeded++;
    else this.commandsFailed++;
  }

  set(key: string, value: string, expiresAt?: number | null): string {
    const now = Date.now();
    const existing = this.store.get(key);
    this.store.set(key, {
      value,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      expiresAt: expiresAt !== undefined ? expiresAt : (existing?.expiresAt ?? null),
    });
    return 'OK';
  }

  get(key: string): string | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (this.isExpired(entry)) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  del(...keys: string[]): number {
    let deleted = 0;
    for (const key of keys) {
      if (this.store.has(key)) {
        this.store.delete(key);
        deleted++;
      }
    }
    return deleted;
  }

  exists(...keys: string[]): number {
    let count = 0;
    for (const key of keys) {
      const entry = this.store.get(key);
      if (entry && !this.isExpired(entry)) count++;
      else if (entry && this.isExpired(entry)) this.store.delete(key);
    }
    return count;
  }

  keys(pattern?: string): string[] {
    const result: string[] = [];
    for (const [key, entry] of this.store.entries()) {
      if (this.isExpired(entry)) {
        this.store.delete(key);
        continue;
      }
      if (!pattern || pattern === '*' || this.matchGlob(key, pattern)) {
        result.push(key);
      }
    }
    return result.sort();
  }

  flushAll(): string {
    this.store.clear();
    return 'OK';
  }

  expire(key: string, seconds: number): number {
    const entry = this.store.get(key);
    if (!entry || this.isExpired(entry)) return 0;
    entry.expiresAt = Date.now() + seconds * 1000;
    entry.updatedAt = Date.now();
    return 1;
  }

  persist(key: string): number {
    const entry = this.store.get(key);
    if (!entry || this.isExpired(entry)) return 0;
    if (entry.expiresAt === null) return 0;
    entry.expiresAt = null;
    entry.updatedAt = Date.now();
    return 1;
  }

  ttl(key: string): number {
    const entry = this.store.get(key);
    if (!entry) return -2;
    if (this.isExpired(entry)) {
      this.store.delete(key);
      return -2;
    }
    if (entry.expiresAt === null) return -1;
    return Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000));
  }

  rename(key: string, newKey: string): string {
    const entry = this.store.get(key);
    if (!entry || this.isExpired(entry)) throw new Error(`ERR no such key`);
    this.store.delete(key);
    this.store.set(newKey, { ...entry, updatedAt: Date.now() });
    return 'OK';
  }

  type(key: string): string {
    const entry = this.store.get(key);
    if (!entry || this.isExpired(entry)) return 'none';
    return 'string';
  }

  getEntry(key: string): StoreEntry | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (this.isExpired(entry)) {
      this.store.delete(key);
      return null;
    }
    return { ...entry };
  }

  getAllEntries(): Map<string, StoreEntry> {
    // Purge expired keys first
    for (const [key, entry] of this.store.entries()) {
      if (this.isExpired(entry)) this.store.delete(key);
    }
    return new Map(this.store);
  }

  getStats(): StoreStats {
    let expiringKeys = 0;
    let memBytes = 0;
    for (const [key, entry] of this.store.entries()) {
      if (this.isExpired(entry)) {
        this.store.delete(key);
        continue;
      }
      if (entry.expiresAt !== null) expiringKeys++;
      memBytes += (key.length + entry.value.length) * 2 + 128;
    }
    return {
      totalKeys: this.store.size,
      expiringKeys,
      commandsExecuted: this.commandsExecuted,
      commandsSucceeded: this.commandsSucceeded,
      commandsFailed: this.commandsFailed,
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      memoryEstimateBytes: memBytes,
      startedAt: this.startedAt,
    };
  }

  private isExpired(entry: StoreEntry): boolean {
    return entry.expiresAt !== null && entry.expiresAt <= Date.now();
  }

  // Simple glob matching: only supports * (wildcard) and ? (single char)
  private matchGlob(str: string, pattern: string): boolean {
    const regex = new RegExp(
      '^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
    );
    return regex.test(str);
  }
}
