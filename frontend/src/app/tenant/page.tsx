'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  User, 
  Building, 
  Bed as BedIcon, 
  Calendar, 
  IndianRupee, 
  FileText, 
  Wrench, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink, 
  ShieldCheck, 
  Loader2, 
  ArrowRight,
  TrendingUp,
  Receipt,
  Download,
  Info
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

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

interface Invoice {
  id: string;
  type: 'RENT' | 'SECURITY_DEPOSIT';
  amount: number;
  paidAmount: number;
  dueDate: string;
  status: 'PENDING' | 'PAST_DUE' | 'PAID' | 'PARTIALLY_PAID';
  paidAt: string | null;
  paymentMode: string | null;
}

interface Complaint {
  id: string;
  category: string;
  description: string;
  priority: 'LOW' | 'HIGH' | 'URGENT';
  status: 'PENDING' | 'ESCALATED' | 'RESOLVED';
  slaDeadline: string;
  resolvedAt: string | null;
}

interface DamageRecoveryItem {
  id: string;
  title: string;
  amount: number;
  notes: string | null;
}

interface DamageRecovery {
  id: string;
  amount: number;
  reason: string;
  status: string;
  recoveryMethod: string;
  recoveredAmount: number;
  outstandingAmount: number;
  createdAt: string;
  attachmentUrls: string[];
  items: DamageRecoveryItem[];
}

interface TenantProfile {
  id: string;
  status: 'ACTIVE' | 'NOTICE' | 'PAST' | 'INCOMPLETE';
  monthlyRent: number;
  securityDeposit: number;
  securityDepositStatus: string;
  depositCollectedAt: string | null;
  depositRefundedAmount: number | null;
  depositDeductionAmount: number | null;
  depositRefundedAt: string | null;
  depositRefundMode: string | null;
  depositRefundNotes: string | null;
  settlementStatus: string;
  moveInDate: string;
  moveOutDate: string | null;
  globalTenant: GlobalTenant;
  room: Room;
  bed: Bed | null;
  historicalRoomNumber: string | null;
  historicalBedNumber: string | null;
  invoices: Invoice[];
  complaints: Complaint[];
  damageRecoveries: DamageRecovery[];
}

function TenantPortalContent() {
  const searchParams = useSearchParams();
  const profileId = searchParams.get('profileId');

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<TenantProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    if (!profileId) {
      setError('Invalid Link: profileId parameter is missing.');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://pgos-production-d612.up.railway.app/api';
      const res = await fetch(`${apiBase}/payments/tenant/profile/${profileId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to load resident profile.');
      }
      const json = await res.json();
      setProfile(json.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Unable to retrieve details. Please check connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [profileId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
        <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
        <p className="text-zinc-400 text-sm font-semibold tracking-wide animate-pulse">Loading secure profile...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full border border-zinc-900 bg-zinc-950/40 p-6 rounded-2xl text-center space-y-4 shadow-2xl">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-red-500" />
          </div>
          <div>
            <h4 className="font-extrabold text-lg text-white">Access Error</h4>
            <p className="text-zinc-500 text-xs mt-2 leading-relaxed">
              {error || 'The requested resident profile could not be found.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Calculations for Summary
  const outstandingRent = profile.invoices
    .filter(inv => inv.type === 'RENT' && inv.status !== 'PAID')
    .reduce((sum, inv) => sum + (inv.amount - inv.paidAmount), 0);

  const outstandingDeposit = profile.invoices
    .filter(inv => inv.type === 'SECURITY_DEPOSIT' && inv.status !== 'PAID')
    .reduce((sum, inv) => sum + (inv.amount - inv.paidAmount), 0);

  const outstandingDamages = profile.damageRecoveries
    .filter(rec => rec.status !== 'FULLY_RECOVERED' && rec.status !== 'WAIVED')
    .reduce((sum, rec) => sum + rec.outstandingAmount, 0);

  const totalCollectedDeposit = profile.invoices
    .filter(inv => inv.type === 'SECURITY_DEPOSIT' && inv.status === 'PAID')
    .reduce((sum, inv) => sum + inv.paidAmount, 0);

  const totalDeductions = profile.depositDeductionAmount || 0;
  const refundedDeposit = profile.depositRefundedAmount || 0;
  const netRefundable = Math.max(0, totalCollectedDeposit - totalDeductions - refundedDeposit);

  return (
    <div className="min-h-screen bg-black text-white py-8 px-4 sm:px-6 lg:px-8 selection:bg-primary selection:text-black">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header Widget */}
        <div className="relative border border-zinc-900 bg-zinc-950/20 rounded-3xl p-6 md:p-8 shadow-2xl overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[4px] bg-gradient-to-r from-primary via-emerald-400 to-emerald-500" />
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 bg-zinc-900 border border-zinc-850 px-2.5 py-1 rounded">
                Resident Portal
              </span>
              <h1 className="text-3xl font-black text-white">{profile.globalTenant.name}</h1>
              <p className="text-zinc-400 text-xs leading-relaxed font-semibold">
                Phone: {profile.globalTenant.phone} {profile.globalTenant.email ? `| Email: ${profile.globalTenant.email}` : ''}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-zinc-950 p-4 border border-zinc-900 rounded-2xl w-full md:w-auto">
              <div>
                <span className="text-[9px] text-zinc-550 block uppercase font-bold tracking-wider">Room & Bed</span>
                <span className="text-sm font-extrabold text-zinc-200 mt-0.5 block">
                  Room {profile.room.number}
                </span>
                <span className="text-[10px] text-zinc-500 block">
                  Bed {profile.bed?.bedNumber || profile.historicalBedNumber || '-'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[9px] text-zinc-550 block uppercase font-bold tracking-wider">Status</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider block mt-1.5 w-fit ml-auto border
                  ${profile.status === 'ACTIVE' 
                    ? 'bg-green-500/10 border-green-500/20 text-green-400' 
                    : profile.status === 'NOTICE'
                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>
                  {profile.status}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Ledger Dues Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-zinc-900 bg-zinc-950/20 backdrop-blur-md">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Rent Dues</span>
                <span className="text-xl font-black text-amber-500">₹{outstandingRent.toLocaleString('en-IN')}</span>
              </div>
              <div className="h-9 w-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <IndianRupee className="h-4.5 w-4.5 text-amber-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-900 bg-zinc-950/20 backdrop-blur-md">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Deposit Pending</span>
                <span className="text-xl font-black text-blue-400">₹{outstandingDeposit.toLocaleString('en-IN')}</span>
              </div>
              <div className="h-9 w-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Building className="h-4.5 w-4.5 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-900 bg-zinc-950/20 backdrop-blur-md">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Damage Charges</span>
                <span className="text-xl font-black text-red-400">₹{outstandingDamages.toLocaleString('en-IN')}</span>
              </div>
              <div className="h-9 w-9 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <AlertTriangle className="h-4.5 w-4.5 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Move-Out Settlement Section */}
        {(profile.status === 'PAST' || profile.moveOutDate !== null || profile.settlementStatus === 'LOCKED' || profile.damageRecoveries.length > 0) && (
          <Card className="border-zinc-900 bg-zinc-950/10">
            <CardHeader className="border-b border-zinc-900 pb-4">
              <CardTitle className="text-lg font-black text-zinc-100 flex items-center gap-1.5">
                <Receipt className="h-5 w-5 text-primary" /> Transparent Move-Out Settlement
              </CardTitle>
              <CardDescription className="text-zinc-500 text-xs font-semibold">
                Audit breakdown of deposits held, itemized deductions, and calculated refund amounts.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Receipt Breakdown Visual */}
              <div className="border border-zinc-850 bg-zinc-950 rounded-2xl p-5 md:p-6 space-y-5 select-none relative font-semibold">
                <div className="flex justify-between items-start pb-4 border-b border-zinc-900">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Statement</span>
                    <h4 className="text-sm font-bold text-white mt-0.5">Deposit Recovery Ledger</h4>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase tracking-wide
                    ${profile.settlementStatus === 'LOCKED' 
                      ? 'bg-zinc-900 border-zinc-850 text-zinc-400' 
                      : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
                    {profile.settlementStatus === 'LOCKED' ? 'Settled & Locked' : 'Open Balance'}
                  </span>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="flex justify-between items-center py-1">
                    <span className="text-zinc-500">Security Deposit Held:</span>
                    <span className="font-extrabold text-zinc-200">₹{totalCollectedDeposit.toLocaleString('en-IN')}</span>
                  </div>

                  {/* Deductions breakdown */}
                  {profile.damageRecoveries.length > 0 && (
                    <div className="space-y-2.5 border-t border-b border-zinc-900/60 py-3.5">
                      <span className="text-[10px] font-black text-zinc-550 uppercase tracking-wider block">Itemized Deductions</span>
                      {profile.damageRecoveries.map((rec) => (
                        <div key={rec.id} className="flex justify-between items-start text-[11px] leading-tight">
                          <div className="space-y-0.5">
                            <span className="text-zinc-300 font-extrabold block">{rec.reason}</span>
                            {rec.attachmentUrls && rec.attachmentUrls.length > 0 && (
                              <a 
                                href={rec.attachmentUrls[0]} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-[9px] text-primary hover:underline flex items-center gap-0.5"
                              >
                                <ExternalLink className="h-3 w-3" /> View Bill Attachment
                              </a>
                            )}
                          </div>
                          <span className="font-mono text-red-400 font-black">-₹{rec.amount.toLocaleString('en-IN')}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Net Summary */}
                  <div className="flex justify-between items-center py-1 font-bold">
                    <span className="text-zinc-500">Total Deductions Applied:</span>
                    <span className="font-extrabold text-red-400">₹{totalDeductions.toLocaleString('en-IN')}</span>
                  </div>

                  {profile.depositRefundedAt && (
                    <div className="flex justify-between items-center py-1 font-bold border-t border-dashed border-zinc-850 pt-3">
                      <span className="text-zinc-500">Amount Refunded:</span>
                      <span className="font-extrabold text-green-400">₹{refundedDeposit.toLocaleString('en-IN')}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center py-2.5 border-t border-zinc-900 font-black text-sm">
                    <span className="text-zinc-400">Net Refund Due / Paid:</span>
                    <span className="text-lg text-primary">₹{netRefundable.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Settlement metadata info card */}
              {profile.depositRefundedAt && (
                <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-4 text-xs font-semibold grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="text-zinc-500 block uppercase text-[9px] tracking-wider font-bold">Refund Date</span>
                    <span className="text-zinc-300 font-mono mt-0.5 block">
                      {new Date(profile.depositRefundedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block uppercase text-[9px] tracking-wider font-bold">Payment Mode</span>
                    <span className="text-zinc-300 uppercase mt-0.5 block">{profile.depositRefundMode || 'N/A'}</span>
                  </div>
                  {profile.depositRefundNotes && (
                    <div className="sm:col-span-2">
                      <span className="text-zinc-500 block uppercase text-[9px] tracking-wider font-bold">Notes</span>
                      <p className="text-zinc-400 italic mt-1 font-medium">"{profile.depositRefundNotes}"</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* invoices ledger list */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-zinc-900 bg-zinc-950/10">
            <CardHeader className="border-b border-zinc-900 pb-4">
              <CardTitle className="text-base font-black text-zinc-150 flex items-center gap-1.5">
                <FileText className="h-4.5 w-4.5 text-primary" /> Invoice Ledger
              </CardTitle>
              <CardDescription className="text-zinc-500 text-xs">
                History of rent bills and security deposit transactions.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3.5 max-h-[350px] overflow-y-auto">
              {profile.invoices.length === 0 ? (
                <p className="text-xs text-zinc-500 text-center py-6 font-semibold">No invoices generated yet.</p>
              ) : (
                profile.invoices.map((inv) => (
                  <div key={inv.id} className="flex justify-between items-center p-3 rounded-xl border border-zinc-900 bg-zinc-950/60 text-xs font-semibold">
                    <div className="space-y-0.5">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border tracking-wider
                        ${inv.type === 'RENT' ? 'bg-amber-500/5 border-amber-500/10 text-amber-400' : 'bg-blue-500/5 border-blue-500/10 text-blue-400'}`}>
                        {inv.type}
                      </span>
                      <span className="text-zinc-350 block mt-1">₹{inv.amount.toLocaleString('en-IN')}</span>
                      <span className="text-[10px] text-zinc-550 block font-normal">
                        Due {new Date(inv.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>

                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border 
                      ${inv.status === 'PAID' 
                        ? 'bg-green-500/10 border-green-500/20 text-green-400' 
                        : inv.status === 'PARTIALLY_PAID'
                          ? 'bg-amber-500/10 border-amber-500/20 text-amber-450'
                          : 'bg-red-500/10 border-red-500/20 text-red-400'}`}
                    >
                      {inv.status === 'PARTIALLY_PAID' ? 'PARTIAL' : inv.status}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* complaints tickets raised */}
          <Card className="border-zinc-900 bg-zinc-950/10">
            <CardHeader className="border-b border-zinc-900 pb-4">
              <CardTitle className="text-base font-black text-zinc-150 flex items-center gap-1.5">
                <Wrench className="h-4.5 w-4.5 text-primary" /> Active Maintenance Tickets
              </CardTitle>
              <CardDescription className="text-zinc-500 text-xs">
                Real-time tracking of repairs raised for your room.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3.5 max-h-[350px] overflow-y-auto">
              {profile.complaints.length === 0 ? (
                <p className="text-xs text-zinc-500 text-center py-6 font-semibold">No complaints logged yet.</p>
              ) : (
                profile.complaints.map((comp) => (
                  <div key={comp.id} className="p-3 rounded-xl border border-zinc-900 bg-zinc-950/60 text-xs font-semibold space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="font-extrabold text-zinc-300">{comp.category}</span>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border 
                        ${comp.status === 'RESOLVED' 
                          ? 'bg-green-500/10 border-green-500/20 text-green-400' 
                          : 'bg-amber-500/10 border-amber-500/20 text-amber-455'}`}
                      >
                        {comp.status}
                      </span>
                    </div>

                    <p className="text-[11px] text-zinc-400 leading-normal line-clamp-2">
                      {comp.description}
                    </p>

                    <div className="text-[10px] text-zinc-550 border-t border-zinc-900/60 pt-2 font-bold flex justify-between">
                      <span>Priority: {comp.priority}</span>
                      <span>Target: {new Date(comp.slaDeadline).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}

export default function PublicTenantPortal() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
        <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
        <p className="text-zinc-400 text-sm font-semibold tracking-wide animate-pulse">Initializing Resident Portal...</p>
      </div>
    }>
      <TenantPortalContent />
    </Suspense>
  );
}
