import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronRight, Trash2, Play, Info } from 'lucide-react';
import { api, CommandResponse } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { cn } from '@/lib/utils';

interface ConsoleLine {
  id: number;
  type: 'input' | 'output' | 'error' | 'info';
  content: string;
  executionTimeMs?: number;
  timestamp?: number;
}

let lineId = 0;

const COMMAND_HINTS = [
  'SET key value', 'GET key', 'DEL key', 'EXISTS key', 'KEYS *',
  'EXPIRE key 60', 'TTL key', 'PERSIST key', 'FLUSHALL', 'TYPE key',
  'RENAME oldkey newkey', 'INFO',
];

export function Console() {
  const [searchParams] = useSearchParams();
  const [lines, setLines] = useState<ConsoleLine[]>([
    { id: ++lineId, type: 'info', content: 'MiniRedix Console v1.0.0 — type a command and press Enter' },
    { id: ++lineId, type: 'info', content: 'Try: SET greeting "Hello, World!" then GET greeting' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const prefillCmd = searchParams.get('cmd');
  useEffect(() => {
    if (prefillCmd) setInput(prefillCmd);
    inputRef.current?.focus();
  }, [prefillCmd]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  const pushLine = useCallback((line: Omit<ConsoleLine, 'id'>) => {
    setLines(prev => [...prev, { id: ++lineId, ...line }]);
  }, []);

  const handleSuggestionInput = (value: string) => {
    setInput(value);
    const first = value.trim().split(/\s+/)[0]?.toUpperCase() ?? '';
    if (first && value.trim().indexOf(' ') === -1) {
      setSuggestions(COMMAND_HINTS.filter(h => h.startsWith(first)));
    } else {
      setSuggestions([]);
    }
  };

  const run = useCallback(async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    setInput('');
    setSuggestions([]);
    setHistIdx(-1);
    setHistory(prev => [trimmed, ...prev.slice(0, 99)]);
    pushLine({ type: 'input', content: trimmed });
    setLoading(true);

    try {
      const res: CommandResponse = await api.command(trimmed);
      if (res.success) {
        const output = res.result ?? 'OK';
        for (const line of output.split('\n')) {
          pushLine({ type: 'output', content: line, executionTimeMs: res.executionTimeMs, timestamp: res.timestamp });
        }
      } else {
        pushLine({ type: 'error', content: res.error ?? 'ERR unknown error', executionTimeMs: res.executionTimeMs });
      }
    } catch (e) {
      pushLine({ type: 'error', content: e instanceof Error ? e.message : 'Connection error' });
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [pushLine]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { run(input); return; }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(next);
      setInput(history[next] ?? '');
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.max(histIdx - 1, -1);
      setHistIdx(next);
      setInput(next === -1 ? '' : (history[next] ?? ''));
    }
    if (e.key === 'Tab' && suggestions.length > 0) {
      e.preventDefault();
      setInput(suggestions[0] ?? '');
      setSuggestions([]);
    }
  };

  const clearConsole = () => {
    setLines([{ id: ++lineId, type: 'info', content: 'Console cleared.' }]);
  };

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <PageHeader
        title="Command Console"
        subtitle="Execute MiniRedix commands against the live engine"
        actions={
          <Button size="sm" icon={<Trash2 size={13} />} variant="ghost" onClick={clearConsole}>
            Clear
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto px-6 py-4 font-mono text-sm space-y-0.5 min-h-0">
        {lines.map(line => (
          <div key={line.id} className="flex items-start gap-2 leading-6 animate-slide-in">
            {line.type === 'input' && (
              <>
                <ChevronRight size={14} className="text-accent mt-1 shrink-0" />
                <span className="text-text-primary">{line.content}</span>
                {line.executionTimeMs !== undefined && (
                  <span className="text-text-muted text-xs ml-2 mt-1">({line.executionTimeMs}ms)</span>
                )}
              </>
            )}
            {line.type === 'output' && (
              <>
                <span className="w-4 shrink-0" />
                <span className="text-success-text whitespace-pre-wrap break-all">{line.content}</span>
              </>
            )}
            {line.type === 'error' && (
              <>
                <span className="w-4 shrink-0" />
                <span className="text-error-text whitespace-pre-wrap break-all">{line.content}</span>
              </>
            )}
            {line.type === 'info' && (
              <>
                <Info size={13} className="text-info-text mt-1 shrink-0" />
                <span className="text-text-secondary">{line.content}</span>
              </>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-text-muted">
            <span className="w-4" />
            <span className="animate-pulse">executing...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="mx-6 mb-1 flex gap-2 flex-wrap">
          {suggestions.map(s => (
            <button
              key={s}
              className="text-xs font-mono bg-surface-3 text-text-secondary border border-border px-2 py-1 rounded hover:border-accent/30 hover:text-text-primary transition-colors"
              onClick={() => { setInput(s); setSuggestions([]); inputRef.current?.focus(); }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div className="px-6 pb-6 pt-3 border-t border-border bg-surface-1">
        <div className={cn(
          'flex items-center gap-3 bg-surface-0 border rounded-lg px-4 py-3 transition-colors',
          loading ? 'border-border' : 'border-border hover:border-border-strong focus-within:border-accent/40'
        )}>
          <ChevronRight size={16} className="text-accent shrink-0" />
          <input
            ref={inputRef}
            value={input}
            onChange={e => handleSuggestionInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="SET key value  |  GET key  |  KEYS *  ..."
            className="flex-1 bg-transparent font-mono text-sm text-text-primary placeholder:text-text-muted outline-none"
            disabled={loading}
            autoComplete="off"
            spellCheck={false}
          />
          <Button
            size="sm"
            variant="primary"
            icon={<Play size={13} />}
            onClick={() => run(input)}
            loading={loading}
            disabled={!input.trim()}
          >
            Run
          </Button>
        </div>
        <div className="flex gap-3 mt-2 flex-wrap">
          {['SET key value', 'GET key', 'KEYS *', 'INFO', 'FLUSHALL'].map(cmd => (
            <button
              key={cmd}
              onClick={() => run(cmd)}
              className="text-xs font-mono text-text-muted hover:text-text-secondary transition-colors"
            >
              <Badge variant="neutral">{cmd}</Badge>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
