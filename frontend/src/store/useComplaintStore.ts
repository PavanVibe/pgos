import { create } from 'zustand';

interface ComplaintState {
  isViewOpen: boolean;
  isRaiseOpen: boolean;
  selectedComplaintId: string | null;

  openViewComplaint: (id: string) => void;
  closeViewComplaint: () => void;
  
  openRaiseComplaint: () => void;
  closeRaiseComplaint: () => void;
}

export const useComplaintStore = create<ComplaintState>((set) => ({
  isViewOpen: false,
  isRaiseOpen: false,
  selectedComplaintId: null,

  openViewComplaint: (id) => set({ isViewOpen: true, selectedComplaintId: id }),
  closeViewComplaint: () => set({ isViewOpen: false, selectedComplaintId: null }),
  
  openRaiseComplaint: () => set({ isRaiseOpen: true }),
  closeRaiseComplaint: () => set({ isRaiseOpen: false }),
}));
