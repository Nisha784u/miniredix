/**
 * Append-Only File (AOF) persistence.
 *
 * On every mutating command (SET, DEL, EXPIRE, FLUSHALL, PERSIST, RENAME),
 * a log entry is appended to the AOF file as a JSON line. On startup, the
 * file is replayed to reconstruct the in-memory state.
 *
 * Format: one JSON object per line — { cmd, key, value?, expiresAt?, keys? }
 *
 * Writes are synchronous (fs.appendFileSync) so that data is on disk before
 * the command returns. This guarantees recovery even after an abrupt restart.
 */
import fs from 'fs';
import path from 'path';
import { MiniRedis } from './MiniRedis.js';
import { StoreEntry } from './types.js';

export interface AofEntry {
  cmd: 'SET' | 'DEL' | 'EXPIRE' | 'FLUSHALL' | 'PERSIST' | 'RENAME';
  key?: string;
  value?: string;
  expiresAt?: number | null;
  keys?: string[];
  newKey?: string;
  ts: number;
}

export class Persistence {
  private aofPath: string;
  private enabled: boolean;
  private isOpen: boolean = false;

  constructor(dataDir: string) {
    this.enabled = true;
    try {
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      this.aofPath = path.join(dataDir, 'miniredis.aof');
    } catch {
      this.enabled = false;
      this.aofPath = '';
    }
  }

  open(): void {
    if (!this.enabled) return;
    this.isOpen = true;
  }

  close(): void {
    this.isOpen = false;
  }

  /** Synchronously flush — no-op since append() already writes synchronously */
  flushSync(): void {
    // Writes are already synchronous via appendFileSync; nothing to flush
  }

  append(entry: AofEntry): void {
    if (!this.enabled || !this.isOpen) return;
    try {
      fs.appendFileSync(this.aofPath, JSON.stringify(entry) + '\n', 'utf8');
    } catch {
      // Non-fatal: in-memory state is still correct
    }
  }

  load(db: MiniRedis): void {
    if (!this.enabled || !fs.existsSync(this.aofPath)) return;
    let raw: string;
    try {
      raw = fs.readFileSync(this.aofPath, 'utf8');
    } catch {
      return;
    }

    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const entry: AofEntry = JSON.parse(trimmed);
        this.replayEntry(db, entry);
      } catch {
        // Skip malformed lines
      }
    }
  }

  private replayEntry(db: MiniRedis, entry: AofEntry): void {
    switch (entry.cmd) {
      case 'FLUSHALL':
        db.flushAll();
        break;
      case 'SET':
        if (entry.key !== undefined && entry.value !== undefined) {
          const storeEntry: StoreEntry = {
            value: entry.value,
            createdAt: entry.ts,
            updatedAt: entry.ts,
            expiresAt: entry.expiresAt ?? null,
          };
          db.restoreEntry(entry.key, storeEntry);
        }
        break;
      case 'DEL':
        if (entry.keys) db.del(...entry.keys);
        else if (entry.key) db.del(entry.key);
        break;
      case 'EXPIRE':
        if (entry.key !== undefined && entry.expiresAt !== undefined && entry.expiresAt !== null) {
          const remainingMs = entry.expiresAt - Date.now();
          if (remainingMs > 0) db.expire(entry.key, Math.ceil(remainingMs / 1000));
        }
        break;
      case 'PERSIST':
        if (entry.key !== undefined) db.persist(entry.key);
        break;
      case 'RENAME':
        if (entry.key !== undefined && entry.newKey !== undefined) {
          try { db.rename(entry.key, entry.newKey); } catch { /* key may not exist */ }
        }
        break;
    }
  }

  /** Compact the AOF by rewriting it with current in-memory state */
  compact(db: MiniRedis): void {
    if (!this.enabled) return;
    const entries = db.getAllEntries();
    const lines: string[] = [];
    for (const [key, entry] of entries) {
      if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) continue;
      lines.push(JSON.stringify({
        cmd: 'SET',
        key,
        value: entry.value,
        expiresAt: entry.expiresAt,
        ts: entry.updatedAt,
      } satisfies AofEntry));
    }
    try {
      fs.writeFileSync(this.aofPath + '.tmp', lines.join('\n') + '\n', 'utf8');
      fs.renameSync(this.aofPath + '.tmp', this.aofPath);
    } catch {
      // Non-fatal
    }
  }
}
