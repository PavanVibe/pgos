'use client';

import { useOnboardingStore } from '@/store/useOnboardingStore';
import { Button } from '@/components/ui/button';
import { UploadCloud, X, ShieldCheck } from 'lucide-react';
import { useRef } from 'react';

export function KycUploader() {
  const { 
    setStep, 
    aadhaarFront, 
    aadhaarBack, 
    aadhaarFrontUrl, 
    aadhaarBackUrl, 
    setAadhaarFront, 
    setAadhaarBack 
  } = useOnboardingStore();

  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);

  const handleFrontClick = () => frontInputRef.current?.click();
  const handleBackClick = () => backInputRef.current?.click();

  const handleFrontChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setAadhaarFront(file);
  };

  const handleBackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setAadhaarBack(file);
  };

  const handleRemoveFront = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAadhaarFront(null);
    if (frontInputRef.current) frontInputRef.current.value = '';
  };

  const handleRemoveBack = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAadhaarBack(null);
    if (backInputRef.current) backInputRef.current.value = '';
  };

  const canContinue = !!aadhaarFront && !!aadhaarBack;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-extrabold text-lg text-white">Upload Aadhaar KYC</h3>
        <p className="text-xs text-zinc-400 mt-1">Upload clear images of both front and back sides to verify resident identity.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Aadhaar Front Card */}
        <div 
          onClick={handleFrontClick}
          className="relative border-2 border-dashed border-zinc-800 rounded-xl p-6 flex flex-col items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/20 hover:border-zinc-700 cursor-pointer transition-all min-h-[160px]"
        >
          <input 
            type="file"
            ref={frontInputRef}
            onChange={handleFrontChange}
            accept="image/*"
            className="hidden"
          />
          {aadhaarFrontUrl ? (
            <div className="absolute inset-0 p-1.5 bg-black rounded-lg">
              <img 
                src={aadhaarFrontUrl} 
                alt="Aadhaar Front Preview" 
                className="w-full h-full object-cover rounded-lg border border-zinc-800"
              />
              <button
                type="button"
                onClick={handleRemoveFront}
                className="absolute top-3 right-3 p-1.5 bg-zinc-950/80 hover:bg-red-950/90 text-zinc-400 hover:text-red-400 border border-zinc-800 rounded-full transition-all"
                title="Remove image"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <div className="absolute bottom-3 left-3 bg-zinc-950/80 border border-zinc-800 px-2 py-0.5 rounded text-[9px] font-bold text-zinc-300 tracking-wide uppercase">
                Aadhaar Front
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-850">
                <UploadCloud className="h-6 w-6 text-zinc-400" />
              </div>
              <span className="font-bold text-xs text-zinc-300">Aadhaar Front Side</span>
              <span className="text-[10px] text-zinc-500 max-w-[150px]">Click to browse front photo</span>
            </div>
          )}
        </div>

        {/* Aadhaar Back Card */}
        <div 
          onClick={handleBackClick}
          className="relative border-2 border-dashed border-zinc-800 rounded-xl p-6 flex flex-col items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/20 hover:border-zinc-700 cursor-pointer transition-all min-h-[160px]"
        >
          <input 
            type="file"
            ref={backInputRef}
            onChange={handleBackChange}
            accept="image/*"
            className="hidden"
          />
          {aadhaarBackUrl ? (
            <div className="absolute inset-0 p-1.5 bg-black rounded-lg">
              <img 
                src={aadhaarBackUrl} 
                alt="Aadhaar Back Preview" 
                className="w-full h-full object-cover rounded-lg border border-zinc-800"
              />
              <button
                type="button"
                onClick={handleRemoveBack}
                className="absolute top-3 right-3 p-1.5 bg-zinc-950/80 hover:bg-red-950/90 text-zinc-400 hover:text-red-400 border border-zinc-800 rounded-full transition-all"
                title="Remove image"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <div className="absolute bottom-3 left-3 bg-zinc-950/80 border border-zinc-800 px-2 py-0.5 rounded text-[9px] font-bold text-zinc-300 tracking-wide uppercase">
                Aadhaar Back
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-850">
                <UploadCloud className="h-6 w-6 text-zinc-400" />
              </div>
              <span className="font-bold text-xs text-zinc-300">Aadhaar Back Side</span>
              <span className="text-[10px] text-zinc-500 max-w-[150px]">Click to browse back photo</span>
            </div>
          )}
        </div>
      </div>

      {canContinue && (
        <div className="bg-emerald-500/5 border border-emerald-500/10 p-3.5 rounded-xl flex items-center gap-2.5">
          <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
          <span className="text-[10.5px] text-emerald-400 font-semibold leading-relaxed">
            KYC documents loaded successfully. Live local image previews are rendered.
          </span>
        </div>
      )}

      <div className="flex gap-2 pt-4">
        <Button variant="outline" className="w-1/2 border-zinc-800 hover:bg-zinc-900 text-zinc-300" onClick={() => setStep(2)}>
          Back
        </Button>
        <Button 
          className="w-1/2 bg-primary hover:bg-primary/95 text-white" 
          onClick={() => setStep(4)}
          disabled={!canContinue}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
