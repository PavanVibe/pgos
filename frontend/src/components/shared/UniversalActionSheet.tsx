'use client';

import * as React from "react"
import { useRouter } from "next/navigation";
import {
  CreditCard,
  Settings,
  LogOut,
  UserPlus,
  MessageSquareWarning
} from "lucide-react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"

import { useOnboardingStore } from "@/store/useOnboardingStore"
// import { useComplaintStore } from "@/store/useComplaintStore"
// import { useRentStore } from "@/store/useRentStore"
// import { useVacateStore } from "@/store/useVacateStore"

export function UniversalActionSheet({ pgId }: { pgId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false)
  const { openOnboarding } = useOnboardingStore();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const runCommand = React.useCallback((command: () => void) => {
    setOpen(false)
    command()
  }, [])

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Operational Actions">
          <CommandItem onSelect={() => runCommand(() => openOnboarding(pgId))}>
            <UserPlus className="mr-2 h-4 w-4" />
            <span>Onboard New Resident</span>
            <CommandShortcut>⌘O</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => console.log('Mark Paid'))}>
            <CreditCard className="mr-2 h-4 w-4 text-green-500" />
            <span>Mark Rent Paid</span>
            <CommandShortcut>⌘P</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => console.log('Raise Complaint'))}>
            <MessageSquareWarning className="mr-2 h-4 w-4 text-orange-500" />
            <span>Raise Complaint</span>
            <CommandShortcut>⌘E</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => console.log('Vacate Resident'))}>
            <LogOut className="mr-2 h-4 w-4 text-red-500" />
            <span>Vacate Resident</span>
            <CommandShortcut>⌘Backspace</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Settings">
          <CommandItem onSelect={() => runCommand(() => router.push('/settings/pgs'))}>
            <Settings className="mr-2 h-4 w-4" />
            <span>PG Settings</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
