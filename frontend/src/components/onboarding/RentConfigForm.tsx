'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOnboardingStore } from '@/store/useOnboardingStore';

const formSchema = z.object({
  monthlyRent: z.string().min(1, 'Required'),
  securityDeposit: z.string().min(1, 'Required'),
  depositCollected: z.boolean(),
  depositPaymentMode: z.string().optional(),
  depositCollectedAt: z.string().optional(),
});

export function RentConfigForm() {
  const { rentConfig, setRentConfig, setStep } = useOnboardingStore();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      monthlyRent: rentConfig?.monthlyRent?.toString() || '6000',
      securityDeposit: rentConfig?.securityDeposit?.toString() || '6000',
      depositCollected: rentConfig?.depositCollected || false,
      depositPaymentMode: rentConfig?.depositPaymentMode || 'UPI',
      depositCollectedAt: rentConfig?.depositCollectedAt || new Date().toISOString().split('T')[0],
    },
  });

  const depositCollected = form.watch('depositCollected');

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    setRentConfig({
      monthlyRent: Number(data.monthlyRent),
      securityDeposit: Number(data.securityDeposit),
      depositCollected: data.depositCollected,
      depositPaymentMode: data.depositCollected ? data.depositPaymentMode || 'UPI' : undefined,
      depositCollectedAt: data.depositCollected ? data.depositCollectedAt || new Date().toISOString().split('T')[0] : undefined,
    });
    setStep(5);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label>Monthly Rent (₹)</Label>
        <Input {...form.register('monthlyRent')} type="number" />
      </div>

      <div className="space-y-2">
        <Label>Security Deposit (₹)</Label>
        <Input {...form.register('securityDeposit')} type="number" />
      </div>

      <div className="flex items-center gap-2 pt-2 pb-1 select-none">
        <input
          type="checkbox"
          id="depositCollected"
          {...form.register('depositCollected')}
          className="h-4 w-4 rounded border-zinc-800 bg-zinc-950 text-primary focus:ring-0 focus:ring-offset-0 cursor-pointer"
        />
        <Label htmlFor="depositCollected" className="cursor-pointer font-bold text-zinc-300">
          Deposit collected at move-in
        </Label>
      </div>

      {depositCollected && (
        <div className="space-y-4 p-4 rounded-xl border border-zinc-900 bg-zinc-950/40 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="space-y-2">
            <Label className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Deposit Payment Mode</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
                <input
                  type="radio"
                  value="UPI"
                  {...form.register('depositPaymentMode')}
                  className="h-3.5 w-3.5 border-zinc-850 bg-zinc-950 text-primary focus:ring-0 cursor-pointer"
                />
                <span>UPI</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
                <input
                  type="radio"
                  value="CASH"
                  {...form.register('depositPaymentMode')}
                  className="h-3.5 w-3.5 border-zinc-850 bg-zinc-950 text-primary focus:ring-0 cursor-pointer"
                />
                <span>Cash</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
                <input
                  type="radio"
                  value="BANK_TRANSFER"
                  {...form.register('depositPaymentMode')}
                  className="h-3.5 w-3.5 border-zinc-850 bg-zinc-950 text-primary focus:ring-0 cursor-pointer"
                />
                <span>Bank Transfer</span>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Deposit Collected Date</Label>
            <Input
              type="date"
              {...form.register('depositCollectedAt')}
              className="bg-zinc-950 border-zinc-900 focus:border-zinc-800 text-xs font-medium [color-scheme:dark]"
            />
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-4">
        <Button type="button" variant="outline" className="w-1/2" onClick={() => setStep(3)}>
          Back
        </Button>
        <Button type="submit" className="w-1/2">
          Review & Confirm
        </Button>
      </div>
    </form>
  );
}
