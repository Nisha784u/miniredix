import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Trash2, Play, Clock } from 'lucide-react';
import { api, HistoryEntry } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { cn } from '@/lib/utils';

export function History() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.history();
      setHistory(res.history);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, []);

  const clearAll = async () => {
    await api.clearHistory();
    setHistory([]);
  };

  useEffect(() => { load(); }, [load]);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Command History"
        subtitle={`${history.length} command${history.length !== 1 ? 's' : ''} executed`}
        actions={
          <div className="flex gap-2">
            <Button size="sm" icon={<RefreshCw size={13} />} variant="ghost" onClick={load} loading={loading && history.length === 0}>
              Refresh
            </Button>
            {history.length > 0 && (
              <Button size="sm" icon={<Trash2 size={13} />} variant="danger" onClick={clearAll}>
                Clear All
              </Button>
            )}
          </div>
        }
      />

      <div className="p-6">
        {error && (
          <div className="bg-error-muted border border-error/20 text-error-text text-sm px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {history.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-muted">
            <Clock size={32} className="mb-3 opacity-30" />
            <p className="text-sm">No commands yet</p>
            <p className="text-xs mt-1">Head to the console to execute your first command</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {history.map(entry => (
              <div
                key={entry.id}
                className={cn(
                  'bg-surface-2 border rounded-lg px-4 py-3 flex items-start gap-3',
                  entry.success ? 'border-border' : 'border-error/20'
                )}
              >
                <Badge variant={entry.success ? 'success' : 'error'} className="shrink-0 mt-0.5">
                  {entry.success ? 'OK' : 'ERR'}
                </Badge>

                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm text-text-primary">{entry.command}</div>
                  {entry.result && (
                    <div className="text-xs font-mono text-success-text mt-1 truncate" title={entry.result}>
                      {entry.result}
                    </div>
                  )}
                  {entry.error && (
                    <div className="text-xs font-mono text-error-text mt-1">{entry.error}</div>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-xs text-text-muted font-mono">{entry.executionTimeMs}ms</div>
                    <div className="text-xs text-text-muted mt-0.5">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/console?cmd=${encodeURIComponent(entry.command)}`)}
                    className="p-1.5 rounded hover:bg-surface-3 text-text-muted hover:text-text-primary transition-colors"
                    title="Re-run in console"
                  >
                    <Play size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
