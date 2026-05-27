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

const formSchema = z.object({
  phone: z.string().min(10, 'Must be at least 10 digits'),
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
      phone: residentDetails?.phone || '',
      name: residentDetails?.name || '',
      email: residentDetails?.email || '',
      emergencyContact: residentDetails?.emergencyContact || '',
    },
  });

  const phoneValue = form.watch('phone');

  useEffect(() => {
    if (phoneValue && phoneValue.length === 10) {
      searchPhone(phoneValue);
    }
  }, [phoneValue]);

  const searchPhone = async (phone: string) => {
    setIsSearching(true);
    try {
      // MOCK: await axios.get(`/api/tenants/search-by-phone?phone=${phone}`)
      if (phone === '9999999999') {
        const mockData = { name: 'Rahul Sharma', email: 'rahul@test.com' };
        setFoundTenant(mockData);
        form.setValue('name', mockData.name);
        form.setValue('email', mockData.email);
        toast.success('Found returning resident! Autofilled details.');
      }
    } catch (e) {
      setFoundTenant(null);
    } finally {
      setIsSearching(false);
    }
  };

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    setResidentDetails({
      ...data,
      moveInDate: new Date()
    });
    setStep(3);
  };

  const handleQuickAdd = () => {
    const data = form.getValues();
    if (!data.phone || !data.name || data.phone.length < 10) {
      toast.error('Name and Phone are required for Quick Add');
      return;
    }
    setQuickAdd(true);
    setResidentDetails({
      ...data,
      moveInDate: new Date()
    });
    setStep(5); // Skip KYC and Rent, go to Review
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label>Phone Number</Label>
        <div className="relative">
          <Input 
            {...form.register('phone')} 
            placeholder="10 digit number" 
            maxLength={10}
            className="pl-9"
          />
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        </div>
        {isSearching && <p className="text-xs text-muted-foreground">Searching for existing profile...</p>}
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
        <Button type="button" variant="outline" className="w-1/2" onClick={handleQuickAdd}>
          ⚡ Quick Add
        </Button>
        <Button type="submit" className="w-1/2">
          Next Step
        </Button>
      </div>
    </form>
  );
}
