import { create } from 'zustand';

interface VacateState {
  isVacateOpen: boolean;
  selectedTenantId: string | null;

  openVacate: (tenantId?: string) => void;
  closeVacate: () => void;
}

export const useVacateStore = create<VacateState>((set) => ({
  isVacateOpen: false,
  selectedTenantId: null,

  openVacate: (tenantId) => set({ isVacateOpen: true, selectedTenantId: tenantId || null }),
  closeVacate: () => set({ isVacateOpen: false, selectedTenantId: null }),
}));
