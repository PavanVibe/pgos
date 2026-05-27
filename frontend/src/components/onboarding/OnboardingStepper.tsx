import { Check } from 'lucide-react';

interface StepperProps {
  currentStep: number;
}

export function OnboardingStepper({ currentStep }: StepperProps) {
  const steps = [
    { num: 1, label: 'Bed' },
    { num: 2, label: 'Details' },
    { num: 3, label: 'KYC' },
    { num: 4, label: 'Rent' },
    { num: 5, label: 'Review' }
  ];

  return (
    <div className="flex items-center justify-between w-full">
      {steps.map((step, index) => (
        <div key={step.num} className="flex items-center">
          <div className={`flex flex-col items-center gap-1 ${currentStep >= step.num ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors
              ${currentStep > step.num ? 'bg-primary border-primary text-primary-foreground' 
                : currentStep === step.num ? 'border-primary text-primary' 
                : 'border-muted text-muted-foreground'}`}>
              {currentStep > step.num ? <Check className="h-4 w-4" /> : step.num}
            </div>
            <span className="text-[10px] uppercase tracking-wider font-semibold">
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div className={`h-[2px] w-8 sm:w-12 mx-2 ${currentStep > step.num ? 'bg-primary' : 'bg-muted'}`} />
          )}
        </div>
      ))}
    </div>
  );
}
