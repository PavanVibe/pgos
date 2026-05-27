'use client';

import { Button } from "@/components/ui/button";
import { PlusCircle, LogOut, MessageSquareWarning } from "lucide-react";
import { useOnboardingStore } from "@/store/useOnboardingStore";
import { useComplaintStore } from "@/store/useComplaintStore";
import { useVacateStore } from "@/store/useVacateStore";

export default function QuickActions({ pgId }: { pgId: string }) {
  const { openOnboarding } = useOnboardingStore();
  const { openRaiseComplaint } = useComplaintStore();
  const { openVacate } = useVacateStore();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
      <Button
        variant="outline"
        className="h-24 flex flex-col items-center justify-center gap-2 hover:bg-primary/5"
        onClick={() => openOnboarding(pgId)}
      >
        <PlusCircle className="h-8 w-8 text-primary" />
        <span>Onboard Resident</span>
      </Button>

      <Button
        variant="outline"
        className="h-24 flex flex-col items-center justify-center gap-2 hover:bg-orange-500/5 hover:border-orange-500/50"
        onClick={() => openRaiseComplaint()}
      >
        <MessageSquareWarning className="h-8 w-8 text-orange-500" />
        <span>Raise Complaint</span>
      </Button>

      <Button
        variant="outline"
        className="h-24 flex flex-col items-center justify-center gap-2 hover:bg-red-500/5 hover:border-red-500/50"
        onClick={() => openVacate()}
      >
        <LogOut className="h-8 w-8 text-red-500" />
        <span>Process Move-Out</span>
      </Button>
    </div>
  );
}
