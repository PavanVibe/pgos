'use client';

import { useOnboardingStore } from '@/store/useOnboardingStore';
import { Button } from '@/components/ui/button';
import { UploadCloud } from 'lucide-react';

export function KycUploader() {
  const { setStep } = useOnboardingStore();

  return (
    <div className="space-y-6">
      <h3 className="font-semibold text-lg">Upload KYC Documents</h3>
      <p className="text-sm text-muted-foreground">Please upload a clear picture of Aadhaar.</p>
      
      <div className="border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/50 cursor-pointer transition-colors">
        <UploadCloud className="h-10 w-10 mb-4" />
        <span className="font-medium text-foreground">Click or Drag & Drop to upload</span>
        <span className="text-xs mt-1">Supports JPG, PNG, PDF</span>
      </div>

      <div className="flex gap-2 pt-4">
        <Button variant="outline" className="w-1/2" onClick={() => setStep(2)}>
          Back
        </Button>
        <Button className="w-1/2" onClick={() => setStep(4)}>
          Continue
        </Button>
      </div>
    </div>
  );
}
