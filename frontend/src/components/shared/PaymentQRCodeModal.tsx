import { useState, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { X, Download, Share2, Check, Printer, Send } from 'lucide-react';
import { toast } from 'sonner';

interface PaymentQRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentUrl: string;
  residentName: string;
  residentPhone?: string;
  amount: number;
  type: string;
}

export default function PaymentQRCodeModal({
  isOpen,
  onClose,
  paymentUrl,
  residentName,
  residentPhone,
  amount,
  type
}: PaymentQRCodeModalProps) {
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(paymentUrl);
    setCopied(true);
    toast.success('Payment URL copied to clipboard.');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQR = () => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvas) {
      toast.error('Failed to locate QR code element.');
      return;
    }

    const pngUrl = canvas.toDataURL('image/png').replace('image/png', 'image/octet-stream');
    const downloadLink = document.createElement('a');
    downloadLink.href = pngUrl;
    downloadLink.download = `QR_${residentName.replace(/\s+/g, '_')}_${amount}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    toast.success('QR Code downloaded successfully.');
  };

  const handlePrintQR = () => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvas) {
      toast.error('Failed to locate QR code element.');
      return;
    }
    const dataUrl = canvas.toDataURL('image/png');
    const windowContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print QR Code</title>
        <style>
          body {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            font-family: sans-serif;
            text-align: center;
          }
          img {
            max-width: 250px;
            margin-bottom: 20px;
          }
          h2 { margin: 5px 0; font-size: 24px; }
          p { color: #555; margin: 5px 0; font-size: 16px; }
        </style>
      </head>
      <body>
        <img src="${dataUrl}" />
        <h2>${residentName}</h2>
        <p>${type} — ₹${amount.toLocaleString('en-IN')}</p>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          }
        </script>
      </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(windowContent);
      printWindow.document.close();
    } else {
      toast.error('Popup blocked. Please allow popups to print.');
    }
  };

  const handleSendQRWhatsApp = () => {
    const message = `Hi ${residentName},\n\nHere is your QR Code to scan and pay ₹${amount.toLocaleString('en-IN')} for ${type}:\n\n${paymentUrl}`;
    const encoded = encodeURIComponent(message);
    if (residentPhone) {
      const cleanPhone = residentPhone.replace(/[^\d+]/g, '');
      const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone.slice(1) : cleanPhone;
      window.open(`https://wa.me/${formattedPhone}?text=${encoded}`, '_blank');
    } else {
      window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
    }
    toast.success('QR WhatsApp request opened.');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-white shadow-2xl space-y-5 animate-in zoom-in duration-300">
        
        {/* Header */}
        <div className="flex justify-between items-center pb-2 border-b border-zinc-900">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-zinc-300">Scan & Pay</h3>
            <p className="text-xs text-zinc-500 mt-0.5">{residentName} — ₹{amount}</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 rounded-lg bg-zinc-900 border border-zinc-850 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* QR Display Area */}
        <div className="flex flex-col items-center justify-center py-4 bg-zinc-900/30 rounded-xl border border-zinc-900/50 relative">
          <div ref={canvasRef} className="p-4 bg-white rounded-xl shadow-xl">
            <QRCodeCanvas 
              value={paymentUrl} 
              size={180}
              level="H"
              includeMargin={false}
            />
          </div>
          <p className="text-[10px] text-zinc-500 mt-4 uppercase tracking-widest font-black">Scan using any UPI App</p>
        </div>

        {/* Details List */}
        <div className="space-y-1.5 text-xs bg-zinc-900/10 p-3 rounded-lg border border-zinc-900">
          <div className="flex justify-between">
            <span className="text-zinc-500">Billing Type:</span>
            <span className="font-bold text-zinc-300">{type}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Amount Due:</span>
            <span className="font-bold text-primary">₹{amount.toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* Actions Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            onClick={handleDownloadQR}
            className="flex items-center justify-center gap-1.5 p-3 rounded-xl bg-zinc-900 border border-zinc-850 hover:border-zinc-700 hover:text-white font-bold cursor-pointer transition-all"
          >
            <Download className="h-4 w-4 text-primary" /> Download
          </button>
          <button
            onClick={handlePrintQR}
            className="flex items-center justify-center gap-1.5 p-3 rounded-xl bg-zinc-900 border border-zinc-850 hover:border-zinc-700 hover:text-white font-bold cursor-pointer transition-all"
          >
            <Printer className="h-4 w-4 text-primary" /> Print QR
          </button>
          <button
            onClick={handleSendQRWhatsApp}
            className="flex items-center justify-center gap-1.5 p-3 rounded-xl bg-zinc-900 border border-zinc-850 hover:border-zinc-700 hover:text-white font-bold cursor-pointer transition-all col-span-2"
          >
            <Send className="h-4 w-4 text-emerald-400" /> Share via WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
