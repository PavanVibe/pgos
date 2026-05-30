'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useResidentProfileStore } from '@/store/useResidentProfileStore';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { 
  User, Phone, Mail, Calendar, CreditCard, AlertCircle, Clock, ShieldCheck, 
  MapPin, DollarSign, ListTodo, ClipboardList, ExternalLink, X, Download
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function ResidentProfileDrawer() {
  const { isOpen, selectedProfileId, closeProfile } = useResidentProfileStore();
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  // 1. Drawer mount diagnostic log
  useEffect(() => {
    console.log("[DIAGNOSTIC] ResidentProfileDrawer component mounted.");
  }, []);

  // 2. State change diagnostic log
  useEffect(() => {
    console.log(`[DIAGNOSTIC] ResidentProfileDrawer Open State: ${isOpen}, Selected ID: ${selectedProfileId}`);
  }, [isOpen, selectedProfileId]);

  const { data: response, isLoading, isError } = useQuery({
    queryKey: ['residents', 'profile', selectedProfileId],
    queryFn: async () => {
      console.log(`[DIAGNOSTIC] ResidentProfileDrawer API Fetch initiated for profileId: ${selectedProfileId}`);
      const res = await fetchApi(`/tenants/profiles/${selectedProfileId}`);
      console.log("[DIAGNOSTIC] ResidentProfileDrawer API Response received:", res);
      return res;
    },
    enabled: !!selectedProfileId && isOpen,
  });

  const profile = response?.data;

  // Helpers to parse stay duration
  const calculateStayDuration = (inDate: string, outDate?: string | null) => {
    const start = new Date(inDate).getTime();
    const end = outDate ? new Date(outDate).getTime() : Date.now();
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) return `${diffDays} Day${diffDays !== 1 ? 's' : ''}`;
    const months = (diffDays / 30.4).toFixed(1);
    return `${months} Month${parseFloat(months) !== 1 ? 's' : ''}`;
  };

  // Helper to parse Aadhaar Base64 documents from kycDocUrl
  const getKycDocs = (kycDocUrl?: string | null) => {
    if (!kycDocUrl) return null;
    try {
      if (kycDocUrl.startsWith('{')) {
        const parsed = JSON.parse(kycDocUrl);
        return {
          front: parsed.front || null,
          back: parsed.back || null,
        };
      }
    } catch (e) {
      console.error('Failed to parse kycDocUrl:', e);
    }
    // Fallback if it is a legacy comma-separated string or single URL
    return {
      front: kycDocUrl,
      back: null,
    };
  };

  const kycDocs = getKycDocs(profile?.globalTenant?.kycDocUrl);

  // Financial aggregates
  const invoices = profile?.invoices || [];
  
  const totalRentPaid = invoices
    .filter((inv: any) => inv.type === 'RENT' && inv.status === 'PAID')
    .reduce((sum: number, inv: any) => sum + inv.amount, 0);
    
  const outstandingRent = invoices
    .filter((inv: any) => inv.type === 'RENT' && inv.status !== 'PAID')
    .reduce((sum: number, inv: any) => sum + inv.amount, 0);
    
  const securityDepositHeld = invoices
    .filter((inv: any) => inv.type === 'SECURITY_DEPOSIT' && inv.status === 'PAID')
    .reduce((sum: number, inv: any) => sum + inv.amount, 0);

  const outstandingTotal = invoices
    .filter((inv: any) => inv.status !== 'PAID')
    .reduce((sum: number, inv: any) => sum + inv.amount, 0);

  const complaints = profile?.complaints || [];

  console.log(`[DIAGNOSTIC] ResidentProfileDrawer render start. is_open: ${isOpen}, is_loading: ${isLoading}, has_profile: ${!!profile}`);

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && closeProfile()}>
        <SheetContent className="w-full sm:max-w-2xl bg-black text-white border-zinc-900 flex flex-col p-0 overflow-y-auto h-full">
          {isLoading && (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4 p-8">
              <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest animate-pulse">
                Resolving Resident STAY Ledger...
              </p>
            </div>
          )}

          {isError && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <AlertCircle className="h-10 w-10 text-red-500" />
              <p className="text-sm text-red-400 font-bold">Failed to load resident stay ledger</p>
              <Button onClick={closeProfile} size="sm" variant="outline" className="border-zinc-800">
                Close Drawer
              </Button>
            </div>
          )}

          {!isLoading && !isError && profile && (
            <div className="flex flex-col h-full divide-y divide-zinc-900">
              {/* Header Context */}
              <div className="p-6 space-y-3.5 bg-zinc-950/40">
                <SheetHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded border inline-block
                        ${profile.status === 'ACTIVE' ? 'text-green-400 bg-green-500/10 border-green-500/15' : 
                          profile.status === 'NOTICE' ? 'text-amber-400 bg-amber-500/10 border-amber-500/15' : 
                          'text-zinc-400 bg-zinc-900 border-zinc-850'}`}
                      >
                        {profile.status === 'ACTIVE' ? 'Active Resident' : 
                         profile.status === 'NOTICE' ? 'Serving Notice' : 'Past Stay (Historical)'}
                      </span>
                      <SheetTitle className="text-2xl font-black text-white mt-2">
                        {profile.globalTenant?.name || 'Resident Details'}
                      </SheetTitle>
                      <SheetDescription className="text-zinc-500 text-xs mt-1">
                        Resident Profile stay ledger dashboard.
                      </SheetDescription>
                    </div>

                    <div className="flex items-center gap-1 text-[10px] font-black text-green-400 bg-green-500/5 border border-green-500/15 px-2.5 py-1 rounded-lg">
                      <ShieldCheck className="h-4 w-4" /> KYC Verified
                    </div>
                  </div>
                </SheetHeader>
              </div>

              {/* Scrollable Information Body */}
              <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                
                {/* 1. PERSONAL INFORMATION */}
                <div className="space-y-3">
                  <h5 className="text-[11px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    Personal Information
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-zinc-950 p-4 border border-zinc-900 rounded-xl">
                    <div className="flex items-center gap-3 text-xs">
                      <Phone className="h-4 w-4 text-zinc-500 shrink-0" />
                      <div>
                        <p className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold">WhatsApp Phone</p>
                        <p className="text-zinc-200 font-extrabold mt-0.5">{profile.globalTenant?.phone || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs border-t border-zinc-900/50 md:border-t-0 md:border-l pl-0 md:pl-4 pt-3.5 md:pt-0">
                      <Mail className="h-4 w-4 text-zinc-500 shrink-0" />
                      <div className="truncate">
                        <p className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold">Email Address</p>
                        <p className="text-zinc-200 font-extrabold mt-0.5 truncate max-w-[200px]" title={profile.globalTenant?.email}>
                          {profile.globalTenant?.email || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. STAY SNAPSHOT */}
                <div className="space-y-3">
                  <h5 className="text-[11px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Stay History & Snapshot
                  </h5>
                  <div className="grid grid-cols-2 gap-4 bg-zinc-950 p-4 border border-zinc-900 rounded-xl text-xs">
                    <div>
                      <span className="text-[9px] text-zinc-500 block uppercase tracking-wider font-bold">Allocated Bed</span>
                      <span className="font-extrabold text-sm text-zinc-200 block mt-0.5">
                        Room {profile.room?.number || profile.historicalRoomNumber || 'N/A'} — Bed {profile.bed?.bedNumber || profile.historicalBedNumber || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-500 block uppercase tracking-wider font-bold">Stay Duration</span>
                      <span className="font-extrabold text-sm text-zinc-200 block mt-0.5">
                        {calculateStayDuration(profile.moveInDate, profile.moveOutDate)}
                      </span>
                    </div>
                    <div className="pt-3 border-t border-zinc-900">
                      <span className="text-[9px] text-zinc-500 block uppercase tracking-wider font-bold">Move-In Date</span>
                      <span className="font-extrabold text-zinc-300 block mt-0.5">
                        {new Date(profile.moveInDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                    <div className="pt-3 border-t border-zinc-900">
                      <span className="text-[9px] text-zinc-500 block uppercase tracking-wider font-bold">Move-Out Date</span>
                      <span className="font-extrabold text-zinc-300 block mt-0.5">
                        {profile.moveOutDate 
                          ? new Date(profile.moveOutDate).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })
                          : 'Active Stayer'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2.5 Dedicated Security Deposit Card */}
                <div className="space-y-3">
                  <h5 className="text-[11px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Security Deposit
                  </h5>
                  <div className="bg-zinc-950 p-4 border border-zinc-900 rounded-xl space-y-4">
                    <div className="flex justify-between items-center border-b border-zinc-900/60 pb-3">
                      <div>
                        <span className="text-[9px] text-zinc-500 block uppercase tracking-wider font-bold">Deposit Amount</span>
                        <span className="font-black text-lg text-blue-400 block mt-0.5">
                          ₹{(profile.securityDeposit ?? 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded border inline-block
                        ${profile.securityDepositStatus === 'COLLECTED' 
                          ? 'text-green-400 bg-green-500/10 border-green-500/15' 
                          : 'text-amber-400 bg-amber-500/10 border-amber-500/15'}`}
                      >
                        {profile.securityDepositStatus === 'COLLECTED' ? 'Collected' : 'Pending'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-[9px] text-zinc-500 block uppercase tracking-wider font-bold">Collected On</span>
                        <span className="font-extrabold text-zinc-300 block mt-0.5">
                          {profile.depositCollectedAt 
                            ? new Date(profile.depositCollectedAt).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })
                            : 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-zinc-500 block uppercase tracking-wider font-bold">Payment Mode</span>
                        <span className="font-extrabold text-zinc-300 block mt-0.5 uppercase">
                          {profile.invoices.find((inv: any) => inv.type === 'SECURITY_DEPOSIT' && inv.status === 'PAID')?.paymentMode || 'N/A'}
                        </span>
                      </div>
                      <div className="pt-3 border-t border-zinc-900/60 col-span-2">
                        <span className="text-[9px] text-zinc-500 block uppercase tracking-wider font-bold">Refund Status</span>
                        <span className="font-extrabold text-zinc-300 block mt-0.5">
                          {profile.depositRefundedAt ? (
                            <span className="text-amber-400">
                              Refunded ₹{profile.depositRefundedAmount?.toLocaleString('en-IN')} via {profile.depositRefundMode} on {new Date(profile.depositRefundedAt).toLocaleDateString('en-IN')}
                            </span>
                          ) : (
                            <span className="text-zinc-500">Not Refunded</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. KYC IDENTITY DOCUMENTS */}
                <div className="space-y-3">
                  <h5 className="text-[11px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Identity Documents (Aadhaar KYC)
                  </h5>
                  {kycDocs ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-zinc-950 p-4 border border-zinc-900 rounded-xl">
                      {/* Aadhaar Front */}
                      <div className="space-y-2">
                        <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold block">Aadhaar Front Side</span>
                        {kycDocs.front && kycDocs.front.startsWith('data:') ? (
                          <div className="relative border border-zinc-800 rounded-lg overflow-hidden h-28 group">
                            <img src={kycDocs.front} alt="Aadhaar Front" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity gap-2">
                              <button 
                                onClick={() => setFullscreenImage(kycDocs.front)}
                                className="p-1.5 bg-zinc-900 hover:bg-zinc-800 rounded border border-zinc-700 text-xs font-semibold flex items-center gap-1 select-none"
                              >
                                <ExternalLink className="h-3 w-3" /> Preview
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="h-28 border border-zinc-800 bg-zinc-900/10 border-dashed rounded-lg flex items-center justify-center text-[10px] text-zinc-500">
                            No front document preview (Legacy format)
                          </div>
                        )}
                      </div>

                      {/* Aadhaar Back */}
                      <div className="space-y-2">
                        <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold block">Aadhaar Back Side</span>
                        {kycDocs.back && kycDocs.back.startsWith('data:') ? (
                          <div className="relative border border-zinc-800 rounded-lg overflow-hidden h-28 group">
                            <img src={kycDocs.back} alt="Aadhaar Back" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity gap-2">
                              <button 
                                onClick={() => setFullscreenImage(kycDocs.back)}
                                className="p-1.5 bg-zinc-900 hover:bg-zinc-800 rounded border border-zinc-700 text-xs font-semibold flex items-center gap-1 select-none"
                              >
                                <ExternalLink className="h-3 w-3" /> Preview
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="h-28 border border-zinc-800 bg-zinc-900/10 border-dashed rounded-lg flex items-center justify-center text-[10px] text-zinc-500">
                            No back document preview
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 border border-dashed border-zinc-900 bg-zinc-950 rounded-xl text-center text-xs text-zinc-500 font-bold uppercase tracking-wider">
                      Identity documents not configured (Quick Added stay).
                    </div>
                  )}
                </div>                {/* 4. FINANCIAL LEDGER */}
                <div className="space-y-3">
                  <h5 className="text-[11px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5" />
                    Financial stay ledger
                  </h5>
                  <div className="space-y-3">
                    {/* 3 Summary Cards */}
                    <div className="grid grid-cols-3 gap-2.5 bg-zinc-950 p-4 border border-zinc-900 rounded-xl text-xs font-semibold">
                      <div className="space-y-0.5">
                        <span className="text-[8px] text-zinc-500 block uppercase font-bold tracking-wider">Total Rent Paid</span>
                        <span className="text-emerald-400 text-sm font-black">₹{totalRentPaid.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="space-y-0.5 border-l border-zinc-900 pl-2.5">
                        <span className="text-[8px] text-zinc-500 block uppercase font-bold tracking-wider">Outstanding Rent</span>
                        <span className={`text-sm font-black ${outstandingRent > 0 ? 'text-red-400 animate-pulse' : 'text-zinc-400'}`}>
                          ₹{outstandingRent.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="space-y-0.5 border-l border-zinc-900 pl-2.5">
                        <span className="text-[8px] text-zinc-500 block uppercase font-bold tracking-wider">Total Outstanding</span>
                        <span className={`text-sm font-black ${outstandingTotal > 0 ? 'text-red-400' : 'text-zinc-400'}`}>
                          ₹{outstandingTotal.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    {/* Detailed Transaction History Ledger */}
                    <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-none">
                      {invoices.length === 0 ? (
                        <div className="p-4 text-center text-[10px] text-zinc-500 font-bold uppercase tracking-wider border border-dashed border-zinc-900 rounded-xl bg-zinc-950/20">
                          No financial transactions recorded.
                        </div>
                      ) : (
                        invoices.map((inv: any) => (
                          <div key={inv.id} className="p-3.5 space-y-2 text-xs border border-zinc-900 bg-zinc-950/40 rounded-xl flex flex-col hover:border-zinc-800 transition-colors">
                            <div className="flex justify-between items-start">
                              <div className="space-y-0.5">
                                <span className="font-extrabold text-zinc-200 block text-xs">
                                  {inv.type === 'SECURITY_DEPOSIT' 
                                    ? (inv.status === 'PAID' ? 'Security Deposit Collected' : 'Security Deposit Pending') 
                                    : 'Rent Invoice'}
                                </span>
                                <span className="text-[9px] text-zinc-500 block font-bold uppercase tracking-wide">
                                  Invoice Date: {new Date(inv.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </span>
                              </div>
                              <div className="text-right space-y-0.5">
                                <span className="text-xs font-black text-zinc-150">₹{inv.amount.toLocaleString('en-IN')}</span>
                                <span className={`text-[8px] font-black uppercase tracking-wider border px-1.5 py-0.5 rounded block text-center w-fit ml-auto
                                  ${inv.status === 'PAID' ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' : 
                                    inv.status === 'PAST_DUE' ? 'text-red-400 border-red-500/20 bg-red-500/5' : 
                                    'text-amber-400 border-amber-500/20 bg-amber-500/5'}`}
                                >
                                  {inv.status}
                                </span>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 text-[9px] text-zinc-500 pt-1.5 border-t border-zinc-900/60 font-bold uppercase tracking-wider">
                              <div>
                                <span className="text-zinc-500 block text-[8px]">Due Date</span>
                                <span className="text-zinc-350">{new Date(inv.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                              </div>
                              {inv.status === 'PAID' && inv.paidAt && (
                                <div className="text-right">
                                  <span className="text-zinc-500 block text-[8px]">Payment Date</span>
                                  <span className="text-zinc-350">{new Date(inv.paidAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                </div>
                              )}
                            </div>

                            {inv.status === 'PAID' && (inv.paymentMode || inv.razorpayPayId || inv.referenceId) && (
                              <div className="bg-zinc-900/35 border border-zinc-900/80 p-2 rounded-lg text-[9px] text-zinc-500 flex justify-between items-center font-bold tracking-wide">
                                <span>Method: <strong className="text-zinc-300 uppercase">{inv.paymentMode || (inv.razorpayPayId ? 'UPI/ONLINE' : 'N/A')}</strong></span>
                                {(inv.referenceId || inv.razorpayPayId) && (
                                  <span className="font-mono text-[9px] truncate max-w-[170px]" title={inv.referenceId || inv.razorpayPayId}>
                                    Ref: {inv.referenceId || inv.razorpayPayId}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* 5. COMPLAINTS TICKETS */}
                <div className="space-y-3">
                  <h5 className="text-[11px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                    <ClipboardList className="h-3.5 w-3.5" />
                    Complaint Ticket History
                  </h5>
                  <div className="space-y-2 max-h-48 overflow-y-auto border border-zinc-900 rounded-xl divide-y divide-zinc-900 bg-zinc-950/20 scrollbar-none">
                    {complaints.length === 0 ? (
                      <div className="p-4 text-center text-[10px] text-zinc-500 font-bold uppercase tracking-wider">No complaint tickets logged.</div>
                    ) : (
                      complaints.map((c: any) => (
                        <div key={c.id} className="p-3 flex justify-between items-center text-xs font-semibold">
                          <div className="space-y-0.5 w-2/3">
                            <span className="text-zinc-200 block truncate">{c.description}</span>
                            <span className="text-[10px] text-zinc-500 block uppercase font-bold">
                              Category: {c.category}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-black uppercase tracking-wider border px-2 py-0.5 rounded
                              ${c.status === 'RESOLVED' ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' : 
                                c.status === 'ESCALATED' ? 'text-red-400 border-red-500/20 bg-red-500/5' : 
                                'text-amber-400 border-amber-500/20 bg-amber-500/5'}`}
                            >
                              {c.status}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

              {/* Footer Panel */}
              <div className="p-4 bg-zinc-950 flex justify-end">
                <Button onClick={closeProfile} className="bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white uppercase tracking-widest font-black text-[10px] py-2 px-5">
                  Close stay ledger
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Fullscreen Document Preview Modal */}
      {fullscreenImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-in fade-in duration-200">
          <button 
            onClick={() => setFullscreenImage(null)}
            className="absolute top-4 right-4 p-2 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-full transition-colors select-none"
            title="Close Preview"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="w-full max-w-3xl h-[80vh] flex items-center justify-center border border-zinc-800 rounded-2xl overflow-hidden p-2 bg-zinc-950/40">
            <img src={fullscreenImage} alt="KYC Fullscreen" className="max-w-full max-h-full object-contain rounded-xl" />
          </div>
        </div>
      )}
    </>
  );
}
