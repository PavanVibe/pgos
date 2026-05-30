import { create } from 'zustand';

interface RefundState {
  isRefundOpen: boolean;
  selectedTenantId: string | null;
  selectedTenantName: string | null;
  selectedTenantRoom: string | null;
  selectedTenantBed: string | null;
  selectedDepositAmount: number | null;
  selectedRefundedAmount: number | null;

  openRefund: (
    tenantId: string, 
    name: string, 
    room: string, 
    bed: string, 
    depositAmount: number,
    refundedAmount?: number
  ) => void;
  closeRefund: () => void;
}

export const useRefundStore = create<RefundState>((set) => ({
  isRefundOpen: false,
  selectedTenantId: null,
  selectedTenantName: null,
  selectedTenantRoom: null,
  selectedTenantBed: null,
  selectedDepositAmount: null,
  selectedRefundedAmount: null,

  openRefund: (tenantId, name, room, bed, depositAmount, refundedAmount) => set({
    isRefundOpen: true,
    selectedTenantId: tenantId,
    selectedTenantName: name,
    selectedTenantRoom: room,
    selectedTenantBed: bed,
    selectedDepositAmount: depositAmount,
    selectedRefundedAmount: refundedAmount || 0
  }),
  closeRefund: () => set({
    isRefundOpen: false,
    selectedTenantId: null,
    selectedTenantName: null,
    selectedTenantRoom: null,
    selectedTenantBed: null,
    selectedDepositAmount: null,
    selectedRefundedAmount: null
  })
}));
