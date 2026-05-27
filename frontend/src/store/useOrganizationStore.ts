import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PG {
  id: string;
  name: string;
}

interface OrganizationStore {
  activeOrganizationId: string | null;
  activePgId: string | null;
  availablePgs: PG[];
  
  setActiveOrganizationId: (id: string | null) => void;
  setActivePgId: (id: string | null) => void;
  setAvailablePgs: (pgs: PG[]) => void;
}

export const useOrganizationStore = create<OrganizationStore>()(
  persist(
    (set) => ({
      activeOrganizationId: null,
      activePgId: null,
      availablePgs: [],
      
      setActiveOrganizationId: (id) => set({ activeOrganizationId: id }),
      setActivePgId: (id) => set({ activePgId: id }),
      setAvailablePgs: (pgs) => set({ availablePgs: pgs }),
    }),
    {
      name: 'pgos-org-context', // unique name in localStorage
    }
  )
);

