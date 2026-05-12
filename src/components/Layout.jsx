import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  LayoutDashboard, Plus, Bot, LogOut,
  ChevronLeft, ChevronRight, Menu, Shield,
  BookOpen, Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const NAV_SECTIONS = [
  {
    items: [
      { path: '/dashboard',    label: 'Dashboard',   icon: LayoutDashboard, exact: false },
      { path: '/sessions/new', label: 'New Session',  icon: Plus,            exact: true  },
      { path: '/agents',       label: 'Agents',       icon: Bot,             exact: false },
    ],
  },
  {
    items: [
      { path: '/docs', label: 'Docs', icon: BookOpen, exact: false },
    ],
  },
];

function NavItem({ item, collapsed, onClick }) {
  const location = useLocation();
  const isActive = item.exact
    ? location.pathname === item.path
    : location.pathname.startsWith(item.path);

  return (
    <Link
      to={item.path}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={cn(
        'relative flex items-center gap-3 rounded-md text-[13px] font-medium transition-all duration-150 select-none',
        collapsed ? 'px-0 py-2.5 justify-center' : 'px-3 py-2.5',
        isActive
          ? 'text-white bg-white/[0.08]'
          : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]',
      )}
    >
      {/* Active left bar */}
      {isActive && !collapsed && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-blue-400" />
      )}
      <item.icon className={cn(
        'flex-shrink-0 transition-colors',
        collapsed ? 'w-[18px] h-[18px]' : 'w-4 h-4',
        isActive ? 'text-blue-400' : '',
      )} />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => base44.auth.logout('/login');

  const sidebarBg = 'bg-[#0d1520]';
  const borderColor = 'border-white/[0.06]';

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        sidebarBg,
        'fixed inset-y-0 left-0 z-50 flex flex-col border-r transition-all duration-300 ease-in-out',
        borderColor,
        collapsed ? 'w-[60px]' : 'w-[220px]',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      )}>

        {/* Wordmark */}
        <Link
          to="/dashboard"
          className={cn(
            'flex items-center gap-2.5 h-14 border-b flex-shrink-0 overflow-hidden transition-all',
            borderColor,
            collapsed ? 'justify-center px-0' : 'px-4',
          )}
        >
          <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
            <Shield className="w-3.5 h-3.5 text-blue-400" />
          </div>
          {!collapsed && (
            <span className="text-[13px] font-semibold tracking-widest text-slate-200 uppercase">
              Surface
            </span>
          )}
        </Link>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-3">
          {NAV_SECTIONS.map((section, si) => (
            <div key={si} className={cn('px-2', si > 0 && `mt-1 pt-1 border-t ${borderColor}`)}>
              {section.items.map(item => (
                <NavItem
                  key={item.path}
                  item={item}
                  collapsed={collapsed}
                  onClick={() => setMobileOpen(false)}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Bottom actions */}
        <div className={cn('flex-shrink-0 border-t px-2 py-2 space-y-0.5', borderColor)}>
          <button
            onClick={handleLogout}
            title={collapsed ? 'Sign out' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-md text-[13px] font-medium w-full transition-all duration-150',
              collapsed ? 'px-0 py-2.5 justify-center' : 'px-3 py-2.5',
              'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]',
            )}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Sign out</span>}
          </button>

          {/* Collapse toggle (desktop only) */}
          <button
            onClick={() => setCollapsed(v => !v)}
            className={cn(
              'hidden lg:flex items-center gap-3 rounded-md text-[13px] font-medium w-full transition-all duration-150',
              collapsed ? 'px-0 py-2 justify-center' : 'px-3 py-2',
              'text-slate-600 hover:text-slate-400 hover:bg-white/[0.03]',
            )}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed
              ? <ChevronRight className="w-3.5 h-3.5" />
              : <>
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span className="text-xs">Collapse</span>
                </>
            }
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className={cn(
        'flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out',
        collapsed ? 'lg:ml-[60px]' : 'lg:ml-[220px]',
      )}>
        {/* Mobile top bar */}
        <div className={cn(
          'lg:hidden h-14 flex items-center px-4 border-b bg-card',
          'border-border',
        )}>
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setMobileOpen(true)}>
            <Menu className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2 ml-3">
            <div className="w-6 h-6 rounded bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <Shield className="w-3 h-3 text-blue-400" />
            </div>
            <span className="text-sm font-semibold tracking-widest uppercase text-foreground">Surface</span>
          </div>
        </div>

        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
