'use client';

import { jsPDF } from 'jspdf';
import { toast } from 'sonner';

interface ReceiptData {
  receiptNumber: string;
  residentName: string;
  amount: number;
  paymentMethod: string;
  transactionId: string;
  invoiceNumber?: string;
  paymentDate: string | Date;
  status: string;
}

export function downloadReceiptPDF(receipt: ReceiptData) {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a6' // Compact, premium voucher size
    });

    const dateStr = new Date(receipt.paymentDate).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Styles & Colors (Harmonious sleek design)
    doc.setFillColor(10, 10, 10); // Background dark header
    doc.rect(0, 0, 105, 30, 'F');

    // Header Title
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('PGOS PAYMENTS', 52.5, 12, { align: 'center' });
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text('OFFICIAL DIGITAL RECEIPT', 52.5, 18, { align: 'center' });

    // Receipt Number under header
    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(receipt.receiptNumber, 52.5, 26, { align: 'center' });

    // Main Body
    doc.setTextColor(40, 40, 40);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    let y = 38;
    const addRow = (label: string, value: string, isBoldValue = false) => {
      doc.setTextColor(120, 120, 120);
      doc.setFont('helvetica', 'normal');
      doc.text(label, 10, y);
      
      doc.setTextColor(30, 30, 30);
      if (isBoldValue) {
        doc.setFont('helvetica', 'bold');
      } else {
        doc.setFont('helvetica', 'normal');
      }
      doc.text(value, 95, y, { align: 'right' });
      y += 8;
    };

    addRow('Resident Name:', receipt.residentName, true);
    if (receipt.invoiceNumber) {
      addRow('Invoice / Dues:', receipt.invoiceNumber);
    }
    addRow('Payment Method:', receipt.paymentMethod.toUpperCase());
    addRow('Transaction ID:', receipt.transactionId.substr(0, 18));
    addRow('Payment Date:', dateStr);
    
    // Status Row with Green success color
    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'normal');
    doc.text('Payment Status:', 10, y);
    
    doc.setTextColor(16, 124, 65); // Emerald Green
    doc.setFont('helvetica', 'bold');
    doc.text(receipt.status.toUpperCase(), 95, y, { align: 'right' });
    y += 12;

    // Divider Line
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(10, y, 95, y);
    y += 10;

    // Amount Highlighting Block
    doc.setFillColor(245, 245, 245);
    doc.rect(10, y, 85, 14, 'F');
    
    doc.setTextColor(80, 80, 80);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('AMOUNT PAID', 15, y + 9);

    doc.setTextColor(10, 10, 10);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(`₹${receipt.amount.toLocaleString('en-IN')}`, 90, y + 9, { align: 'right' });

    y += 24;

    // Footer
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('This is a system generated digital receipt.', 52.5, y, { align: 'center' });
    doc.text('Thank you for choosing PGOS stay collections.', 52.5, y + 4, { align: 'center' });

    doc.save(`Receipt_${receipt.receiptNumber}.pdf`);
    toast.success('Digital receipt PDF downloaded successfully.');
  } catch (error: any) {
    console.error('[PDF GENERATION ERROR]', error);
    toast.error('Failed to generate receipt PDF.');
  }
}
