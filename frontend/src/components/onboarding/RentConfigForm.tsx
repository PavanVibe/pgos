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
});

export function RentConfigForm() {
  const { rentConfig, setRentConfig, setStep } = useOnboardingStore();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      monthlyRent: rentConfig?.monthlyRent?.toString() || '6000',
      securityDeposit: rentConfig?.securityDeposit?.toString() || '6000',
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    setRentConfig({
      monthlyRent: Number(data.monthlyRent),
      securityDeposit: Number(data.securityDeposit),
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
