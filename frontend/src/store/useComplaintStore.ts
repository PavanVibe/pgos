import { create } from 'zustand';

interface ComplaintState {
  isViewOpen: boolean;
  isRaiseOpen: boolean;
  isResolveOpen: boolean;
  selectedComplaintId: string | null;

  openViewComplaint: (id: string) => void;
  closeViewComplaint: () => void;
  
  openRaiseComplaint: () => void;
  closeRaiseComplaint: () => void;

  openResolveComplaint: (id: string) => void;
  closeResolveComplaint: () => void;
}

export const useComplaintStore = create<ComplaintState>((set) => ({
  isViewOpen: false,
  isRaiseOpen: false,
  isResolveOpen: false,
  selectedComplaintId: null,

  openViewComplaint: (id) => set({ isViewOpen: true, selectedComplaintId: id }),
  closeViewComplaint: () => set({ isViewOpen: false, selectedComplaintId: null }),
  
  openRaiseComplaint: () => set({ isRaiseOpen: true }),
  closeRaiseComplaint: () => set({ isRaiseOpen: false }),

  openResolveComplaint: (id) => set({ isResolveOpen: true, selectedComplaintId: id }),
  closeResolveComplaint: () => set({ isResolveOpen: false, selectedComplaintId: null }),
}));
