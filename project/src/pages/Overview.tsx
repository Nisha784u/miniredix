import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Terminal, Key, ArrowRight, Cpu, Wifi } from 'lucide-react';
import { api, StatsResponse, HealthResponse } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { formatBytes, formatUptime } from '@/lib/utils';

const QUICK_COMMANDS = [
  { label: 'SET', example: 'SET greeting "Hello, World!"', desc: 'Store a string value' },
  { label: 'GET', example: 'GET greeting', desc: 'Retrieve a value by key' },
  { label: 'EXPIRE', example: 'EXPIRE greeting 60', desc: 'Set TTL in seconds' },
  { label: 'TTL', example: 'TTL greeting', desc: 'Check remaining lifetime' },
  { label: 'KEYS', example: 'KEYS *', desc: 'List all keys' },
  { label: 'INFO', example: 'INFO', desc: 'Database statistics' },
];

export function Overview() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, h] = await Promise.all([api.stats(), api.health()]);
      setStats(s);
      setHealth(h);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Overview"
        subtitle="Real-time view of your MiniRedix instance"
        actions={
          <Button size="sm" icon={<RefreshCw size={13} />} onClick={load} loading={loading && !stats}>
            Refresh
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {error && (
          <div className="bg-error-muted border border-error/20 text-error-text text-sm px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Health banner */}
        {health && (
          <div className="flex items-center gap-3 bg-surface-2 border border-border rounded-lg px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse-slow" />
              <span className="text-sm text-text-primary font-medium">Engine online</span>
            </div>
            <div className="text-border-strong">|</div>
            <span className="text-xs text-text-secondary font-mono">{health.engine} {health.version}</span>
            <div className="text-border-strong">|</div>
            <div className="flex items-center gap-1.5 text-xs text-text-secondary">
              <Wifi size={12} />
              <span>TCP :{health.tcpPort}</span>
            </div>
            <div className="text-border-strong">|</div>
            <span className="text-xs text-text-secondary">Uptime: {formatUptime(health.uptime)}</span>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Keys"
            value={stats?.totalKeys ?? '—'}
            sub="active in store"
            accent
          />
          <StatCard
            label="Commands Run"
            value={stats?.commandsExecuted ?? '—'}
            sub="since start"
          />
          <StatCard
            label="Success Rate"
            value={
              stats
                ? stats.commandsExecuted === 0
                  ? '—'
                  : `${Math.round((stats.commandsSucceeded / stats.commandsExecuted) * 100)}%`
                : '—'
            }
            sub={`${stats?.commandsFailed ?? 0} failed`}
            success={!!stats && stats.commandsExecuted > 0}
          />
          <StatCard
            label="Memory Est."
            value={stats ? formatBytes(stats.memoryEstimateBytes) : '—'}
            sub="approximate"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <StatCard
            label="Keys with TTL"
            value={stats?.expiringKeys ?? '—'}
            sub="will expire"
            warning={!!stats && stats.expiringKeys > 0}
          />
          <StatCard
            label="Uptime"
            value={stats ? formatUptime(stats.uptimeSeconds) : '—'}
            sub={stats ? `since ${new Date(stats.startedAt).toLocaleTimeString()}` : ''}
          />
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-4">
          <Link
            to="/console"
            className="group bg-surface-2 border border-border hover:border-accent/30 rounded-lg p-4 flex items-center gap-3 transition-colors"
          >
            <div className="w-10 h-10 rounded bg-accent/10 flex items-center justify-center">
              <Terminal size={18} className="text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-text-primary">Command Console</div>
              <div className="text-xs text-text-secondary mt-0.5">Execute commands interactively</div>
            </div>
            <ArrowRight size={14} className="text-text-muted group-hover:text-accent transition-colors" />
          </Link>
          <Link
            to="/keys"
            className="group bg-surface-2 border border-border hover:border-accent/30 rounded-lg p-4 flex items-center gap-3 transition-colors"
          >
            <div className="w-10 h-10 rounded bg-surface-3 flex items-center justify-center">
              <Key size={18} className="text-text-secondary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-text-primary">Key Explorer</div>
              <div className="text-xs text-text-secondary mt-0.5">Browse and manage keys</div>
            </div>
            <ArrowRight size={14} className="text-text-muted group-hover:text-text-primary transition-colors" />
          </Link>
        </div>

        {/* Quick command reference */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Cpu size={14} className="text-text-muted" />
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Supported Commands</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {QUICK_COMMANDS.map(({ label, example, desc }) => (
              <Link
                key={label}
                to={`/console?cmd=${encodeURIComponent(example)}`}
                className="group bg-surface-2 border border-border hover:border-border-strong rounded px-3 py-2.5 flex items-center gap-3 transition-colors"
              >
                <Badge variant="neutral" className="shrink-0">{label}</Badge>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-mono text-text-primary truncate">{example}</div>
                  <div className="text-xs text-text-muted mt-0.5">{desc}</div>
                </div>
                <ArrowRight size={12} className="text-text-muted group-hover:text-text-secondary shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
