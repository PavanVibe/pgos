import { create } from 'zustand';

export type OnboardingStep = 1 | 2 | 3 | 4 | 5;

export interface ResidentDetails {
  name: string;
  phone: string;
  email?: string;
  moveInDate: Date;
  emergencyContact?: string;
}

export interface RentConfig {
  monthlyRent: number;
  securityDeposit: number;
}

interface OnboardingState {
  isOpen: boolean;
  step: OnboardingStep;
  pgId: string | null;
  bedId: string | null;
  isQuickAdd: boolean;
  residentDetails: ResidentDetails | null;
  rentConfig: RentConfig | null;

  openOnboarding: (pgId: string) => void;
  closeOnboarding: () => void;
  setStep: (step: OnboardingStep) => void;
  setBedSelection: (bedId: string) => void;
  setResidentDetails: (details: ResidentDetails) => void;
  setRentConfig: (config: RentConfig) => void;
  setQuickAdd: (isQuick: boolean) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  isOpen: false,
  step: 1,
  pgId: null,
  bedId: null,
  isQuickAdd: false,
  residentDetails: null,
  rentConfig: null,

  openOnboarding: (pgId) => set({ isOpen: true, pgId, step: 1 }),
  closeOnboarding: () => set({ isOpen: false }),
  setStep: (step) => set({ step }),
  setBedSelection: (bedId) => set({ bedId }),
  setResidentDetails: (details) => set({ residentDetails: details }),
  setRentConfig: (config) => set({ rentConfig: config }),
  setQuickAdd: (isQuickAdd) => set({ isQuickAdd }),
  reset: () => set({
    step: 1,
    bedId: null,
    isQuickAdd: false,
    residentDetails: null,
    rentConfig: null,
  })
}));
