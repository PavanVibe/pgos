'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { usePaymentRequestStore } from '@/store/usePaymentRequestStore';
import { Button } from '@/components/ui/button';
import { CreditCard, User, Calendar, IndianRupee, FileText, Send, QrCode, Copy, Check, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';
import { fetchApi } from '@/lib/api';
import { toast } from 'sonner';
import PaymentQRCodeModal from './PaymentQRCodeModal';

export default function PaymentPreviewDrawer() {
  const {
    isPaymentRequestOpen,
    paymentRequestType,
    paymentRequestTargetId,
    paymentRequestDetails,
    closePaymentRequest
  } = usePaymentRequestStore();

  console.log("[DIAGNOSTIC] PaymentPreviewDrawer rendering. isPaymentRequestOpen:", isPaymentRequestOpen);

  useEffect(() => {
    console.log("[DIAGNOSTIC] PaymentPreviewDrawer open effect triggered. isPaymentRequestOpen:", isPaymentRequestOpen);
  }, [isPaymentRequestOpen]);

  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<{ paymentUrl: string; razorpayPaymentLinkId: string } | null>(null);

  if (!isPaymentRequestOpen || !paymentRequestType || !paymentRequestTargetId || !paymentRequestDetails) {
    console.log("[DIAGNOSTIC] PaymentPreviewDrawer hidden due to empty or closed state.");
    return null;
  }

  const { invoiceNumber, residentName, residentPhone, amount, dueDate } = paymentRequestDetails;

  const getDuesLabel = () => {
    switch (paymentRequestType) {
      case 'RENT': return 'Rent Due';
      case 'SECURITY_DEPOSIT': return 'Deposit Due';
      case 'DAMAGE': return 'Damage Charges';
      default: return 'Outstanding Balance';
    }
  };

  const getInvoiceNumberFallback = () => {
    if (invoiceNumber) return invoiceNumber;
    return `${paymentRequestType.substr(0, 3)}-${paymentRequestTargetId.substr(0, 8).toUpperCase()}`;
  };

  // Internal helper to get/generate the payment link via backend API
  const getOrGeneratePaymentLink = async () => {
    if (generatedLink) return generatedLink;

    setLoading(true);
    try {
      const response = await fetchApi('/payments/link/generate', {
        method: 'POST',
        body: JSON.stringify({
          type: paymentRequestType,
          id: paymentRequestTargetId,
          amount: amount
        })
      });

      if (response && response.data) {
        const linkData = {
          paymentUrl: response.data.paymentUrl,
          razorpayPaymentLinkId: response.data.razorpayPaymentLinkId
        };
        setGeneratedLink(linkData);
        setLoading(false);
        return linkData;
      }
      throw new Error('API returned empty payment link data.');
    } catch (err: any) {
      setLoading(false);
      toast.error(err.message || 'Failed to generate online payment link.');
      return null;
    }
  };

  const handleSendPaymentRequest = async () => {
    // 1. Direct Phone Validation
    if (!residentPhone) {
      toast.error("Resident phone number is required before requesting payment.");
      return;
    }

    const link = await getOrGeneratePaymentLink();
    if (!link) return;

    // Template message
    const message = `Hi ${residentName},\n\nYour payment is due.\n\nType: ${getDuesLabel()}\nAmount: ₹${amount.toLocaleString('en-IN')}\n\nPay securely here:\n${link.paymentUrl}\n\nThank you.`;

    const encodedMessage = encodeURIComponent(message);
    const cleanPhone = residentPhone.replace(/[^\d+]/g, '');
    const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone.slice(1) : cleanPhone;
    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
    toast.success('WhatsApp payment request link opened directly.');
  };

  const handleShowQR = async () => {
    const link = await getOrGeneratePaymentLink();
    if (!link) return;
    setQrOpen(true);
  };

  const handleCopyLink = async () => {
    const link = await getOrGeneratePaymentLink();
    if (!link) return;

    navigator.clipboard.writeText(link.paymentUrl);
    setCopied(true);
    toast.success('Payment Link copied to clipboard.');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerateLink = async () => {
    setLoading(true);
    setGeneratedLink(null);
    try {
      const response = await fetchApi('/payments/link/generate', {
        method: 'POST',
        body: JSON.stringify({
          type: paymentRequestType,
          id: paymentRequestTargetId,
          amount: amount,
          forceRegenerate: true
        })
      });

      if (response && response.data) {
        const linkData = {
          paymentUrl: response.data.paymentUrl,
          razorpayPaymentLinkId: response.data.razorpayPaymentLinkId
        };
        setGeneratedLink(linkData);
        toast.success('Payment Link regenerated successfully.');
      } else {
        throw new Error('Regeneration returned empty link.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to regenerate payment link.');
    } finally {
      setLoading(false);
    }
  };

  const dateFormatted = dueDate 
    ? new Date(dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Immediate';

  return (
    <>
      <Sheet open={isPaymentRequestOpen} onOpenChange={(open) => !open && closePaymentRequest()}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto bg-black text-white border-zinc-800">
          <SheetHeader>
            <SheetTitle className="text-zinc-200 flex items-center gap-2 text-xl font-bold">
              <CreditCard className="h-5 w-5 text-primary" /> Request Payment
            </SheetTitle>
            <SheetDescription className="text-zinc-400">
              Review and preview the invoice details before sharing the payment request or generating QR.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            
            {/* Step 4: Professional Invoice Preview Voucher */}
            <div className="relative border border-zinc-800 bg-zinc-950/40 rounded-2xl p-5 shadow-2xl overflow-hidden select-none">
              {/* Sleek Gradient Accent */}
              <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-primary via-amber-400 to-amber-500" />
              
              <div className="flex justify-between items-start pb-4 border-b border-zinc-900">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Invoice Voucher</span>
                  <h4 className="text-sm font-bold text-white mt-0.5">{getInvoiceNumberFallback()}</h4>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-900 text-zinc-350 border border-zinc-800 uppercase tracking-wide">
                  {getDuesLabel()}
                </span>
              </div>

              <div className="space-y-4 pt-4 text-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-850">
                    <User className="h-4 w-4 text-zinc-400" />
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block uppercase font-bold tracking-wider">Resident Name</span>
                    <span className="font-semibold text-zinc-200">{residentName}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-850">
                    <Calendar className="h-4 w-4 text-zinc-400" />
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block uppercase font-bold tracking-wider">Due Date</span>
                    <span className="font-semibold text-zinc-200">{dateFormatted}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2 border-t border-zinc-900/60">
                  <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                    <IndianRupee className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block uppercase font-bold tracking-wider">Amount Due</span>
                    <span className="text-xl font-extrabold text-primary">₹{amount.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Redesigned Payment Request Details List */}
            <div className="bg-zinc-950/60 border border-zinc-900 rounded-2xl p-4 space-y-3.5 text-xs">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">System Reference Details</span>
              <div className="flex justify-between items-center py-1 border-b border-zinc-900/60">
                <span className="text-zinc-500">Resident Name:</span>
                <span className="font-bold text-zinc-200">{residentName}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-zinc-900/60">
                <span className="text-zinc-500">Invoice Number:</span>
                <span className="font-mono text-zinc-300">{getInvoiceNumberFallback()}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-zinc-900/60">
                <span className="text-zinc-500">Payment Status:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${generatedLink ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                  {generatedLink ? 'PAYMENT_LINK_SENT' : 'UNPAID'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-zinc-900/60">
                <span className="text-zinc-500">Generated Time:</span>
                <span className="text-zinc-300 font-semibold">{new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-zinc-500">Expiry Time (7 Days):</span>
                <span className="text-zinc-355 font-semibold">{new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>

            {/* Actions Grid */}
            <div className="space-y-3">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">Collection Actions</span>
              
              <Button
                onClick={handleSendPaymentRequest}
                disabled={loading}
                className="w-full h-12 bg-emerald-600 text-white font-extrabold text-sm hover:bg-emerald-500 transition-all flex items-center justify-center gap-2 cursor-pointer rounded-xl"
              >
                {loading ? (
                  <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="h-4.5 w-4.5 stroke-[2.5]" />
                )}
                Send Payment Request
              </Button>

              <div className="grid grid-cols-3 gap-2 text-[10px]">
                <button
                  onClick={handleShowQR}
                  disabled={loading}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl bg-zinc-900 border border-zinc-850 hover:border-zinc-700 hover:text-white font-bold cursor-pointer transition-all disabled:opacity-50"
                >
                  <QrCode className="h-4 w-4 text-primary" /> Generate QR
                </button>
                <button
                  onClick={handleCopyLink}
                  disabled={loading}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl bg-zinc-900 border border-zinc-850 hover:border-zinc-700 hover:text-white font-bold cursor-pointer transition-all disabled:opacity-50"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 text-emerald-400 animate-bounce" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 text-primary" /> Copy Link
                    </>
                  )}
                </button>
                <button
                  onClick={handleRegenerateLink}
                  disabled={loading}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl bg-zinc-900 border border-zinc-850 hover:border-zinc-700 hover:text-white font-bold cursor-pointer transition-all disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4 text-amber-400" /> Regenerate
                </button>
              </div>
            </div>

            {/* Test Mode / Simulated Action Helper Banner */}
            <div className="bg-zinc-900/10 border border-dashed border-zinc-850 rounded-xl p-4 text-xs text-zinc-500 space-y-1.5 leading-relaxed">
              <div className="flex items-center gap-1.5 font-bold text-zinc-400 uppercase tracking-wide text-[10px]">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> Test Mode Simulation
              </div>
              <p>
                Online payment links are created using sandbox test links. Scan QR or pay links, and PGOS will automatically capture and settle ledgers in seconds without card verification fees.
              </p>
            </div>

            {/* Close Button */}
            <Button
              variant="ghost"
              onClick={closePaymentRequest}
              className="w-full border border-zinc-850 text-zinc-400 hover:text-white h-11 font-semibold rounded-xl"
            >
              Close Drawer
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {generatedLink && (
        <PaymentQRCodeModal 
          isOpen={qrOpen}
          onClose={() => setQrOpen(false)}
          paymentUrl={generatedLink.paymentUrl}
          residentName={residentName}
          residentPhone={residentPhone}
          amount={amount}
          type={getDuesLabel()}
        />
      )}
    </>
  );
}
