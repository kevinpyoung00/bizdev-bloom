import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, CalendarCheck, Columns3, Megaphone,
  ChevronLeft, ChevronRight, Target, Handshake, Database, Settings
} from 'lucide-react';
import { useState } from 'react';
import { useCrm } from '@/store/CrmContext';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/today', icon: CalendarCheck, label: 'Today' },
  { to: '/contacts', icon: Users, label: 'Contacts' },
  { to: '/pipeline', icon: Columns3, label: 'Pipeline' },
  { to: '/campaigns', icon: Megaphone, label: 'Campaigns' },
  { to: '/leads', icon: Target, label: 'Lead Engine', divider: true },
  { to: '/lead-queue', icon: Target, label: 'Lead Queue' },
  { to: '/coi-queue', icon: Handshake, label: 'COI Prospect Queue' },
  { to: '/enrichment', icon: Database, label: 'Enrichment' },
  { to: '/lead-settings', icon: Settings, label: 'Settings' },
] as const;

export default function Layout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { getOverdueTasks } = useCrm();
  const overdueCount = getOverdueTasks().length;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className={`${collapsed ? 'w-16' : 'w-56'} bg-sidebar flex flex-col transition-all duration-200 flex-shrink-0`}>
        <div className={`flex items-center gap-2 px-4 h-14 border-b border-sidebar-border ${collapsed ? 'justify-center' : ''}`}>
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground font-bold text-sm">
                OD
              </div>
              <span className="font-semibold text-sidebar-foreground text-sm">OneDigital CRM</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`text-sidebar-muted hover:text-sidebar-foreground transition-colors ${collapsed ? '' : 'ml-auto'}`}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <nav className="flex-1 py-3 px-2 space-y-1">
          {navItems.map((item, idx) => {
            const isActive = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
            return (
              <div key={item.to}>
                {'divider' in item && item.divider && (
                  <div className={`my-2 border-t border-sidebar-border ${!collapsed ? 'mx-2' : ''}`} />
                )}
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors relative
                  ${isActive
                    ? 'bg-sidebar-accent text-sidebar-primary'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  }
                  ${collapsed ? 'justify-center' : ''}
                `}
              >
                <item.icon size={18} />
                {!collapsed && <span>{item.label}</span>}
                {item.label === 'Today' && overdueCount > 0 && (
                  <span className={`bg-destructive text-destructive-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold ${collapsed ? 'absolute -top-1 -right-1' : 'ml-auto'}`}>
                    {overdueCount}
                  </span>
                )}
              </Link>
              </div>
            );
          })}
        </nav>

        {!collapsed && (
          <div className="px-4 py-3 border-t border-sidebar-border">
            <div className="text-xs text-sidebar-muted">Kevin • BDE</div>
            <div className="text-xs text-sidebar-muted">OneDigital</div>
          </div>
        )}
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto scrollbar-thin">
        {children}
      </main>
    </div>
  );
}
