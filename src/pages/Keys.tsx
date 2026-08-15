import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Search, Trash2, Eye, Key } from 'lucide-react';
import { api, KeyEntry } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { formatTtl, formatDate, truncate } from '@/lib/utils';

export function Keys() {
  const [keys, setKeys] = useState<KeyEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [pattern, setPattern] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.keys(pattern || '*');
      setKeys(res.keys);
      setTotal(res.total);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load keys');
    } finally {
      setLoading(false);
    }
  }, [pattern]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (key: string) => {
    if (!confirm(`Delete key "${key}"?`)) return;
    setDeleting(key);
    try {
      await api.deleteKey(key);
      setKeys(prev => prev.filter(k => k.key !== key));
      setTotal(prev => prev - 1);
    } catch {
      // ignore
    } finally {
      setDeleting(null);
    }
  };

  const ttlVariant = (ttl: number) => {
    if (ttl === -2) return 'error';
    if (ttl === -1) return 'neutral';
    if (ttl < 10) return 'error';
    if (ttl < 60) return 'warning';
    return 'success';
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Key Explorer"
        subtitle={`${total} key${total !== 1 ? 's' : ''} in store`}
        actions={
          <Button size="sm" icon={<RefreshCw size={13} />} onClick={load} loading={loading && keys.length === 0}>
            Refresh
          </Button>
        }
      />

      <div className="p-6 space-y-4">
        {error && (
          <div className="bg-error-muted border border-error/20 text-error-text text-sm px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Search */}
        <div className="flex items-center gap-2 bg-surface-2 border border-border rounded-lg px-3 py-2">
          <Search size={14} className="text-text-muted shrink-0" />
          <input
            value={pattern}
            onChange={e => setPattern(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load()}
            placeholder="Filter by pattern (e.g. user:*, sess*)"
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none font-mono"
          />
          {pattern && (
            <button onClick={() => setPattern('')} className="text-text-muted hover:text-text-secondary text-xs">
              clear
            </button>
          )}
          <Button size="sm" variant="primary" onClick={load} loading={loading}>
            Search
          </Button>
        </div>

        {/* Table */}
        {keys.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-muted">
            <Key size={32} className="mb-3 opacity-30" />
            <p className="text-sm">No keys found</p>
            <p className="text-xs mt-1">Try running <code className="font-mono">SET mykey myvalue</code> in the console</p>
          </div>
        ) : (
          <div className="bg-surface-2 border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-3">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Key</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Value</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">TTL</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Updated</th>
                  <th className="px-4 py-3 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {keys.map(entry => (
                  <tr
                    key={entry.key}
                    className="hover:bg-surface-3 transition-colors group"
                  >
                    <td className="px-4 py-3 font-mono text-accent text-xs font-medium">
                      {truncate(entry.key, 40)}
                    </td>
                    <td className="px-4 py-3 font-mono text-text-secondary text-xs max-w-[200px]">
                      <span title={entry.value}>{truncate(entry.value, 50)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="info">{entry.type}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={ttlVariant(entry.ttl) as 'error' | 'warning' | 'success' | 'neutral'}>
                        {formatTtl(entry.ttl)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-text-muted">
                      {formatDate(entry.updatedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => navigate(`/keys/${encodeURIComponent(entry.key)}`)}
                          className="p-1.5 rounded hover:bg-surface-4 text-text-muted hover:text-text-primary transition-colors"
                          title="View details"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(entry.key)}
                          disabled={deleting === entry.key}
                          className="p-1.5 rounded hover:bg-error/10 text-text-muted hover:text-error-text transition-colors"
                          title="Delete key"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
