import { create } from 'zustand';

interface OccupancyState {
  isOccupancyOpen: boolean;
  selectedBedId: string | null;
  selectedRoomId: string | null;

  openOccupancy: () => void;
  closeOccupancy: () => void;
  selectBed: (bedId: string | null) => void;
  selectRoom: (roomId: string | null) => void;
}

export const useOccupancyStore = create<OccupancyState>((set) => ({
  isOccupancyOpen: false,
  selectedBedId: null,
  selectedRoomId: null,

  openOccupancy: () => set({ isOccupancyOpen: true, selectedBedId: null, selectedRoomId: null }),
  closeOccupancy: () => set({ isOccupancyOpen: false, selectedBedId: null, selectedRoomId: null }),
  selectBed: (bedId) => set({ selectedBedId: bedId }),
  selectRoom: (roomId) => set({ selectedRoomId: roomId }),
}));
