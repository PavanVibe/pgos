'use client';

import { useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useOnboardingStore } from '@/store/useOnboardingStore';
import { OnboardingStepper } from './OnboardingStepper';
import { BedSelectorGrid } from './BedSelectorGrid';
import { ResidentInfoForm } from './ResidentInfoForm';
import { KycUploader } from './KycUploader';
import { RentConfigForm } from './RentConfigForm';
import { ReviewConfirmation } from './ReviewConfirmation';

export default function OnboardingSheet() {
  const { isOpen, closeOnboarding, step } = useOnboardingStore();

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        closeOnboarding();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeOnboarding]);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeOnboarding()}>
      <SheetContent side="right" className="w-full sm:max-w-md lg:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Resident Onboarding</SheetTitle>
          <SheetDescription>
            Allocate a bed and onboard a new resident.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          <OnboardingStepper currentStep={step} />

          <div className="mt-8">
            {step === 1 && <BedSelectorGrid />}
            {step === 2 && <ResidentInfoForm />}
            {step === 3 && <KycUploader />}
            {step === 4 && <RentConfigForm />}
            {step === 5 && <ReviewConfirmation />}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
