'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOnboardingStore } from '@/store/useOnboardingStore';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Search } from 'lucide-react';
import { fetchApi } from '@/lib/api';

const formSchema = z.object({
  phone: z.string()
    .length(10, 'Phone number must be exactly 10 digits')
    .regex(/^\d+$/, 'Phone number must contain only numbers'),
  name: z.string().min(2, 'Name is required'),
  email: z.string().email().optional().or(z.literal('')),
  emergencyContact: z.string().optional(),
});

export function ResidentInfoForm() {
  const { residentDetails, setResidentDetails, setStep, setQuickAdd } = useOnboardingStore();
  const [isSearching, setIsSearching] = useState(false);
  const [foundTenant, setFoundTenant] = useState<any>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      phone: residentDetails?.phone ? residentDetails.phone.replace('+91', '') : '',
      name: residentDetails?.name || '',
      email: residentDetails?.email || '',
      emergencyContact: residentDetails?.emergencyContact || '',
    },
  });

  const phoneValue = form.watch('phone');

  useEffect(() => {
    const cleanDigits = phoneValue?.replace(/\D/g, '') || '';
    if (cleanDigits.length === 10) {
      searchPhone(cleanDigits);
    }
  }, [phoneValue]);

  const searchPhone = async (phone: string) => {
    setIsSearching(true);
    try {
      const response = await fetchApi(`/tenants/search-by-phone?phone=${encodeURIComponent('+91' + phone)}`);
      if (response?.data) {
        const tenant = response.data;
        setFoundTenant(tenant);
        form.setValue('name', tenant.name || '');
        form.setValue('email', tenant.email || '');
        toast.success('Found returning resident! Autofilled details.');
      }
    } catch (e) {
      setFoundTenant(null);
    } finally {
      setIsSearching(false);
    }
  };

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    const digitsOnly = data.phone.replace(/\D/g, '');
    if (digitsOnly.length !== 10) {
      toast.error('Please enter exactly 10 digits.');
      return;
    }
    setResidentDetails({
      ...data,
      phone: `+91${digitsOnly}`,
      moveInDate: new Date()
    });
    setStep(3);
  };

  const handleQuickAdd = () => {
    const data = form.getValues();
    const digitsOnly = data.phone?.replace(/\D/g, '') || '';
    if (!data.name || digitsOnly.length !== 10) {
      toast.error('Name and a valid 10-digit Phone are required for Quick Add');
      return;
    }
    setQuickAdd(true);
    setResidentDetails({
      ...data,
      phone: `+91${digitsOnly}`,
      moveInDate: new Date()
    });
    setStep(5); // Skip KYC and Rent, go to Review
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label className="text-zinc-300 font-bold text-xs uppercase tracking-wider">Phone Number</Label>
        <div className="relative flex items-center bg-zinc-950 border border-zinc-900 rounded-xl focus-within:border-zinc-700 transition-all">
          <span className="pl-3.5 pr-2.5 text-zinc-400 font-extrabold border-r border-zinc-800 text-xs h-full flex items-center select-none">
            +91
          </span>
          <Input 
            {...form.register('phone')} 
            placeholder="9876543210" 
            maxLength={10}
            className="bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 pl-3 text-white h-11 text-xs font-semibold"
          />
          <Search className="absolute right-3.5 h-4 w-4 text-zinc-500" />
        </div>
        {isSearching && <p className="text-[10px] text-zinc-400 font-semibold animate-pulse">Searching global network...</p>}
        {phoneValue && /^\d+$/.test(phoneValue) && (
          <p className="text-[10px] text-emerald-400 font-bold mt-1 tracking-wide">
            WhatsApp Destination: +91 {phoneValue}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Full Name</Label>
        <Input {...form.register('name')} placeholder="e.g. Rahul Sharma" />
      </div>

      <div className="space-y-2">
        <Label>Email (Optional)</Label>
        <Input {...form.register('email')} placeholder="rahul@example.com" type="email" />
      </div>

      <div className="space-y-2">
        <Label>Emergency Contact (Optional)</Label>
        <Input {...form.register('emergencyContact')} placeholder="10 digit number" />
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="button" variant="outline" className="w-1/2 border-zinc-800 hover:bg-zinc-900 text-zinc-300" onClick={handleQuickAdd}>
          ⚡ Quick Add
        </Button>
        <Button type="submit" className="w-1/2">
          Next Step
        </Button>
      </div>
    </form>
  );
}
