import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Terminal, Key, BarChart3, Clock,
  BookOpen, Cpu, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Overview', exact: true },
  { to: '/console', icon: Terminal, label: 'Console' },
  { to: '/keys', icon: Key, label: 'Keys' },
  { to: '/history', icon: Clock, label: 'History' },
  { to: '/stats', icon: BarChart3, label: 'Statistics' },
  { to: '/docs', icon: BookOpen, label: 'Documentation' },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-surface-1 border-r border-border h-full">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-border">
        <div className="w-8 h-8 rounded bg-accent flex items-center justify-center shrink-0">
          <Cpu size={16} className="text-white" />
        </div>
        <div>
          <span className="font-semibold text-sm text-text-primary tracking-tight">MiniRedix</span>
          <div className="text-[10px] text-text-muted font-mono leading-none mt-0.5">v1.0.0</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5">
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive = to === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-all duration-150 group',
                isActive
                  ? 'bg-accent/10 text-accent border border-accent/20'
                  : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary border border-transparent'
              )}
            >
              <Icon size={15} className="shrink-0" />
              <span className="flex-1 font-medium">{label}</span>
              {isActive && <ChevronRight size={12} className="opacity-60" />}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-border">
        <div className="text-[10px] text-text-muted font-mono space-y-0.5">
          <div>TCP :6399</div>
          <div>REST :5173</div>
        </div>
      </div>
    </aside>
  );
}
