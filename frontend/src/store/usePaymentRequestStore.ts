import { create } from 'zustand';

interface PaymentRequestState {
  isPaymentRequestOpen: boolean;
  paymentRequestType: 'RENT' | 'SECURITY_DEPOSIT' | 'DAMAGE' | null;
  paymentRequestTargetId: string | null;
  paymentRequestDetails: {
    invoiceNumber?: string;
    residentName: string;
    residentPhone?: string;
    amount: number;
    dueDate?: string | Date;
  } | null;
  openPaymentRequest: (
    type: 'RENT' | 'SECURITY_DEPOSIT' | 'DAMAGE',
    targetId: string,
    details: {
      invoiceNumber?: string;
      residentName: string;
      residentPhone?: string;
      amount: number;
      dueDate?: string | Date;
    }
  ) => void;
  closePaymentRequest: () => void;
}

export const usePaymentRequestStore = create<PaymentRequestState>((set) => ({
  isPaymentRequestOpen: false,
  paymentRequestType: null,
  paymentRequestTargetId: null,
  paymentRequestDetails: null,
  openPaymentRequest: (type, targetId, details) => {
    console.log("[DIAGNOSTIC] store: openPaymentRequest called with:", { type, targetId, details });
    set({
      isPaymentRequestOpen: true,
      paymentRequestType: type,
      paymentRequestTargetId: targetId,
      paymentRequestDetails: details
    });
  },
  closePaymentRequest: () => {
    console.log("[DIAGNOSTIC] store: closePaymentRequest called");
    set({
      isPaymentRequestOpen: false,
      paymentRequestType: null,
      paymentRequestTargetId: null,
      paymentRequestDetails: null
    });
  }
}));
