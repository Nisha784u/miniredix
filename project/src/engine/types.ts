export interface StoreEntry {
  value: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number | null;
}

export interface CommandResult {
  success: boolean;
  result: string | null;
  error: string | null;
  executionTimeMs: number;
  command: string;
  timestamp: number;
}

export interface StoreStats {
  totalKeys: number;
  expiringKeys: number;
  commandsExecuted: number;
  commandsSucceeded: number;
  commandsFailed: number;
  uptimeSeconds: number;
  memoryEstimateBytes: number;
  startedAt: number;
}

export type CommandName =
  | 'SET'
  | 'GET'
  | 'DEL'
  | 'EXISTS'
  | 'KEYS'
  | 'FLUSHALL'
  | 'EXPIRE'
  | 'TTL'
  | 'PERSIST'
  | 'TYPE'
  | 'RENAME'
  | 'INFO';

export interface ParsedCommand {
  name: CommandName;
  args: string[];
  raw: string;
}
