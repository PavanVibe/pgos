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
  roomNumber: string | null;
  bedLabel: string | null;
  isQuickAdd: boolean;
  residentDetails: ResidentDetails | null;
  rentConfig: RentConfig | null;
  aadhaarFront: File | null;
  aadhaarBack: File | null;
  aadhaarFrontUrl: string | null;
  aadhaarBackUrl: string | null;
  aadhaarFrontBase64: string | null;
  aadhaarBackBase64: string | null;

  openOnboarding: (pgId: string) => void;
  closeOnboarding: () => void;
  setStep: (step: OnboardingStep) => void;
  setBedSelection: (bedId: string, roomNumber?: string, bedLabel?: string) => void;
  setResidentDetails: (details: ResidentDetails) => void;
  setRentConfig: (config: RentConfig) => void;
  setQuickAdd: (isQuick: boolean) => void;
  setAadhaarFront: (file: File | null) => void;
  setAadhaarBack: (file: File | null) => void;
  setAadhaarFrontBase64: (base64: string | null) => void;
  setAadhaarBackBase64: (base64: string | null) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  isOpen: false,
  step: 1,
  pgId: null,
  bedId: null,
  roomNumber: null,
  bedLabel: null,
  isQuickAdd: false,
  residentDetails: null,
  rentConfig: null,
  aadhaarFront: null,
  aadhaarBack: null,
  aadhaarFrontUrl: null,
  aadhaarBackUrl: null,
  aadhaarFrontBase64: null,
  aadhaarBackBase64: null,

  openOnboarding: (pgId) => set({ isOpen: true, pgId, step: 1 }),
  closeOnboarding: () => set({ isOpen: false }),
  setStep: (step) => set({ step }),
  setBedSelection: (bedId, roomNumber, bedLabel) => set({ 
    bedId, 
    roomNumber: roomNumber || null, 
    bedLabel: bedLabel || null 
  }),
  setResidentDetails: (details) => set({ residentDetails: details }),
  setRentConfig: (config) => set({ rentConfig: config }),
  setQuickAdd: (isQuickAdd) => set({ isQuickAdd }),
  setAadhaarFront: (file) => set((state) => {
    if (state.aadhaarFrontUrl) {
      URL.revokeObjectURL(state.aadhaarFrontUrl);
    }
    return {
      aadhaarFront: file,
      aadhaarFrontUrl: file ? URL.createObjectURL(file) : null
    };
  }),
  setAadhaarBack: (file) => set((state) => {
    if (state.aadhaarBackUrl) {
      URL.revokeObjectURL(state.aadhaarBackUrl);
    }
    return {
      aadhaarBack: file,
      aadhaarBackUrl: file ? URL.createObjectURL(file) : null
    };
  }),
  setAadhaarFrontBase64: (base64) => set({ aadhaarFrontBase64: base64 }),
  setAadhaarBackBase64: (base64) => set({ aadhaarBackBase64: base64 }),
  reset: () => set((state) => {
    if (state.aadhaarFrontUrl) URL.revokeObjectURL(state.aadhaarFrontUrl);
    if (state.aadhaarBackUrl) URL.revokeObjectURL(state.aadhaarBackUrl);
    return {
      step: 1,
      bedId: null,
      roomNumber: null,
      bedLabel: null,
      isQuickAdd: false,
      residentDetails: null,
      rentConfig: null,
      aadhaarFront: null,
      aadhaarBack: null,
      aadhaarFrontUrl: null,
      aadhaarBackUrl: null,
      aadhaarFrontBase64: null,
      aadhaarBackBase64: null,
    };
  })
}));
