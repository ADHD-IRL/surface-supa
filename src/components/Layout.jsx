import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  Shield, LayoutDashboard, Plus, Bot, LogOut,
  ChevronLeft, ChevronRight, Menu, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import heroImage from '@/assets/surface-hero.jpg';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/sessions/new', label: 'New Session', icon: Plus },
  { path: '/agents', label: 'Agents', icon: Bot },
];

export default function Layout() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    base44.auth.logout('/login');
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        style={{ background: 'linear-gradient(to left, hsla(217, 51%, 35%, 1.00), hsl(215,32%,8%))' }}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-sidebar-border transition-all duration-300",
          collapsed ? "w-16" : "w-60",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Logo */}
        <div className={cn("h-16 flex items-center border-b border-sidebar-border overflow-hidden", collapsed ? "justify-center px-2" : "px-0")}>
          <Link to="/splash" className="flex items-center gap-0 w-full h-full">
            {collapsed ? (
              <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                <img src={heroImage} alt="Surface" className="w-full h-full object-cover object-top" />
              </div>
            ) : (
              <div className="relative w-full h-full">
                <img
                  src={heroImage}
                  alt="Surface"
                  className="w-full h-full object-cover object-top opacity-60"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-sidebar" />
                <div className="absolute inset-0 flex items-center px-4">
                  <span className="text-lg font-bold text-white tracking-tight drop-shadow">Surface</span>
                </div>
              </div>
            )}
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-1">
          {navItems.map((item) => {
            const isActive = item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="p-2 border-t border-sidebar-border space-y-1">
          <button
            onClick={handleLogout}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full transition-colors",
              "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Sign out</span>}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex items-center justify-center w-full py-2 text-sidebar-foreground hover:text-sidebar-accent-foreground transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className={cn(
        "flex-1 flex flex-col min-h-screen transition-all duration-300",
        collapsed ? "lg:ml-16" : "lg:ml-60"
      )}>
        {/* Mobile header */}
        <div className="lg:hidden h-14 flex items-center px-4 border-b border-border bg-card">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <Link to="/splash" className="flex items-center gap-2 ml-3">
            <div className="w-7 h-7 rounded overflow-hidden flex-shrink-0">
              <img src={heroImage} alt="Surface" className="w-full h-full object-cover object-top" />
            </div>
            <span className="font-bold">Surface</span>
          </Link>
        </div>

        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}