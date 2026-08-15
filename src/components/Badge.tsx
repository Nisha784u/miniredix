import { cn } from '@/lib/utils';

type BadgeVariant = 'success' | 'error' | 'warning' | 'info' | 'neutral';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-success-muted text-success-text border-success/20',
  error:   'bg-error-muted text-error-text border-error/20',
  warning: 'bg-warning-muted text-warning-text border-warning/20',
  info:    'bg-info-muted text-info-text border-info/20',
  neutral: 'bg-surface-3 text-text-secondary border-border',
};

export function Badge({ children, variant = 'neutral', className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border font-mono',
      variantClasses[variant],
      className
    )}>
      {children}
    </span>
  );
}
