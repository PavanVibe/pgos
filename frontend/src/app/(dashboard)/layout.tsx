'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useOrganizationStore } from '@/store/useOrganizationStore';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { 
  LayoutDashboard, 
  Target, 
  Users, 
  Building, 
  CreditCard, 
  AlertTriangle, 
  Sliders, 
  BarChart3, 
  Settings, 
  Menu, 
  X, 
  Building2, 
  ChevronDown 
} from 'lucide-react';

interface SidebarItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { activePgId, availablePgs, setActivePgId, setAvailablePgs } = useOrganizationStore();

  const { data: pgsResponse, isLoading: pgsLoading } = useQuery({
    queryKey: ['available-pgs-layout'],
    queryFn: () => fetchApi('/pgs'),
  });

  useEffect(() => {
    if (pgsResponse?.data) {
      const pgs = pgsResponse.data.map((pg: any) => ({
        id: pg.id,
        name: pg.name,
      }));
      setAvailablePgs(pgs);
      if (pgs.length > 0 && (!activePgId || !pgs.find((p: any) => p.id === activePgId))) {
        setActivePgId(pgs[0].id);
      }
    }
  }, [pgsResponse, activePgId, setActivePgId, setAvailablePgs]);

  const mainNavItems: SidebarItem[] = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/leads', label: 'Leads', icon: Target },
    { href: '/residents', label: 'Residents', icon: Users },
    { href: '/rooms', label: 'Rooms', icon: Building },
    { href: '/payments', label: 'Payments', icon: CreditCard },
    { href: '/issues', label: 'Issues', icon: AlertTriangle },
    { href: '/operations', label: 'Operations', icon: Sliders },
    { href: '/reports', label: 'Reports', icon: BarChart3 },
    { href: '/settings/pgs', label: 'Settings', icon: Settings },
  ];

  const handlePgChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setActivePgId(e.target.value);
  };

  const isActiveRoute = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-zinc-950 text-white border-r border-zinc-900 select-none">
      {/* Brand & PG Selector */}
      <div className="p-5 border-b border-zinc-900 space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-primary to-emerald-400 flex items-center justify-center font-black text-black text-sm">
            PG
          </div>
          <span className="text-lg font-black tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
            PGOS <span className="text-[10px] text-primary align-super">V2.1</span>
          </span>
        </div>

        {/* Global PG Selector */}
        <div className="relative">
          {pgsLoading ? (
            <div className="h-10 bg-zinc-900 animate-pulse rounded-lg border border-zinc-850" />
          ) : availablePgs.length > 0 ? (
            <div className="flex items-center gap-2 bg-zinc-900/60 border border-zinc-850 hover:border-zinc-750 px-3 py-2 rounded-xl transition-all relative">
              <Building2 className="h-4 w-4 text-zinc-500 shrink-0" />
              <select
                value={activePgId || ''}
                onChange={handlePgChange}
                className="bg-transparent text-xs font-bold focus:outline-none w-full pr-6 cursor-pointer text-zinc-150 appearance-none relative z-10 py-0.5 text-white"
              >
                {availablePgs.map((pg) => (
                  <option key={pg.id} value={pg.id} className="bg-zinc-950 text-white text-xs">
                    {pg.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="h-3.5 w-3.5 text-zinc-500 absolute right-3 pointer-events-none" />
            </div>
          ) : (
            <Link
              href="/settings/pgs"
              className="flex items-center justify-center p-2 rounded-xl border border-dashed border-zinc-800 bg-zinc-950 text-xs font-bold text-zinc-500 hover:text-white transition-colors"
            >
              + Create First PG
            </Link>
          )}
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 py-4 overflow-y-auto px-3 space-y-1.5 scrollbar-thin">
        {mainNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActiveRoute(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsMobileOpen(false)}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 group
                ${active 
                  ? 'bg-primary/10 border border-primary/20 text-primary shadow-lg shadow-primary/5' 
                  : 'text-zinc-400 border border-transparent hover:text-white hover:bg-zinc-900/40'}`}
            >
              <Icon className={`h-4.5 w-4.5 transition-transform group-hover:scale-105 ${active ? 'text-primary' : 'text-zinc-500 group-hover:text-zinc-300'}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-zinc-900 text-[10px] text-zinc-500 font-semibold text-center select-none uppercase tracking-wider">
        Operational Control Layer
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white flex flex-col md:flex-row overflow-hidden">
      {/* Desktop Sidebar (Permanent) */}
      <aside className="hidden md:block w-64 shrink-0 h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {/* Mobile Header Bar */}
      <header className="md:hidden flex items-center justify-between bg-zinc-950 px-5 py-4 border-b border-zinc-900 shrink-0 z-40 select-none">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-primary to-emerald-400 flex items-center justify-center font-black text-black text-xs">
            PG
          </div>
          <span className="text-sm font-black tracking-tight text-white">PGOS</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Active PG Name Indicator */}
          {availablePgs.length > 0 && activePgId && (
            <span className="text-[10px] font-black uppercase bg-zinc-900 border border-zinc-850 px-2.5 py-1 rounded text-zinc-300">
              {availablePgs.find(p => p.id === activePgId)?.name || 'Property'}
            </span>
          )}

          <button 
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-850 text-zinc-400 hover:text-white transition-all"
            title="Menu"
          >
            {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Sidebar Overlay/Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden animate-in fade-in duration-200">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setIsMobileOpen(false)} />
          <div className="relative w-64 max-w-xs h-full bg-zinc-950 animate-in slide-in-from-left duration-250 z-50">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 h-screen overflow-y-auto bg-black p-4 md:p-6 pb-24 md:pb-6">
        {children}
      </main>
    </div>
  );
}
