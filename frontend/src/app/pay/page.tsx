'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CreditCard, CheckCircle2, AlertTriangle, ExternalLink, ShieldCheck, IndianRupee, QrCode, Building2, User, FileText, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaymentDetails {
  referenceId: string;
  razorpayPaymentLinkId: string | null;
  paymentUrl: string | null;
  amount: number;
  status: 'ACTIVE' | 'PARTIALLY_PAID' | 'PAID' | 'EXPIRED' | 'CANCELLED' | 'FAILED';
  expiresAt: string | null;
  residentName: string;
  typeLabel: string;
  invoiceNumber: string;
  isSettled: boolean;
  isExpired: boolean;
  invoiceId: string;
}

export default function PublicPaymentPage() {
  const searchParams = useSearchParams();
  const referenceId = searchParams.get('referenceId');
  const amountParam = searchParams.get('amount');

  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<PaymentDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Checkout States
  const [selectedMethod, setSelectedMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [paying, setPaying] = useState(false);
  const [paidReceipt, setPaidReceipt] = useState<any | null>(null);

  // Environment Flags
  const isDevelopment = process.env.NODE_ENV === 'development' || typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const fetchDetails = async () => {
    if (!referenceId) {
      setError('Invalid URL: referenceId is required.');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://pgos-production-d612.up.railway.app/api';
      const res = await fetch(`${apiBase}/payments/link/details/${referenceId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to load checkout details.');
      }
      const json = await res.json();
      setDetails(json.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Unable to connect to payment server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [referenceId]);

  const handleSimulatePayment = async () => {
    if (!details) return;
    setPaying(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://pgos-production-d612.up.railway.app/api';
      const transactionId = `pay_mock_${Math.random().toString(36).substr(2, 9)}`;
      
      const res = await fetch(`${apiBase}/payments/simulate-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenceId: details.referenceId,
          transactionId,
          amountPaid: details.amount,
          paymentMethod: selectedMethod.toUpperCase()
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Simulation checkout failed.');
      }

      const json = await res.json();
      setPaidReceipt(json.data);
      setDetails(prev => prev ? { ...prev, status: 'PAID', isSettled: true } : null);
    } catch (err: any) {
      setError(err.message || 'Payment simulation failed.');
    } finally {
      setPaying(false);
    }
  };

  const handleRedirectToRazorpay = () => {
    if (details?.paymentUrl) {
      window.location.href = details.paymentUrl;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
        <Loader2 className="h-10 w-10 text-emerald-500 animate-spin mb-4" />
        <p className="text-zinc-400 text-sm font-semibold tracking-wide animate-pulse">Initializing PGOS Secure Gateway...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-8 max-w-md w-full shadow-2xl text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Payment Error</h3>
            <p className="text-zinc-400 text-xs mt-2 leading-relaxed">{error}</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={fetchDetails} className="flex-1 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 font-bold text-xs h-11 rounded-xl">
              Retry
            </Button>
            <Button onClick={() => window.close()} variant="ghost" className="flex-1 border border-zinc-850 text-zinc-400 h-11 rounded-xl text-xs font-bold">
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!details) return null;

  // 1. Expired Link Block
  if (details.status === 'EXPIRED') {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-8 max-w-md w-full shadow-2xl text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-amber-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Payment Link Expired</h3>
            <p className="text-zinc-400 text-xs mt-2 leading-relaxed">
              This payment request is no longer active. Old links are automatically disabled after 7 days for complete financial security.
            </p>
          </div>
          <div className="bg-zinc-900/40 rounded-xl p-4 border border-zinc-850 text-left text-[11px] space-y-1.5 text-zinc-400">
            <div className="flex justify-between"><span>Resident:</span><span className="font-bold text-white">{details.residentName}</span></div>
            <div className="flex justify-between"><span>Invoice:</span><span className="font-mono text-zinc-300">{details.invoiceNumber}</span></div>
            <div className="flex justify-between"><span>Expired At:</span><span>{details.expiresAt ? new Date(details.expiresAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '7 Days Default'}</span></div>
          </div>
          <Button 
            onClick={() => window.open(`https://wa.me/?text=Hi, my payment link ${details.invoiceNumber} has expired. Please regenerate a new payment request link.`, '_blank')}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs h-12 rounded-xl flex items-center justify-center gap-2"
          >
            Contact Owner
          </Button>
        </div>
      </div>
    );
  }

  // 2. Duplicate Payment settled / paid block
  if (details.status === 'PAID' && !paidReceipt) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-8 max-w-md w-full shadow-2xl text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Invoice Already Settled</h3>
            <p className="text-zinc-400 text-xs mt-2 leading-relaxed">
              This invoice has already been fully settled. No additional payment is required for this request.
            </p>
          </div>
          <div className="bg-zinc-900/40 rounded-xl p-4 border border-zinc-850 text-left text-[11px] space-y-1.5 text-zinc-400">
            <div className="flex justify-between"><span>Resident:</span><span className="font-bold text-white">{details.residentName}</span></div>
            <div className="flex justify-between"><span>Invoice:</span><span className="font-mono text-zinc-300">{details.invoiceNumber}</span></div>
            <div className="flex justify-between"><span>Amount Paid:</span><span className="text-emerald-450 font-bold">₹{details.amount.toLocaleString('en-IN')}</span></div>
          </div>
          <Button onClick={() => window.close()} className="w-full bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white font-bold text-xs h-12 rounded-xl">
            Close Checkout
          </Button>
        </div>
      </div>
    );
  }

  // 3. Successful Simulated Payment Receipt screen
  if (paidReceipt) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-400 animate-bounce" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Payment Successful</h3>
              <p className="text-zinc-450 text-[10px] uppercase font-bold tracking-widest mt-1">Transaction Confirmed via Webhook</p>
            </div>
          </div>

          <div className="border border-dashed border-zinc-800 bg-zinc-900/30 rounded-2xl p-5 space-y-3.5 text-xs text-zinc-400">
            <div className="flex justify-between pb-2 border-b border-zinc-850">
              <span>Receipt Number:</span>
              <span className="font-mono text-zinc-200 font-bold">{paidReceipt.receiptNumber}</span>
            </div>
            <div className="flex justify-between pb-2 border-b border-zinc-850">
              <span>Resident Name:</span>
              <span className="text-zinc-250 font-semibold">{paidReceipt.residentName}</span>
            </div>
            <div className="flex justify-between pb-2 border-b border-zinc-850">
              <span>Invoice Ref:</span>
              <span className="font-mono text-zinc-300">{paidReceipt.invoiceNumber}</span>
            </div>
            <div className="flex justify-between pb-2 border-b border-zinc-850">
              <span>Payment Mode:</span>
              <span className="uppercase text-white font-extrabold">{paidReceipt.paymentMethod}</span>
            </div>
            <div className="flex justify-between pb-2 border-b border-zinc-850">
              <span>Transaction ID:</span>
              <span className="font-mono text-[10px] text-zinc-400">{paidReceipt.transactionId}</span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-white font-bold">Total Settled:</span>
              <span className="text-emerald-450 font-extrabold text-base">₹{paidReceipt.amount.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-xl p-3.5 text-[11px] text-emerald-400 flex items-start gap-2.5 leading-relaxed">
            <ShieldCheck className="h-4.5 w-4.5 stroke-[2.5] flex-shrink-0 mt-0.5" />
            <p>
              Automated reconciliation complete. Resident stay ledger, outstanding dues, damage records, and vacancy settlement accounts have updated dynamically.
            </p>
          </div>

          <Button onClick={() => window.close()} className="w-full bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white font-bold text-xs h-12 rounded-xl">
            Done
          </Button>
        </div>
      </div>
    );
  }

  // 4. Primary Checkout Page
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="max-w-4xl w-full grid md:grid-cols-5 gap-6">
        
        {/* Left Side: Summary Card */}
        <div className="md:col-span-2 space-y-4">
          <div className="bg-zinc-950 border border-zinc-850 rounded-3xl p-6 relative overflow-hidden shadow-2xl">
            {/* Sleek Gradient top strip */}
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-emerald-500 via-primary to-amber-500" />
            
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-zinc-400 font-bold text-[10px] uppercase tracking-widest">
                <Building2 className="h-3.5 w-3.5 text-primary" /> PGOS Secure checkout
              </div>

              <div>
                <span className="text-[10px] text-zinc-500 uppercase font-black block tracking-widest">Amount Due</span>
                <span className="text-3xl font-black text-primary">₹{details.amount.toLocaleString('en-IN')}</span>
              </div>

              <div className="border-t border-zinc-900 pt-5 space-y-4 text-xs">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-zinc-900 rounded-lg border border-zinc-850"><User className="h-4 w-4 text-zinc-400" /></div>
                  <div>
                    <span className="text-[9px] text-zinc-500 block uppercase font-bold tracking-wider">Resident Name</span>
                    <span className="font-bold text-zinc-200">{details.residentName}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-zinc-900 rounded-lg border border-zinc-850"><FileText className="h-4 w-4 text-zinc-400" /></div>
                  <div>
                    <span className="text-[9px] text-zinc-500 block uppercase font-bold tracking-wider">Bill Reference</span>
                    <span className="font-mono text-zinc-300 font-semibold">{details.invoiceNumber}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-zinc-900 rounded-lg border border-zinc-850"><Building2 className="h-4 w-4 text-zinc-400" /></div>
                  <div>
                    <span className="text-[9px] text-zinc-500 block uppercase font-bold tracking-wider">Payment Category</span>
                    <span className="font-semibold text-zinc-200">{details.typeLabel}</span>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900/30 border border-zinc-850 rounded-xl p-3 text-[10px] text-zinc-500 leading-relaxed flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                <p>Protected by PGOS dynamic cryptographic payment hashes. Audits are securely logged in PG ledger records.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Payment Form */}
        <div className="md:col-span-3">
          <div className="bg-zinc-950 border border-zinc-850 rounded-3xl p-6 shadow-2xl space-y-6">
            <h3 className="text-lg font-extrabold text-white">Select Payment Mode</h3>

            {/* If Razorpay link is present and we want real integration redirect */}
            {details.paymentUrl && !details.paymentUrl.includes('/pay?referenceId=') && (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-950/20 border border-emerald-900/40 rounded-2xl space-y-2 text-xs">
                  <span className="font-bold text-emerald-450 flex items-center gap-1.5 uppercase text-[10px] tracking-wider">
                    <ShieldCheck className="h-3.5 w-3.5" /> Official Razorpay Checkout Active
                  </span>
                  <p className="text-zinc-400 leading-relaxed text-[11px]">
                    This checkout is connected to the PG owner's verified Razorpay sandbox/live merchants credentials. Settle outstanding fees instantly via cards, UPI, or banking systems securely.
                  </p>
                </div>

                <Button 
                  onClick={handleRedirectToRazorpay}
                  className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg hover:shadow-emerald-600/10 cursor-pointer"
                >
                  Proceed to Razorpay Checkout <ArrowRight className="h-4.5 w-4.5 stroke-[2.5]" />
                </Button>
              </div>
            )}

            {/* Test Mode Simulator panel (Allowed in development/local mode only!) */}
            {(!details.paymentUrl || details.paymentUrl.includes('/pay?referenceId=')) && (
              <>
                {isDevelopment ? (
                  <div className="space-y-6">
                    {/* Method Selector Tabs */}
                    <div className="grid grid-cols-3 gap-2 bg-zinc-900 p-1.5 rounded-xl border border-zinc-850 text-xs">
                      <button 
                        onClick={() => setSelectedMethod('upi')}
                        className={`py-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${selectedMethod === 'upi' ? 'bg-zinc-850 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        <QrCode className="h-3.5 w-3.5" /> UPI
                      </button>
                      <button 
                        onClick={() => setSelectedMethod('card')}
                        className={`py-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${selectedMethod === 'card' ? 'bg-zinc-850 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        <CreditCard className="h-3.5 w-3.5" /> Cards
                      </button>
                      <button 
                        onClick={() => setSelectedMethod('netbanking')}
                        className={`py-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${selectedMethod === 'netbanking' ? 'bg-zinc-850 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        <Building2 className="h-3.5 w-3.5" /> NetBanking
                      </button>
                    </div>

                    {/* Method Content Panel */}
                    <div className="border border-zinc-850 rounded-2xl p-5 min-h-[140px] flex flex-col justify-center bg-zinc-900/20">
                      {selectedMethod === 'upi' && (
                        <div className="text-center space-y-3">
                          <div className="mx-auto w-12 h-12 bg-zinc-850 rounded-full border border-zinc-800 flex items-center justify-center">
                            <QrCode className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-bold text-xs">Dynamic UPI ID Simulation</p>
                            <p className="text-[10px] text-zinc-500 mt-1">Simulate paying securely via mock UPI handles (e.g. resident@ybl).</p>
                          </div>
                        </div>
                      )}

                      {selectedMethod === 'card' && (
                        <div className="space-y-3">
                          <span className="font-bold text-[10px] text-zinc-500 uppercase tracking-wide block">Mock Card Information</span>
                          <div className="grid grid-cols-4 gap-2 text-xs">
                            <input disabled placeholder="4111 2222 3333 4444" className="col-span-4 bg-zinc-900 border border-zinc-850 rounded-lg p-2.5 font-mono text-zinc-500 select-none text-[11px]" />
                            <input disabled placeholder="12 / 28" className="col-span-2 bg-zinc-900 border border-zinc-850 rounded-lg p-2.5 font-mono text-zinc-500 text-center select-none text-[11px]" />
                            <input disabled placeholder="***" className="col-span-2 bg-zinc-900 border border-zinc-850 rounded-lg p-2.5 font-mono text-zinc-500 text-center select-none text-[11px]" />
                          </div>
                        </div>
                      )}

                      {selectedMethod === 'netbanking' && (
                        <div className="text-center space-y-3">
                          <div className="mx-auto w-12 h-12 bg-zinc-850 rounded-full border border-zinc-800 flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-bold text-xs">Simulated NetBanking Gateway</p>
                            <p className="text-[10px] text-zinc-500 mt-1">Select from mock HDFC, ICICI, or SBI bank portals under sandbox conditions.</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <Button
                      onClick={handleSimulatePayment}
                      disabled={paying}
                      className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-emerald-600/10"
                    >
                      {paying ? (
                        <>
                          <Loader2 className="h-4.5 w-4.5 text-white animate-spin" /> Settle payment...
                        </>
                      ) : (
                        <>
                          Complete Simulation payment <ShieldCheck className="h-4.5 w-4.5 stroke-[2.5]" />
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-5 bg-red-950/20 border border-red-900/40 rounded-2xl text-center space-y-4">
                      <div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                        <AlertTriangle className="h-6 w-6 text-red-500" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-white">Simulated checkout is completely disabled in production.</h4>
                        <p className="text-zinc-500 text-[11px] mt-2 leading-relaxed">
                          Unable to generate a real Razorpay payment link. Please ask the PG owner to verify their Razorpay configuration or retry in a few moments.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={fetchDetails} className="flex-1 bg-zinc-900 border border-zinc-850 hover:bg-zinc-800 text-white font-bold text-xs h-11 rounded-xl">
                        Retry
                      </Button>
                      <Button onClick={() => window.close()} variant="ghost" className="flex-1 border border-zinc-850 text-zinc-400 h-11 rounded-xl text-xs font-bold">
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}
