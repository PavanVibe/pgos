'use client';

import { useQuery } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useOccupancyStore } from '@/store/useOccupancyStore';
import { useOnboardingStore } from '@/store/useOnboardingStore';
import { useVacateStore } from '@/store/useVacateStore';
import { useRentStore } from '@/store/useRentStore';
import { fetchApi } from '@/lib/api';
import { useState } from 'react';
import { RoomHistoryDrawer } from './RoomHistoryDrawer';
import { TrendingUp } from 'lucide-react';
import { 
  Building, 
  Search, 
  User, 
  Phone, 
  Mail, 
  Calendar, 
  DollarSign, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle,
  FileText, 
  LogOut 
} from 'lucide-react';

interface Bed {
  id: string;
  bedNumber: string;
  monthlyRent: number;
  tenantProfile: {
    id: string;
    status: string;
    securityDeposit: number;
    moveInDate: string;
    globalTenant?: {
      name: string;
      phone: string;
      email: string;
    };
    invoices: {
      id: string;
      amount: number;
      dueDate: string;
      status: string;
    }[];
    complaints: {
      id: string;
      status: string;
    }[];
  } | null;
}

interface Room {
  id: string;
  floor: string | null;
  number: string;
  capacity: number;
  beds: Bed[];
}

export default function OccupancyExplorerSheet({ pgId }: { pgId: string }) {
  const { isOccupancyOpen, closeOccupancy, selectedBedId, selectBed, selectRoom } = useOccupancyStore();
  const { openOnboarding, setBedSelection, setRentConfig, setStep } = useOnboardingStore();
  const { openVacate } = useVacateStore();
  const { openMarkPaid } = useRentStore();

  const [selectedFloor, setSelectedFloor] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Fetch live rooms and beds
  const { data: roomsResponse, isLoading, isError } = useQuery({
    queryKey: ['pg-rooms', pgId],
    queryFn: () => fetchApi(`/pgs/${pgId}/rooms`),
    enabled: isOccupancyOpen && !!pgId,
  });

  const rooms: Room[] = roomsResponse?.data || [];

  // Group floors
  const floors = Array.from(
    new Set(rooms.map((r) => r.floor || 'Ground Floor'))
  ).sort();

  // Find currently inspected bed & room
  let inspectedBed: Bed | null = null;
  let inspectedRoom: Room | null = null;

  rooms.forEach((r) => {
    r.beds.forEach((b) => {
      if (b.id === selectedBedId) {
        inspectedBed = b;
        inspectedRoom = r;
      }
    });
  });

  // Filtered rooms
  const filteredRooms = rooms.filter((room) => {
    // Floor filter
    const floorName = room.floor || 'Ground Floor';
    if (selectedFloor !== 'all' && floorName !== selectedFloor) return false;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchRoom = room.number.toLowerCase().includes(query);
      const matchResident = room.beds.some((b) =>
        b.tenantProfile?.globalTenant?.name?.toLowerCase().includes(query)
      );
      return matchRoom || matchResident;
    }

    return true;
  });

  // Quick onboarding action
  const handleQuickOnboard = (bed: Bed) => {
    if (!pgId) return;
    const room = rooms.find((r) => r.beds.some((b) => b.id === bed.id));
    openOnboarding(pgId);
    setBedSelection(bed.id, room?.number || undefined, bed.bedNumber);
    setRentConfig({
      monthlyRent: bed.monthlyRent,
      securityDeposit: bed.monthlyRent * 2,
    });
    setStep(2); // Skip bed selection
    closeOccupancy(); // Close map explorer
  };

  // Quick vacate action
  const handleQuickVacate = (tenantId: string) => {
    openVacate(tenantId);
    closeOccupancy();
  };

  // Quick record payment action
  const handleQuickPay = (
    tenantId: string, 
    dues: number, 
    name: string, 
    roomNumber: string, 
    bedNumber: string,
    invoiceId?: string,
    dueDate?: string
  ) => {
    openMarkPaid(tenantId, dues, name, roomNumber, invoiceId, bedNumber, dueDate);
    closeOccupancy();
  };

  return (
    <Sheet open={isOccupancyOpen} onOpenChange={(open) => !open && closeOccupancy()}>
      <SheetContent 
        side="right" 
        className={`w-full transition-all duration-300 bg-black text-white border-zinc-800 flex flex-col p-0
          ${selectedBedId ? 'sm:max-w-4xl' : 'sm:max-w-md'}`}
      >
        <div className="flex flex-col h-full overflow-y-auto divide-y divide-zinc-900">
          {/* Header */}
          <div className="p-6">
            <SheetHeader>
              <SheetTitle className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                <Building className="h-5 w-5 text-primary" /> Live Occupancy Grid
              </SheetTitle>
              <SheetDescription className="text-zinc-500">
                Live interactive property control system. Track room allocations, inspect active resident records, and manage locks.
              </SheetDescription>
            </SheetHeader>

            {/* Quick Metrics */}
            <div className="mt-4 flex gap-4 text-xs font-semibold">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-green-500/20 border border-green-500" />
                <span className="text-zinc-400">Vacant</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500/20 border border-red-500" />
                <span className="text-zinc-400">Occupied</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500/20 border border-amber-500" />
                <span className="text-zinc-400">Locked / Reserved</span>
              </div>
            </div>
          </div>

          {/* Interactive Coordination Dashboard Grid */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-0 divide-x divide-zinc-900">
            {/* LEFT COLUMN: Map grid */}
            <div className={`md:col-span-12 ${selectedBedId ? 'lg:col-span-7' : ''} p-6 space-y-5 overflow-y-auto max-h-[80vh]`}>
              
              {/* Floor Filters */}
              <div className="flex flex-wrap gap-1.5 bg-zinc-950/60 p-1 border border-zinc-900 rounded-lg">
                <button
                  type="button"
                  onClick={() => setSelectedFloor('all')}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all
                    ${selectedFloor === 'all' 
                      ? 'bg-zinc-800 text-white shadow-sm' 
                      : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                  All Floors
                </button>
                {floors.map((floor) => (
                  <button
                    key={floor}
                    type="button"
                    onClick={() => setSelectedFloor(floor)}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all
                      ${selectedFloor === floor 
                        ? 'bg-zinc-800 text-white shadow-sm' 
                        : 'text-zinc-400 hover:text-zinc-200'}`}
                  >
                    {floor}
                  </button>
                ))}
              </div>

              {/* Live Search */}
              <div className="relative">
                <Input
                  placeholder="Search by room or resident..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-zinc-950 border-zinc-850 focus:border-zinc-700 text-white pl-9 h-10 text-xs w-full"
                />
                <Search className="absolute left-3 top-3.5 h-3.5 w-3.5 text-zinc-500" />
              </div>

              {/* Room Grid */}
              {isLoading && (
                <div className="grid grid-cols-2 gap-3 animate-pulse">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-24 bg-zinc-950 border border-zinc-900 rounded-xl" />
                  ))}
                </div>
              )}

              {isError && (
                <div className="p-8 text-center text-xs text-red-500 border border-dashed border-red-900/30 rounded-xl bg-red-950/5">
                  Failed to fetch live occupancy map. Please try again.
                </div>
              )}

              {!isLoading && !isError && filteredRooms.length === 0 && (
                <div className="p-8 text-center text-xs text-zinc-500 border border-dashed border-zinc-900 rounded-xl">
                  No rooms match your filters.
                </div>
              )}

              {!isLoading && !isError && (
                <div className="grid grid-cols-2 gap-3">
                  {filteredRooms.map((room) => (
                    <div 
                      key={room.id} 
                      onClick={() => selectRoom(room.id)}
                      className="border border-zinc-900 rounded-xl p-3 space-y-2.5 bg-zinc-950/20 group hover:border-zinc-700 hover:bg-zinc-900/30 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 cursor-pointer relative"
                      title="Click room card to open Operational History Ledger"
                    >
                      <div 
                        className="text-[11px] font-extrabold text-center border-b border-zinc-900 pb-1.5 text-zinc-400 tracking-wider uppercase group-hover:text-primary group-hover:border-primary/30 transition-all flex items-center justify-center gap-1"
                      >
                        Room {room.number}
                        <TrendingUp className="h-3 w-3 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                      </div>
                      
                      <div className="flex flex-wrap gap-1.5 justify-center pt-0.5">
                        {room.beds.map((bed) => {
                          const profile = bed.tenantProfile;
                          const isOccupied = !!profile;
                          const isSelected = bed.id === selectedBedId;

                          let statusDot = null;
                          let financialTitle = 'Vacant';

                          if (profile) {
                            const invoices = profile.invoices || [];
                            const hasOverdue = invoices.some(
                              (inv: any) => inv.status === 'PAST_DUE' || new Date(inv.dueDate).getTime() < Date.now()
                            );
                            const hasPending = invoices.some((inv: any) => inv.status === 'PENDING');

                            if (hasOverdue) {
                              statusDot = <span className="absolute -top-1.5 -right-1.5 text-[9px] select-none">❌</span>;
                              financialTitle = `Overdue — Occupied by ${profile.globalTenant?.name}`;
                            } else if (hasPending) {
                              statusDot = <span className="absolute -top-1.5 -right-1.5 text-[9px] select-none">⚠️</span>;
                              financialTitle = `Pending — Occupied by ${profile.globalTenant?.name}`;
                            } else {
                              statusDot = <span className="absolute -top-1.5 -right-1.5 text-[9px] select-none">✅</span>;
                              financialTitle = `Paid — Occupied by ${profile.globalTenant?.name}`;
                            }
                          }
                          
                          return (
                            <button
                              key={bed.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent bubbling up to the Room Card click handler
                                selectBed(isSelected ? null : bed.id);
                              }}
                              className={`h-9 w-9 rounded-lg flex items-center justify-center text-xs font-bold transition-all relative select-none cursor-pointer
                                ${isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-black scale-105 shadow-md shadow-primary/10' : ''}
                                ${isOccupied 
                                  ? 'bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20' 
                                  : 'bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20'
                                }
                              `}
                              title={financialTitle}
                            >
                              {bed.bedNumber}
                              {statusDot}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Resident Detail Panel / Vacant Card */}
            {(() => {
              const bed = inspectedBed as Bed | null;
              const room = inspectedRoom as Room | null;
              if (!selectedBedId || !bed || !room) return null;
              
              return (
                <div className="lg:col-span-5 p-6 bg-zinc-950/40 flex flex-col justify-between overflow-y-auto max-h-[80vh] divide-y divide-zinc-900">
                  
                  {/* 1. OCCUPIED CARD */}
                  {bed.tenantProfile ? (
                    <div className="space-y-6 pb-6">
                      <div>
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-850">
                            Active Resident
                          </span>
                          <div className="flex items-center gap-1 text-[10px] font-bold text-green-400 bg-green-500/5 border border-green-500/15 px-2 py-0.5 rounded">
                            <ShieldCheck className="h-3.5 w-3.5" /> KYC Verified
                          </div>
                        </div>
                        
                        <h4 className="text-xl font-bold text-white mt-3">
                          {bed.tenantProfile.globalTenant?.name || 'Active Resident'}
                        </h4>
                        <p className="text-xs text-zinc-400 mt-1">
                          Allocated to Room <strong className="text-zinc-200">{room.number}</strong> — Bed <strong className="text-zinc-200">{bed.bedNumber}</strong>
                        </p>
                      </div>

                      {/* Dues Alert Banner */}
                      {(() => {
                        const dues = bed.tenantProfile.invoices.reduce((sum, inv) => sum + inv.amount, 0);
                        return dues > 0 ? (
                          <div className="flex items-start gap-2.5 p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-xs text-red-400">
                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-semibold">Outstanding Rent Dues</p>
                              <p className="text-[11px] text-zinc-400 mt-0.5">
                                This resident has pending invoices totaling <strong>₹{dues}</strong>.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2.5 p-3 rounded-lg border border-green-500/20 bg-green-500/5 text-xs text-green-400">
                            <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-semibold">Settled & Consistent</p>
                              <p className="text-[11px] text-zinc-400 mt-0.5">No outstanding invoices or dues pending.</p>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Profile Fields List */}
                      <div className="space-y-4 bg-zinc-950 p-4 border border-zinc-900 rounded-xl">
                        <div className="flex items-center gap-3 text-xs">
                          <Phone className="h-4 w-4 text-zinc-500" />
                          <div>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Phone Number</p>
                            <p className="text-zinc-200 font-medium mt-0.5">
                              {bed.tenantProfile.globalTenant?.phone || 'N/A'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-xs border-t border-zinc-900 pt-3.5">
                          <Mail className="h-4 w-4 text-zinc-500" />
                          <div>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Email Address</p>
                            <p className="text-zinc-200 font-medium mt-0.5 truncate max-w-[200px]">
                              {bed.tenantProfile.globalTenant?.email || 'N/A'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-xs border-t border-zinc-900 pt-3.5">
                          <Calendar className="h-4 w-4 text-zinc-500" />
                          <div>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Move-In Date</p>
                            <p className="text-zinc-200 font-medium mt-0.5">
                              {bed.tenantProfile.moveInDate
                                ? new Date(bed.tenantProfile.moveInDate).toLocaleDateString('en-IN', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                  })
                                : 'N/A'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-xs border-t border-zinc-900 pt-3.5">
                          <DollarSign className="h-4 w-4 text-zinc-500" />
                          <div className="w-1/2">
                            <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Rent Amount</p>
                            <p className="text-zinc-200 font-bold mt-0.5">₹{bed.monthlyRent}</p>
                          </div>
                          <div className="w-1/2 border-l border-zinc-900 pl-4">
                            <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Deposit Paid</p>
                            <p className="text-zinc-200 font-bold mt-0.5">₹{bed.tenantProfile.securityDeposit}</p>
                          </div>
                        </div>

                        {/* Complaint Widget */}
                        {(() => {
                          const activeC = bed.tenantProfile.complaints.filter((c) => c.status === 'PENDING').length;
                          return activeC > 0 ? (
                            <div className="flex items-center gap-3 text-xs border-t border-zinc-900 pt-3.5">
                              <FileText className="h-4 w-4 text-orange-500" />
                              <div>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Active Complaints</p>
                                <p className="text-orange-400 font-bold mt-0.5">{activeC} Ticket{activeC > 1 ? 's' : ''} Open</p>
                              </div>
                            </div>
                          ) : null;
                        })()}
                      </div>

                      {/* Operational Commands */}
                      <div className="pt-4 space-y-2">
                        {(() => {
                          const unpaidInvoices = bed.tenantProfile.invoices.filter((i) => i.status !== 'PAID');
                          const totalDues = unpaidInvoices.reduce((sum, inv) => sum + inv.amount, 0);
                          const oldestInv = unpaidInvoices.length > 0 ? unpaidInvoices[0] : undefined;
                          return totalDues > 0 ? (
                            <Button
                              onClick={() => handleQuickPay(
                                bed.tenantProfile!.id,
                                totalDues,
                                bed.tenantProfile!.globalTenant?.name || 'Resident',
                                room.number,
                                bed.bedNumber,
                                oldestInv?.id,
                                oldestInv?.dueDate
                              )}
                              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold h-11 transition-all flex items-center justify-center gap-2"
                            >
                              <DollarSign className="h-4 w-4" /> Record Rent Payment
                            </Button>
                          ) : null;
                        })()}
                        
                        <Button
                          onClick={() => handleQuickVacate(bed.tenantProfile!.id)}
                          variant="destructive"
                          className="w-full font-bold h-11 transition-all flex items-center justify-center gap-2"
                        >
                          <LogOut className="h-4 w-4" /> Process Move-Out / Vacate
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* 2. VACANT CARD */
                    <div className="space-y-6 pb-6">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-green-500 px-2 py-0.5 rounded bg-green-500/5 border border-green-500/10">
                          Vacant Bed
                        </span>
                        
                        <h4 className="text-xl font-bold text-white mt-3">
                          Bed {bed.bedNumber} is Available
                        </h4>
                        <p className="text-xs text-zinc-400 mt-1">
                          Located inside Room <strong className="text-zinc-200">{room.number}</strong>
                        </p>
                      </div>

                      <div className="space-y-4 bg-zinc-950 p-4 border border-zinc-900 rounded-xl">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-zinc-500 uppercase tracking-wide font-medium">Standard Monthly Rent</span>
                          <span className="text-zinc-200 font-bold text-sm">₹{bed.monthlyRent}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs border-t border-zinc-900 pt-3">
                          <span className="text-zinc-500 uppercase tracking-wide font-medium">Required Security Deposit</span>
                          <span className="text-zinc-200 font-bold text-sm">₹{bed.monthlyRent * 2}</span>
                        </div>
                      </div>

                      <div className="p-4 border border-dashed border-zinc-900 rounded-xl text-center text-xs text-zinc-500">
                        This resource is fully cleaned, maintained, and open for immediate coordinator onboarding.
                      </div>

                      <Button
                        onClick={() => handleQuickOnboard(bed)}
                        className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-11 transition-all"
                      >
                        Onboard New Resident
                      </Button>
                    </div>
                  )}
                  
                  {/* Reset inspection button at the very bottom */}
                  <div className="pt-4 text-center">
                    <button
                      type="button"
                      onClick={() => selectBed(null)}
                      className="text-xs font-bold text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      Close Inspection
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </SheetContent>
      {/* Room Intelligence History Ledger Drawer */}
      <RoomHistoryDrawer pgId={pgId} />
    </Sheet>
  );
}
