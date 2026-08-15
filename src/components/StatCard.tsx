import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
  success?: boolean;
  warning?: boolean;
  error?: boolean;
}

export function StatCard({ label, value, sub, accent, success, warning, error }: StatCardProps) {
  return (
    <div className={cn(
      'bg-surface-2 border rounded-lg p-4 flex flex-col gap-1',
      accent ? 'border-accent/30' : 'border-border'
    )}>
      <div className="text-xs text-text-secondary font-medium uppercase tracking-wider">{label}</div>
      <div className={cn(
        'text-2xl font-semibold font-mono',
        accent && 'text-accent',
        success && 'text-success-text',
        warning && 'text-warning-text',
        error && 'text-error-text',
        !accent && !success && !warning && !error && 'text-text-primary'
      )}>
        {value}
      </div>
      {sub && <div className="text-xs text-text-muted">{sub}</div>}
    </div>
  );
}
