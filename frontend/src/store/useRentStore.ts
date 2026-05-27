import { create } from 'zustand';

interface RentState {
  isMarkPaidOpen: boolean;
  selectedTenantId: string | null;
  selectedTenantDues: number | null;
  selectedTenantName: string | null;
  selectedTenantRoom: string | null;
  selectedInvoiceId: string | null;
  selectedTenantBed: string | null;
  selectedInvoiceDueDate: string | null;
  isOverdueOpen: boolean;
  overdueMode: 'overdue' | 'all-unpaid' | 'due-today' | 'chronic';

  openMarkPaid: (
    tenantId?: string, 
    dues?: number, 
    name?: string, 
    room?: string,
    invoiceId?: string,
    bed?: string,
    dueDate?: string
  ) => void;
  closeMarkPaid: () => void;
  openOverdue: (mode?: 'overdue' | 'all-unpaid' | 'due-today' | 'chronic') => void;
  closeOverdue: () => void;
}

export const useRentStore = create<RentState>((set) => ({
  isMarkPaidOpen: false,
  selectedTenantId: null,
  selectedTenantDues: null,
  selectedTenantName: null,
  selectedTenantRoom: null,
  selectedInvoiceId: null,
  selectedTenantBed: null,
  selectedInvoiceDueDate: null,
  isOverdueOpen: false,
  overdueMode: 'overdue',

  openMarkPaid: (tenantId, dues, name, room, invoiceId, bed, dueDate) => {
    if (!tenantId) {
      console.log('No valid tenant context. Redirecting to unpaid collections list.');
      set({ isOverdueOpen: true, overdueMode: 'all-unpaid' });
      return;
    }
    set({ 
      isMarkPaidOpen: true, 
      selectedTenantId: tenantId,
      selectedTenantDues: dues !== undefined ? dues : null,
      selectedTenantName: name || null,
      selectedTenantRoom: room || null,
      selectedInvoiceId: invoiceId || null,
      selectedTenantBed: bed || null,
      selectedInvoiceDueDate: dueDate || null
    });
  },
  closeMarkPaid: () => set({ 
    isMarkPaidOpen: false, 
    selectedTenantId: null,
    selectedTenantDues: null,
    selectedTenantName: null,
    selectedTenantRoom: null,
    selectedInvoiceId: null,
    selectedTenantBed: null,
    selectedInvoiceDueDate: null
  }),
  openOverdue: (mode) => set({ isOverdueOpen: true, overdueMode: mode || 'overdue' }),
  closeOverdue: () => set({ isOverdueOpen: false }),
}));
