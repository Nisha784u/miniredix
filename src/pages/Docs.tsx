import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Play, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { cn } from '@/lib/utils';

interface CommandDoc {
  name: string;
  syntax: string;
  description: string;
  args: { name: string; required: boolean; description: string }[];
  examples: { input: string; output: string }[];
  notes?: string;
}

const COMMANDS: CommandDoc[] = [
  {
    name: 'SET',
    syntax: 'SET key value [seconds]',
    description: 'Set the string value of a key. If the key already exists, its value is overwritten. Existing TTL is preserved unless a new expiry is provided.',
    args: [
      { name: 'key', required: true, description: 'The key to set' },
      { name: 'value', required: true, description: 'The string value to store' },
      { name: 'seconds', required: false, description: 'Optional TTL in seconds' },
    ],
    examples: [
      { input: 'SET name Nisha', output: 'OK' },
      { input: 'SET session abc123 300', output: 'OK' },
    ],
  },
  {
    name: 'GET',
    syntax: 'GET key',
    description: 'Get the value associated with a key. Returns (nil) if the key does not exist or has expired.',
    args: [{ name: 'key', required: true, description: 'The key to look up' }],
    examples: [
      { input: 'GET name', output: 'Nisha' },
      { input: 'GET missing', output: '(nil)' },
    ],
  },
  {
    name: 'DEL',
    syntax: 'DEL key [key ...]',
    description: 'Delete one or more keys. Returns the number of keys that were removed.',
    args: [{ name: 'key', required: true, description: 'One or more keys to delete' }],
    examples: [
      { input: 'DEL name', output: '(integer) 1' },
      { input: 'DEL k1 k2 k3', output: '(integer) 3' },
    ],
  },
  {
    name: 'EXISTS',
    syntax: 'EXISTS key [key ...]',
    description: 'Determine if one or more keys exist. Returns the count of keys that exist.',
    args: [{ name: 'key', required: true, description: 'One or more keys to check' }],
    examples: [
      { input: 'EXISTS name', output: '(integer) 1' },
      { input: 'EXISTS a b c', output: '(integer) 2' },
    ],
  },
  {
    name: 'KEYS',
    syntax: 'KEYS [pattern]',
    description: 'Return all keys matching the given glob-style pattern. Defaults to * (all keys). Supports * (any chars) and ? (single char) wildcards.',
    args: [{ name: 'pattern', required: false, description: 'Glob pattern, e.g. user:*, sess??' }],
    examples: [
      { input: 'KEYS *', output: '1) "name"\n2) "session"' },
      { input: 'KEYS user:*', output: '1) "user:alice"\n2) "user:bob"' },
    ],
  },
  {
    name: 'EXPIRE',
    syntax: 'EXPIRE key seconds',
    description: 'Set a timeout on a key. After the timeout has expired, the key is automatically deleted. Returns 1 if the timeout was set, 0 if the key does not exist.',
    args: [
      { name: 'key', required: true, description: 'The key to expire' },
      { name: 'seconds', required: true, description: 'TTL in seconds (non-negative integer)' },
    ],
    examples: [
      { input: 'EXPIRE session 60', output: '(integer) 1' },
      { input: 'EXPIRE missing 60', output: '(integer) 0' },
    ],
    notes: 'TTL is stored as an absolute timestamp. The key is lazily deleted on access or purged by the background sweeper.',
  },
  {
    name: 'TTL',
    syntax: 'TTL key',
    description: 'Get the remaining time to live of a key in seconds. Returns -1 if the key has no expiry, -2 if the key does not exist or has already expired.',
    args: [{ name: 'key', required: true, description: 'The key to inspect' }],
    examples: [
      { input: 'TTL session', output: '(integer) 58' },
      { input: 'TTL name', output: '(integer) -1' },
      { input: 'TTL missing', output: '(integer) -2' },
    ],
  },
  {
    name: 'PERSIST',
    syntax: 'PERSIST key',
    description: 'Remove the expiration from a key. Returns 1 if the timeout was removed, 0 if the key does not exist or has no expiry.',
    args: [{ name: 'key', required: true, description: 'The key to persist' }],
    examples: [{ input: 'PERSIST session', output: '(integer) 1' }],
  },
  {
    name: 'TYPE',
    syntax: 'TYPE key',
    description: 'Returns the data type of the value stored at a key. MiniRedix currently supports "string". Returns "none" if the key does not exist.',
    args: [{ name: 'key', required: true, description: 'The key to inspect' }],
    examples: [{ input: 'TYPE name', output: 'string' }],
  },
  {
    name: 'RENAME',
    syntax: 'RENAME key newkey',
    description: 'Rename a key. If newkey already exists, it is overwritten. Returns an error if key does not exist.',
    args: [
      { name: 'key', required: true, description: 'The source key' },
      { name: 'newkey', required: true, description: 'The destination key name' },
    ],
    examples: [{ input: 'RENAME name username', output: 'OK' }],
  },
  {
    name: 'FLUSHALL',
    syntax: 'FLUSHALL',
    description: 'Delete all keys in the store. This is a destructive operation.',
    args: [],
    examples: [{ input: 'FLUSHALL', output: 'OK' }],
  },
  {
    name: 'INFO',
    syntax: 'INFO',
    description: 'Return server and stats information including uptime, key count, memory estimate, and command counts.',
    args: [],
    examples: [{ input: 'INFO', output: '# Server\nuptime_in_seconds:120\n...' }],
  },
];

export function Docs() {
  const [selected, setSelected] = useState<CommandDoc>(COMMANDS[0]!);
  const navigate = useNavigate();

  const runInConsole = (cmd: string) => {
    navigate(`/console?cmd=${encodeURIComponent(cmd)}`);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Documentation"
        subtitle="Complete reference for all supported MiniRedix commands"
      />

      <div className="flex h-[calc(100vh-89px)]">
        {/* Command list */}
        <div className="w-52 shrink-0 border-r border-border overflow-y-auto py-3">
          {COMMANDS.map(cmd => (
            <button
              key={cmd.name}
              onClick={() => setSelected(cmd)}
              className={cn(
                'w-full flex items-center gap-2 px-4 py-2 text-left transition-colors',
                selected.name === cmd.name
                  ? 'bg-accent/10 text-accent border-r-2 border-accent'
                  : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary border-r-2 border-transparent'
              )}
            >
              <span className="text-xs font-mono font-semibold">{cmd.name}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <BookOpen size={16} className="text-accent" />
              <h2 className="text-xl font-semibold text-text-primary font-mono">{selected.name}</h2>
            </div>
            <div className="bg-surface-3 border border-border rounded px-4 py-3 font-mono text-sm text-accent">
              {selected.syntax}
            </div>
          </div>

          <p className="text-sm text-text-secondary leading-relaxed">{selected.description}</p>

          {selected.notes && (
            <div className="bg-info-muted border border-info/20 text-info-text text-sm px-4 py-3 rounded">
              {selected.notes}
            </div>
          )}

          {selected.args.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-3 uppercase tracking-wider">Arguments</h3>
              <div className="space-y-2">
                {selected.args.map(arg => (
                  <div key={arg.name} className="flex items-start gap-3 bg-surface-2 border border-border rounded px-3 py-2.5">
                    <code className="text-xs font-mono text-accent shrink-0 mt-0.5">{arg.name}</code>
                    <Badge variant={arg.required ? 'error' : 'neutral'} className="shrink-0 mt-0.5">
                      {arg.required ? 'required' : 'optional'}
                    </Badge>
                    <span className="text-xs text-text-secondary">{arg.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-text-secondary mb-3 uppercase tracking-wider">Examples</h3>
            <div className="space-y-3">
              {selected.examples.map((ex, i) => (
                <div key={i} className="bg-surface-0 border border-border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-surface-2 border-b border-border">
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <ChevronRight size={11} className="text-accent" />
                      <span className="font-mono text-text-primary">{ex.input}</span>
                    </div>
                    <Button size="sm" variant="ghost" icon={<Play size={11} />} onClick={() => runInConsole(ex.input)}>
                      Try it
                    </Button>
                  </div>
                  <pre className="px-3 py-2.5 text-xs font-mono text-success-text whitespace-pre-wrap">
                    {ex.output}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
