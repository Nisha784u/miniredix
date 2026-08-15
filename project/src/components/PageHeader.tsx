interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between px-6 pt-6 pb-5 border-b border-border">
      <div>
        <h1 className="text-lg font-semibold text-text-primary tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-text-secondary">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 mt-0.5">{actions}</div>}
    </div>
  );
}
