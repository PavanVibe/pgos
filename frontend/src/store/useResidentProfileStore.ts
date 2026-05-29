import { create } from 'zustand';

interface ResidentProfileState {
  isOpen: boolean;
  selectedProfileId: string | null;
  openProfile: (profileId: string) => void;
  closeProfile: () => void;
}

export const useResidentProfileStore = create<ResidentProfileState>((set) => ({
  isOpen: false,
  selectedProfileId: null,
  openProfile: (profileId) => set({ isOpen: true, selectedProfileId: profileId }),
  closeProfile: () => set({ isOpen: false, selectedProfileId: null }),
}));
