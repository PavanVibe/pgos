'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOrganizationStore } from '@/store/useOrganizationStore';
import { useResidentProfileStore } from '@/store/useResidentProfileStore';
import { fetchApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  Users, 
  Search, 
  Filter, 
  Calendar, 
  User, 
  ArrowRight,
  TrendingUp,
  UserCheck,
  PowerOff,
  Building,
  CreditCard,
  History,
  Phone,
  Mail,
  ChevronRight
} from 'lucide-react';

interface GlobalTenant {
  name: string;
  phone: string;
  email: string | null;
}

interface Room {
  number: string;
  floor: string | null;
}

interface Bed {
  bedNumber: string;
  monthlyRent: number;
}

interface ResidentItem {
  id: string;
  status: 'ACTIVE' | 'NOTICE' | 'PAST' | 'INCOMPLETE';
  monthlyRent: number;
  securityDeposit: number;
  moveInDate: string;
  globalTenant: GlobalTenant;
  room: Room;
  bed: Bed | null;
}

export default function ResidentsPage() {
  const { activePgId } = useOrganizationStore();
  const { openProfile } = useResidentProfileStore();

  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'NOTICE' | 'PAST' | 'INCOMPLETE' | 'ALL'>('ACTIVE');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch PG Residents
  const { data: response, isLoading } = useQuery({
    queryKey: ['pg-residents', activePgId],
    queryFn: () => {
      // Endpoint mapped to /api/tenants/pgs/:pgId/residents
      return fetchApi(`/tenants/pgs/${activePgId}/residents`);
    },
    enabled: !!activePgId,
  });

  const residents: ResidentItem[] = response?.data || [];

  // Filter residents
  const filteredResidents = React.useMemo(() => {
    return residents.filter(r => {
      // Tab filter
      if (activeTab !== 'ALL' && r.status !== activeTab) return false;

      // Search query filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const nameMatch = r.globalTenant.name.toLowerCase().includes(query);
        const phoneMatch = r.globalTenant.phone.toLowerCase().includes(query);
        const emailMatch = r.globalTenant.email?.toLowerCase().includes(query) || false;
        const roomMatch = r.room.number.toLowerCase().includes(query);
        return nameMatch || phoneMatch || emailMatch || roomMatch;
      }

      return true;
    });
  }, [residents, activeTab, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-900 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Residents Registry</h1>
          <p className="text-zinc-400 text-xs mt-1">Manage all tenant lease agreement profiles and check-in history.</p>
        </div>
      </div>

      {/* Filter and Search Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-950/40 p-4 border border-zinc-900 rounded-2xl">
        {/* Status Tabs */}
        <div className="flex bg-black p-1 rounded-xl border border-zinc-900 w-fit overflow-x-auto scrollbar-none">
          {(['ACTIVE', 'NOTICE', 'PAST', 'INCOMPLETE', 'ALL'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-xs font-extrabold uppercase tracking-wide transition-all shrink-0
                ${activeTab === tab 
                  ? 'bg-zinc-900 text-white shadow-sm' 
                  : 'text-zinc-550 hover:text-zinc-300'}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            type="text"
            placeholder="Search name, phone, room..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-black border-zinc-900 text-white rounded-xl text-xs h-9 focus:border-zinc-800"
          />
        </div>
      </div>

      {/* Residents List */}
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-zinc-900 rounded-xl" />
          ))}
        </div>
      ) : filteredResidents.length === 0 ? (
        <div className="border border-zinc-900 rounded-2xl p-12 text-center bg-zinc-950/10">
          <Users className="h-10 w-10 text-zinc-650 mx-auto mb-3" />
          <p className="text-sm font-bold text-zinc-400">No residents found.</p>
          <p className="text-xs text-zinc-550 mt-1">There are no residents matching this filter.</p>
        </div>
      ) : (
        <div className="border border-zinc-900 rounded-2xl bg-zinc-950/10 overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-semibold leading-normal">
              <thead>
                <tr className="border-b border-zinc-900 text-[10px] uppercase tracking-widest text-zinc-500 font-bold bg-zinc-950/40 select-none">
                  <th className="p-4">Resident</th>
                  <th className="p-4">Room & Bed</th>
                  <th className="p-4">Monthly Rent</th>
                  <th className="p-4">Security Deposit</th>
                  <th className="p-4">Move-In Date</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Profile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900/60">
                {filteredResidents.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-950/30 transition-colors">
                    <td className="p-4">
                      <button
                        onClick={() => openProfile(item.id)}
                        className="font-extrabold text-sm text-zinc-200 hover:text-primary transition-all text-left underline decoration-dashed decoration-zinc-800 hover:decoration-primary underline-offset-4"
                      >
                        {item.globalTenant.name}
                      </button>
                      <span className="text-[10px] text-zinc-500 block font-normal mt-0.5">{item.globalTenant.phone}</span>
                    </td>
                    <td className="p-4">
                      <span className="font-extrabold text-zinc-300">Room {item.room.number}</span>
                      <span className="text-[10px] text-zinc-500 block font-normal mt-0.5">Bed {item.bed?.bedNumber || '-'}</span>
                    </td>
                    <td className="p-4 font-mono text-zinc-300">
                      ₹{item.monthlyRent.toLocaleString('en-IN')}/mo
                    </td>
                    <td className="p-4 font-mono text-zinc-400">
                      ₹{item.securityDeposit.toLocaleString('en-IN')}
                    </td>
                    <td className="p-4 font-mono text-zinc-450">
                      {new Date(item.moveInDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border 
                        ${item.status === 'ACTIVE' 
                          ? 'bg-green-500/10 border-green-500/20 text-green-400' 
                          : item.status === 'NOTICE'
                            ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                            : item.status === 'PAST'
                              ? 'bg-zinc-900 border-zinc-800 text-zinc-400'
                              : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => openProfile(item.id)}
                        className="p-1 rounded-lg hover:bg-zinc-900 text-zinc-400 hover:text-white transition-all inline-flex items-center justify-center"
                        title="View Resident Profile"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Grid Layout */}
          <div className="block md:hidden divide-y divide-zinc-900/60">
            {filteredResidents.map((item) => (
              <div 
                key={item.id} 
                className="p-4 space-y-3 hover:bg-zinc-950/20 transition-all cursor-pointer"
                onClick={() => openProfile(item.id)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-extrabold text-base text-zinc-200">
                      {item.globalTenant.name}
                    </h4>
                    <span className="text-[10px] text-zinc-500 block mt-0.5">
                      Room {item.room.number} — Bed {item.bed?.bedNumber || '-'}
                    </span>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border 
                    ${item.status === 'ACTIVE' 
                      ? 'bg-green-500/10 border-green-500/20 text-green-400' 
                      : item.status === 'NOTICE'
                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                        : item.status === 'PAST'
                          ? 'bg-zinc-900 border-zinc-800 text-zinc-400'
                          : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                    {item.status}
                  </span>
                </div>

                <div className="flex justify-between items-center text-[10px] text-zinc-500 font-bold">
                  <span>Phone: {item.globalTenant.phone}</span>
                  <span>Rent: ₹{item.monthlyRent.toLocaleString('en-IN')}/mo</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
