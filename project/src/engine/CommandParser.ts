import { ParsedCommand, CommandName } from './types.js';

const VALID_COMMANDS: Set<string> = new Set([
  'SET', 'GET', 'DEL', 'EXISTS', 'KEYS', 'FLUSHALL',
  'EXPIRE', 'TTL', 'PERSIST', 'TYPE', 'RENAME', 'INFO',
]);

const COMMAND_ARITY: Record<string, { min: number; max: number }> = {
  SET:      { min: 2, max: 3 },
  GET:      { min: 1, max: 1 },
  DEL:      { min: 1, max: Infinity },
  EXISTS:   { min: 1, max: Infinity },
  KEYS:     { min: 0, max: 1 },
  FLUSHALL: { min: 0, max: 0 },
  EXPIRE:   { min: 2, max: 2 },
  TTL:      { min: 1, max: 1 },
  PERSIST:  { min: 1, max: 1 },
  TYPE:     { min: 1, max: 1 },
  RENAME:   { min: 2, max: 2 },
  INFO:     { min: 0, max: 0 },
};

export function parseCommand(raw: string): ParsedCommand {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('ERR empty command');
  if (trimmed.length > 4096) throw new Error('ERR command too long');

  const tokens = tokenize(trimmed);
  if (tokens.length === 0) throw new Error('ERR empty command');

  const name = tokens[0].toUpperCase();
  if (!VALID_COMMANDS.has(name)) {
    throw new Error(`ERR unknown command '${tokens[0]}'. Type KEYS for available commands`);
  }

  const args = tokens.slice(1);
  const arity = COMMAND_ARITY[name];
  if (args.length < arity.min) {
    throw new Error(`ERR wrong number of arguments for '${name}' command`);
  }
  if (args.length > arity.max) {
    throw new Error(`ERR wrong number of arguments for '${name}' command`);
  }

  // Type-check EXPIRE seconds argument
  if (name === 'EXPIRE') {
    const secs = Number(args[1]);
    if (!Number.isInteger(secs) || secs < 0) {
      throw new Error('ERR value is not an integer or out of range');
    }
  }

  return { name: name as CommandName, args, raw: trimmed };
}

// Tokenize with support for quoted strings: SET key "hello world"
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < input.length) {
    if (input[i] === ' ' || input[i] === '\t') { i++; continue; }
    if (input[i] === '"' || input[i] === "'") {
      const quote = input[i++];
      let token = '';
      while (i < input.length && input[i] !== quote) {
        if (input[i] === '\\' && i + 1 < input.length) { i++; token += input[i++]; }
        else token += input[i++];
      }
      i++; // closing quote
      tokens.push(token);
    } else {
      let token = '';
      while (i < input.length && input[i] !== ' ' && input[i] !== '\t') token += input[i++];
      tokens.push(token);
    }
  }
  return tokens;
}
