import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Activity, Database, Zap, Clock, HardDrive, AlertTriangle } from 'lucide-react';
import { api, StatsResponse } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { formatBytes, formatUptime } from '@/lib/utils';

function Bar({ value, total, color = 'bg-accent' }: { value: number; total: number; color?: string }) {
  const pct = total === 0 ? 0 : Math.min(100, (value / total) * 100);
  return (
    <div className="w-full bg-surface-3 rounded-full h-1.5 overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

interface Metric { label: string; value: string; icon: React.ReactNode; sub?: string }

export function Stats() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setStats(await api.stats());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [load]);

  const successRate = stats
    ? stats.commandsExecuted === 0 ? 0 : (stats.commandsSucceeded / stats.commandsExecuted) * 100
    : 0;

  const metrics: Metric[] = stats ? [
    { label: 'Total Keys', value: String(stats.totalKeys), icon: <Database size={16} />, sub: `${stats.expiringKeys} with TTL` },
    { label: 'Memory Estimate', value: formatBytes(stats.memoryEstimateBytes), icon: <HardDrive size={16} /> },
    { label: 'Commands Executed', value: String(stats.commandsExecuted), icon: <Zap size={16} /> },
    { label: 'Uptime', value: formatUptime(stats.uptimeSeconds), icon: <Clock size={16} />, sub: `since ${new Date(stats.startedAt).toLocaleString()}` },
    { label: 'Successful', value: String(stats.commandsSucceeded), icon: <Activity size={16} />, sub: `${successRate.toFixed(1)}% success rate` },
    { label: 'Failed', value: String(stats.commandsFailed), icon: <AlertTriangle size={16} /> },
  ] : [];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Statistics"
        subtitle="Live metrics from the MiniRedix engine"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-slow" />
              Auto-refresh 3s
            </div>
            <Button size="sm" icon={<RefreshCw size={13} />} variant="ghost" onClick={load} loading={loading && !stats}>
              Refresh
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {error && (
          <div className="bg-error-muted border border-error/20 text-error-text text-sm px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Metric cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {metrics.map(m => (
            <div key={m.label} className="bg-surface-2 border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 text-text-muted mb-2">
                {m.icon}
                <span className="text-xs uppercase tracking-wider font-semibold">{m.label}</span>
              </div>
              <div className="text-2xl font-semibold font-mono text-text-primary">{m.value}</div>
              {m.sub && <div className="text-xs text-text-muted mt-1">{m.sub}</div>}
            </div>
          ))}
        </div>

        {/* Command breakdown */}
        {stats && (
          <div className="bg-surface-2 border border-border rounded-lg p-5 space-y-5">
            <div className="text-sm font-semibold text-text-secondary">Command Breakdown</div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs text-text-secondary mb-1.5">
                  <span>Succeeded</span>
                  <span className="font-mono">{stats.commandsSucceeded} / {stats.commandsExecuted}</span>
                </div>
                <Bar value={stats.commandsSucceeded} total={stats.commandsExecuted} color="bg-success" />
              </div>
              <div>
                <div className="flex justify-between text-xs text-text-secondary mb-1.5">
                  <span>Failed</span>
                  <span className="font-mono">{stats.commandsFailed} / {stats.commandsExecuted}</span>
                </div>
                <Bar value={stats.commandsFailed} total={stats.commandsExecuted} color="bg-error" />
              </div>
            </div>
          </div>
        )}

        {/* Key breakdown */}
        {stats && (
          <div className="bg-surface-2 border border-border rounded-lg p-5 space-y-5">
            <div className="text-sm font-semibold text-text-secondary">Key Distribution</div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs text-text-secondary mb-1.5">
                  <span>Persistent keys</span>
                  <span className="font-mono">{stats.totalKeys - stats.expiringKeys}</span>
                </div>
                <Bar value={stats.totalKeys - stats.expiringKeys} total={Math.max(stats.totalKeys, 1)} color="bg-info" />
              </div>
              <div>
                <div className="flex justify-between text-xs text-text-secondary mb-1.5">
                  <span>Expiring keys</span>
                  <span className="font-mono">{stats.expiringKeys}</span>
                </div>
                <Bar value={stats.expiringKeys} total={Math.max(stats.totalKeys, 1)} color="bg-warning" />
              </div>
            </div>
          </div>
        )}

        {/* Compact AOF */}
        <div className="bg-surface-2 border border-border rounded-lg p-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-text-primary">AOF Persistence</div>
            <div className="text-xs text-text-muted mt-0.5">Compact the append-only log by rewriting with current state</div>
          </div>
          <Button size="sm" variant="outline" onClick={() => api.compact()}>
            Compact AOF
          </Button>
        </div>
      </div>
    </div>
  );
}
