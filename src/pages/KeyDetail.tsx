import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Trash2, RefreshCw, Clock, Edit3, Check, X } from 'lucide-react';
import { api, KeyEntry } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { formatDate, formatTtl } from '@/lib/utils';

type KeyDetail = KeyEntry & { ttl: number; type: string };

export function KeyDetail() {
  const { key: encodedKey } = useParams<{ key: string }>();
  const key = decodeURIComponent(encodedKey ?? '');
  const navigate = useNavigate();
  const [detail, setDetail] = useState<KeyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const d = await api.key(key);
      setDetail(d as KeyDetail);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Key not found');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [key]);

  const handleDelete = async () => {
    if (!confirm(`Delete key "${key}"?`)) return;
    await api.deleteKey(key);
    navigate('/keys');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.command(`SET ${key} ${newValue}`);
      setEditing(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const ttlVariant = (ttl: number) => {
    if (ttl === -2) return 'error';
    if (ttl === -1) return 'neutral';
    if (ttl < 10) return 'error';
    if (ttl < 60) return 'warning';
    return 'success';
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-text-muted text-sm">Loading…</div>
  );

  if (error) return (
    <div className="p-6">
      <Link to="/keys" className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary mb-6">
        <ArrowLeft size={14} /> Back to Keys
      </Link>
      <div className="bg-error-muted border border-error/20 text-error-text px-4 py-3 rounded">{error}</div>
    </div>
  );

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={key}
        subtitle={`Type: ${detail?.type ?? 'string'}`}
        actions={
          <div className="flex gap-2">
            <Button size="sm" icon={<RefreshCw size={13} />} variant="ghost" onClick={load}>Refresh</Button>
            <Button size="sm" icon={<Trash2 size={13} />} variant="danger" onClick={handleDelete}>Delete</Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        <Link to="/keys" className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary w-fit">
          <ArrowLeft size={13} /> All Keys
        </Link>

        {/* Metadata */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Type', value: <Badge variant="info">{detail?.type}</Badge> },
            { label: 'TTL', value: <Badge variant={ttlVariant(detail?.ttl ?? -1) as 'error' | 'warning' | 'success' | 'neutral'}>{formatTtl(detail?.ttl ?? -1)}</Badge> },
            { label: 'Created', value: <span className="text-xs font-mono text-text-secondary">{formatDate(detail?.createdAt ?? null)}</span> },
            { label: 'Updated', value: <span className="text-xs font-mono text-text-secondary">{formatDate(detail?.updatedAt ?? null)}</span> },
          ].map(({ label, value }) => (
            <div key={label} className="bg-surface-2 border border-border rounded px-3 py-3">
              <div className="text-xs text-text-muted mb-1.5">{label}</div>
              {value}
            </div>
          ))}
        </div>

        {/* Value */}
        <div className="bg-surface-2 border border-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-3">
            <div className="flex items-center gap-2 text-sm font-medium text-text-secondary">
              <Clock size={13} />
              <span>Value</span>
            </div>
            {!editing && (
              <Button size="sm" icon={<Edit3 size={13} />} variant="ghost" onClick={() => { setEditing(true); setNewValue(detail?.value ?? ''); }}>
                Edit
              </Button>
            )}
          </div>
          <div className="p-4">
            {editing ? (
              <div className="space-y-3">
                <textarea
                  value={newValue}
                  onChange={e => setNewValue(e.target.value)}
                  className="w-full bg-surface-0 border border-border focus:border-accent/40 rounded px-3 py-2 text-sm font-mono text-text-primary outline-none resize-none min-h-[100px]"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="primary" icon={<Check size={13} />} onClick={handleSave} loading={saving}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" icon={<X size={13} />} onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <pre className="text-sm font-mono text-text-primary whitespace-pre-wrap break-all">
                {detail?.value}
              </pre>
            )}
          </div>
        </div>

        {/* TTL management */}
        {detail && (
          <div className="bg-surface-2 border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-surface-3 text-sm font-medium text-text-secondary">
              Expiration
            </div>
            <div className="p-4 flex flex-wrap gap-3 items-center">
              {detail.expiresAt && (
                <span className="text-xs text-text-muted font-mono">
                  Expires: {new Date(detail.expiresAt).toLocaleString()}
                </span>
              )}
              <div className="flex gap-2 flex-wrap">
                {[60, 300, 3600, 86400].map(secs => (
                  <Button
                    key={secs}
                    size="sm"
                    variant="outline"
                    onClick={async () => { await api.command(`EXPIRE ${key} ${secs}`); load(); }}
                  >
                    +{secs < 3600 ? `${secs}s` : secs < 86400 ? `${secs / 3600}h` : '1d'}
                  </Button>
                ))}
                {detail.expiresAt && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => { await api.command(`PERSIST ${key}`); load(); }}
                  >
                    Remove TTL
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
