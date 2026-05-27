'use client';

import { useState } from 'react';
import { Plus, X, UserPlus, CreditCard, MessageSquareWarning } from 'lucide-react';
import { useOnboardingStore } from '@/store/useOnboardingStore';

export function FloatingActionButton({ pgId }: { pgId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const { openOnboarding } = useOnboardingStore();

  const handleAction = (action: () => void) => {
    setIsOpen(false);
    action();
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 md:hidden">
      {isOpen && (
        <>
          <button 
            onClick={() => handleAction(() => console.log('Raise Complaint'))}
            className="flex items-center gap-2 bg-background border shadow-md rounded-full py-2 px-4 text-sm font-medium hover:bg-muted transition-transform animate-in slide-in-from-bottom-2"
          >
            <MessageSquareWarning className="h-4 w-4 text-orange-500" />
            Raise Complaint
          </button>
          
          <button 
            onClick={() => handleAction(() => console.log('Mark Paid'))}
            className="flex items-center gap-2 bg-background border shadow-md rounded-full py-2 px-4 text-sm font-medium hover:bg-muted transition-transform animate-in slide-in-from-bottom-4"
          >
            <CreditCard className="h-4 w-4 text-green-500" />
            Mark Rent Paid
          </button>

          <button 
            onClick={() => handleAction(() => openOnboarding(pgId))}
            className="flex items-center gap-2 bg-primary text-primary-foreground shadow-md rounded-full py-2 px-4 text-sm font-medium hover:bg-primary/90 transition-transform animate-in slide-in-from-bottom-6"
          >
            <UserPlus className="h-4 w-4" />
            Onboard Resident
          </button>
        </>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-transform hover:scale-105 active:scale-95"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </button>
    </div>
  );
}
