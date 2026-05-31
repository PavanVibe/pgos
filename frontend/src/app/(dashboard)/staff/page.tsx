'use client';

import { useState, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrganizationStore } from '@/store/useOrganizationStore';
import { fetchApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ArrowLeft, 
  Building2, 
  ChevronDown, 
  Plus, 
  Calendar, 
  IndianRupee, 
  User,
  Phone,
  Briefcase,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
  X,
  Info,
  UserCheck,
  UserMinus,
  HelpCircle
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface SalaryPayment {
  id: string;
  staffId: string;
  amount: number;
  paymentDate: string;
  salaryMonth: string;
  notes: string | null;
}

interface StaffItem {
  id: string;
  name: string;
  phone: string;
  role: string;
  monthlySalary: number;
  joiningDate: string;
  status: string; // ACTIVE, INACTIVE
  updatedAt: string;
  salaryPayments?: SalaryPayment[];
}

function StaffContent() {
  const { activePgId, availablePgs, setActivePgId } = useOrganizationStore();
  const queryClient = useQueryClient();

  // Selected staff for Details Drawer / Pay Salary
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);

  // Add Staff Form States
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('CARETAKER');
  const [monthlySalary, setMonthlySalary] = useState('');
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().split('T')[0]);

  // Pay Salary Form States
  const [payAmount, setPayAmount] = useState('');
  const [salaryMonth, setSalaryMonth] = useState('');
  const [payNotes, setPayNotes] = useState('');

  // Fetch Staff List
  const { data: staffResponse, isLoading, isError } = useQuery({
    queryKey: ['staff-list', activePgId],
    queryFn: () => fetchApi(`/pgs/${activePgId}/staff`),
    enabled: !!activePgId,
  });

  // Fetch Staff Details (with Salary History) when selected
  const { data: detailsResponse, isLoading: detailsLoading } = useQuery({
    queryKey: ['staff-details', selectedStaffId],
    queryFn: () => fetchApi(`/pgs/${activePgId}/staff/${selectedStaffId}`),
    enabled: !!activePgId && !!selectedStaffId,
  });

  const staffList: StaffItem[] = staffResponse?.data || [];
  const selectedStaff: StaffItem | null = detailsResponse?.data || null;

  const activeStaff = staffList.filter(s => s.status.toUpperCase() === 'ACTIVE');
  const inactiveStaff = staffList.filter(s => s.status.toUpperCase() === 'INACTIVE');

  const totalMonthlyPayroll = activeStaff.reduce((sum, s) => sum + s.monthlySalary, 0);

  // Add Staff Mutation
  const addStaffMutation = useMutation({
    mutationFn: (body: any) => {
      return fetchApi(`/pgs/${activePgId}/staff`, {
        method: 'POST',
        body: JSON.stringify(body)
      });
    },
    onSuccess: () => {
      toast.success('Staff member registered successfully.');
      queryClient.invalidateQueries({ queryKey: ['staff-list', activePgId] });
      queryClient.invalidateQueries({ queryKey: ['profit-summary', activePgId] });
      setName('');
      setPhone('');
      setRole('CARETAKER');
      setMonthlySalary('');
      setShowAddForm(false);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to add staff member.');
    }
  });

  // Deactivate Staff Mutation
  const deactivateMutation = useMutation({
    mutationFn: (staffId: string) => {
      return fetchApi(`/pgs/${activePgId}/staff/${staffId}/deactivate`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      toast.success('Staff member deactivated.');
      queryClient.invalidateQueries({ queryKey: ['staff-list', activePgId] });
      queryClient.invalidateQueries({ queryKey: ['staff-details', selectedStaffId] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to deactivate staff.');
    }
  });

  // Pay Salary Mutation
  const paySalaryMutation = useMutation({
    mutationFn: ({ staffId, body }: { staffId: string; body: any }) => {
      return fetchApi(`/pgs/${activePgId}/staff/${staffId}/pay-salary`, {
        method: 'POST',
        body: JSON.stringify(body)
      });
    },
    onSuccess: () => {
      toast.success('Salary payment recorded successfully.');
      queryClient.invalidateQueries({ queryKey: ['staff-list', activePgId] });
      queryClient.invalidateQueries({ queryKey: ['staff-details', selectedStaffId] });
      queryClient.invalidateQueries({ queryKey: ['expenses-timeline', activePgId] });
      queryClient.invalidateQueries({ queryKey: ['profit-summary', activePgId] });
      setPayAmount('');
      setSalaryMonth('');
      setPayNotes('');
      setShowPayModal(false);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to record salary payment.');
    }
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedSalary = parseFloat(monthlySalary);
    if (!name.trim()) {
      toast.error('Please enter staff name.');
      return;
    }
    if (phone.trim().length < 10) {
      toast.error('Please enter a valid 10-digit phone number.');
      return;
    }
    if (isNaN(parsedSalary) || parsedSalary < 0) {
      toast.error('Please specify a valid monthly salary.');
      return;
    }

    addStaffMutation.mutate({
      name: name.trim(),
      phone: phone.trim(),
      role: role.toUpperCase(),
      monthlySalary: parsedSalary,
      joiningDate
    });
  };

  const handlePaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffId) return;
    const parsedAmount = parseFloat(payAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Please enter a valid payment amount.');
      return;
    }
    if (!salaryMonth.trim()) {
      toast.error('Please select or write the salary month.');
      return;
    }

    paySalaryMutation.mutate({
      staffId: selectedStaffId,
      body: {
        amount: parsedAmount,
        salaryMonth: salaryMonth.trim(),
        notes: payNotes.trim() || undefined
      }
    });
  };

  const getRoleIcon = (roleStr: string) => {
    switch (roleStr.toUpperCase()) {
      case 'CARETAKER': return <User className="h-4 w-4 text-emerald-400" />;
      case 'COOK': return <Sparkles className="h-4 w-4 text-orange-400" />;
      case 'CLEANER': return <Layers className="h-4 w-4 text-cyan-400" />;
      case 'SECURITY': return <ShieldCheck className="h-4 w-4 text-red-400" />;
      case 'MAINTENANCE': return <Briefcase className="h-4 w-4 text-yellow-400" />;
      default: return <HelpCircle className="h-4 w-4 text-zinc-400" />;
    }
  };

  const formatRole = (roleStr: string) => {
    const formatted = roleStr.toLowerCase();
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div className="flex items-center gap-3">
          <Link 
            href="/"
            className="p-2 rounded-xl bg-zinc-950 border border-zinc-900 hover:border-zinc-850 hover:bg-zinc-900 transition-all text-zinc-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
              Staff Registry
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                <UserCheck className="h-3.5 w-3.5" />
              </span>
            </h1>
            <p className="text-zinc-400 text-sm mt-0.5">Manage PG helpers, caretakers, cooks, and log monthly salary payments.</p>
          </div>
        </div>

        {/* PG Selector Context */}
        <div className="relative inline-block text-left">
          {availablePgs.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-850 px-4 py-2.5 rounded-lg hover:border-zinc-700 transition-all cursor-pointer group">
                <Building2 className="h-4 w-4 text-zinc-400 group-hover:text-primary transition-colors" />
                <select
                  value={activePgId || ''}
                  onChange={(e) => setActivePgId(e.target.value)}
                  className="bg-transparent text-sm font-semibold focus:outline-none pr-6 cursor-pointer text-white appearance-none relative z-10"
                  style={{ backgroundImage: 'none' }}
                >
                  {availablePgs.map((pg) => (
                    <option key={pg.id} value={pg.id} className="bg-zinc-950 text-white">
                      {pg.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="h-4 w-4 text-zinc-400 absolute right-4 pointer-events-none" />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Side: Summary and Adding Panel */}
        <div className="space-y-6 lg:col-span-1">
          {/* Quick Staff Stats Card */}
          <Card className="border border-zinc-900 bg-zinc-950/20">
            <CardContent className="p-5 space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-zinc-550 uppercase tracking-widest block font-bold">Active Staff Count</span>
                <span className="text-3xl font-black text-white block">
                  {activeStaff.length} helpers
                </span>
              </div>
              <div className="space-y-1 pt-2 border-t border-zinc-900">
                <span className="text-[10px] font-black text-zinc-550 uppercase tracking-widest block font-bold">Monthly Salary Commitment</span>
                <span className="text-2xl font-black text-emerald-450 block flex items-center">
                  <IndianRupee className="h-5 w-5 text-emerald-500 mr-0.5" />
                  {totalMonthlyPayroll.toLocaleString('en-IN')}/mo
                </span>
              </div>

              {!showAddForm && (
                <button
                  onClick={() => {
                    setShowAddForm(true);
                    setSelectedStaffId(null);
                  }}
                  className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider transition-all select-none"
                >
                  <Plus className="h-4 w-4 stroke-[3]" /> Register Helper
                </button>
              )}
            </CardContent>
          </Card>

          {/* Add Staff Form Panel */}
          {showAddForm && (
            <Card className="border border-zinc-900 bg-zinc-950/40 p-5 space-y-4 animate-scaleUp">
              <div className="flex justify-between items-center border-b border-zinc-900 pb-3">
                <h3 className="text-sm font-black uppercase text-white tracking-wider flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-400" /> New Helper
                </h3>
                <button 
                  onClick={() => setShowAddForm(false)}
                  className="text-zinc-550 hover:text-zinc-300 font-bold p-1 bg-zinc-900 hover:bg-zinc-800 rounded text-xs"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddSubmit} className="space-y-4 text-xs font-semibold">
                {/* Name */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block">Helper Name</label>
                  <input
                    placeholder="e.g. Ramesh Kumar"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-black border border-zinc-900 h-9 px-3 rounded-lg focus:outline-none focus:border-zinc-800 text-white"
                    required
                  />
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block">WhatsApp / Phone Number</label>
                  <div className="relative">
                    <input
                      placeholder="e.g. 9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-black border border-zinc-900 h-9 pl-8 pr-3 rounded-lg focus:outline-none focus:border-zinc-800 text-white"
                      maxLength={10}
                      required
                    />
                    <Phone className="h-3.5 w-3.5 text-zinc-650 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* Role & Monthly Salary */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block">Role</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full bg-black border border-zinc-900 h-9 px-2 rounded-lg focus:outline-none focus:border-zinc-800 text-white cursor-pointer"
                    >
                      <option value="CARETAKER">Caretaker</option>
                      <option value="CLEANER">Cleaner</option>
                      <option value="COOK">Cook</option>
                      <option value="SECURITY">Security</option>
                      <option value="MAINTENANCE">Maintenance</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block">Salary (₹/mo)</label>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="0"
                        value={monthlySalary}
                        onChange={(e) => setMonthlySalary(e.target.value)}
                        className="w-full bg-black border border-zinc-900 h-9 pl-7 pr-3 rounded-lg focus:outline-none focus:border-zinc-800 text-white font-bold"
                        required
                      />
                      <IndianRupee className="h-3.5 w-3.5 text-zinc-650 absolute left-2 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                </div>

                {/* Joining Date */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block">Joining Date</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={joiningDate}
                      onChange={(e) => setJoiningDate(e.target.value)}
                      className="w-full bg-black border border-zinc-900 h-9 pl-9 pr-3 rounded-lg focus:outline-none focus:border-zinc-800 text-white cursor-pointer"
                      required
                    />
                    <Calendar className="h-3.5 w-3.5 text-zinc-650 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={addStaffMutation.isPending}
                    className="flex-1 bg-emerald-650 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider h-10 rounded-xl transition-all select-none"
                  >
                    {addStaffMutation.isPending ? 'Saving...' : 'Confirm'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="flex-1 border border-zinc-900 hover:bg-zinc-900 text-zinc-400 hover:text-white font-bold text-xs uppercase tracking-wider h-10 rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </Card>
          )}
        </div>

        {/* Right Side: Active Helper Cards & Details Timeline */}
        <div className="lg:col-span-3 space-y-6">
          {/* Active Helpers Registry */}
          <div className="space-y-4">
            <h3 className="text-sm font-black uppercase text-zinc-400 tracking-wider flex items-center gap-1.5">
              <UserCheck className="h-4 w-4 text-emerald-400" /> Active Staff ({activeStaff.length})
            </h3>

            {isLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
                <div className="h-32 bg-zinc-900 rounded-xl" />
                <div className="h-32 bg-zinc-900 rounded-xl" />
              </div>
            )}

            {isError && (
              <div className="h-32 flex flex-col items-center justify-center border border-dashed border-red-950 bg-red-950/5 rounded-2xl text-red-500 font-semibold text-sm">
                Failed to load helpers registry.
              </div>
            )}

            {!isLoading && !isError && activeStaff.length === 0 && (
              <div className="h-48 flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-xl bg-zinc-950/20 text-zinc-500 text-center">
                <UserMinus className="h-8 w-8 text-zinc-700 mb-2" />
                <p className="font-bold text-sm">No helpers active in this PG</p>
                <p className="text-xs text-zinc-650 mt-1">Tap 'Register Helper' on the left to add caretakers, cooks, or cleaners.</p>
              </div>
            )}

            {!isLoading && !isError && activeStaff.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeStaff.map((staff) => (
                  <Card 
                    key={staff.id} 
                    className={`border transition-all cursor-pointer bg-zinc-950/40 hover:bg-zinc-950/80 ${selectedStaffId === staff.id ? 'border-emerald-600' : 'border-zinc-900 hover:border-zinc-850'}`}
                    onClick={() => {
                      setSelectedStaffId(staff.id);
                      setShowAddForm(false);
                    }}
                  >
                    <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <span className="text-base font-extrabold text-white block">{staff.name}</span>
                          <div className="flex items-center gap-1.5 text-zinc-400 text-xs">
                            {getRoleIcon(staff.role)}
                            <span>{formatRole(staff.role)}</span>
                          </div>
                        </div>
                        <span className="text-sm font-black text-white flex items-center bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-800">
                          <IndianRupee className="h-3.5 w-3.5 text-zinc-400" />
                          {staff.monthlySalary.toLocaleString('en-IN')}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-[10px] text-zinc-500 pt-2 border-t border-zinc-900/60">
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          <span>{staff.phone}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>Joined {new Date(staff.joiningDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setSelectedStaffId(staff.id);
                            // Auto-set the salary amount to standard monthly salary
                            setPayAmount(staff.monthlySalary.toString());
                            const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                            const d = new Date();
                            setSalaryMonth(`${monthNames[d.getMonth()]} ${d.getFullYear()}`);
                            setShowPayModal(true);
                          }}
                          className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] uppercase tracking-wider transition-colors"
                        >
                          Mark Salary Paid
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Are you sure you want to deactivate ${staff.name}?`)) {
                              deactivateMutation.mutate(staff.id);
                            }
                          }}
                          className="py-2 px-3 rounded-lg border border-zinc-900 hover:bg-zinc-900 text-zinc-400 hover:text-white font-bold text-[10px] uppercase tracking-wider transition-colors"
                        >
                          Deactivate
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Details & Paytm-style Salary timeline (Shows only when staff card is clicked) */}
          {selectedStaff && (
            <Card className="border border-zinc-900 bg-zinc-950/40 p-5 space-y-5 animate-scaleUp">
              <div className="flex justify-between items-start border-b border-zinc-900 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-white">{selectedStaff.name}</span>
                    <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded bg-zinc-900 border border-zinc-800 text-zinc-400`}>
                      {selectedStaff.status}
                    </span>
                  </div>
                  <p className="text-zinc-500 text-xs font-semibold flex items-center gap-2">
                    <span>Phone: {selectedStaff.phone}</span>
                    <span>•</span>
                    <span>Role: {formatRole(selectedStaff.role)}</span>
                    <span>•</span>
                    <span>Salary: ₹{selectedStaff.monthlySalary}/mo</span>
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedStaffId(null)}
                  className="text-zinc-550 hover:text-zinc-300 font-bold p-1 bg-zinc-900 hover:bg-zinc-800 rounded"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Salary Paytm Timeline */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase text-zinc-400 tracking-wider flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-zinc-500" /> Salary History (Paytm-style)
                </h4>

                {detailsLoading && (
                  <div className="space-y-2 animate-pulse">
                    <div className="h-12 bg-zinc-900 rounded-lg" />
                    <div className="h-12 bg-zinc-900 rounded-lg" />
                  </div>
                )}

                {!detailsLoading && (!selectedStaff.salaryPayments || selectedStaff.salaryPayments.length === 0) && (
                  <div className="py-8 flex flex-col items-center justify-center border border-dashed border-zinc-900 rounded-xl bg-zinc-950/20 text-zinc-500 text-center">
                    <Info className="h-6 w-6 text-zinc-700 mb-1" />
                    <p className="font-bold text-xs">No salary payments logged yet</p>
                    <p className="text-[10px] text-zinc-650 mt-0.5">Click 'Mark Salary Paid' to log transactions.</p>
                  </div>
                )}

                {!detailsLoading && selectedStaff.salaryPayments && selectedStaff.salaryPayments.length > 0 && (
                  <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-900">
                    {selectedStaff.salaryPayments.map((pay) => (
                      <div key={pay.id} className="pl-8 relative text-xs text-left animate-fadeIn">
                        {/* Bullet point */}
                        <div className="absolute left-[9px] top-3.5 h-2 w-2 rounded-full bg-emerald-500 border border-zinc-950 shadow" />
                        
                        <div className="bg-zinc-950/50 border border-zinc-900/80 hover:border-zinc-850 rounded-xl p-3 flex justify-between items-center transition-all">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-white text-[13px]">{pay.salaryMonth} Salary Paid</span>
                              {pay.notes && (
                                <span className="text-[10px] text-zinc-500 italic">({pay.notes})</span>
                              )}
                            </div>
                            <span className="text-[10px] font-bold text-zinc-500 block">
                              Logged on {new Date(pay.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          </div>

                          <span className="font-black text-white text-[14px] flex items-center">
                            <IndianRupee className="h-3.5 w-3.5 text-zinc-400 mr-0.5" />
                            {pay.amount.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Inactive Helpers Section */}
          {inactiveStaff.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-zinc-900">
              <h3 className="text-sm font-black uppercase text-zinc-500 tracking-wider flex items-center gap-1.5">
                <UserMinus className="h-4 w-4 text-zinc-650" /> Deactivated Helpers ({inactiveStaff.length})
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {inactiveStaff.map((staff) => (
                  <Card 
                    key={staff.id} 
                    className={`border border-zinc-950 bg-zinc-950/10 opacity-60 hover:opacity-100 transition-all cursor-pointer`}
                    onClick={() => {
                      setSelectedStaffId(staff.id);
                      setShowAddForm(false);
                    }}
                  >
                    <CardContent className="p-4 flex justify-between items-center">
                      <div className="space-y-1">
                        <span className="text-sm font-bold text-zinc-400 block line-through">{staff.name}</span>
                        <span className="text-[10px] text-zinc-600 block">{formatRole(staff.role)}</span>
                      </div>
                      <span className="text-[10px] font-bold text-zinc-650">
                        Left on {new Date(staff.updatedAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                      </span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pay Salary Modal Dialog */}
      {showPayModal && selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-850 rounded-2xl p-6 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex justify-between items-center border-b border-zinc-850 pb-3">
              <h3 className="text-sm font-black uppercase text-white tracking-wider flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-emerald-400" /> Log Salary Payment
              </h3>
              <button 
                onClick={() => setShowPayModal(false)}
                className="text-zinc-550 hover:text-zinc-300 font-bold p-1 bg-zinc-900 hover:bg-zinc-800 rounded text-xs"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] text-zinc-400 font-medium">
              Record a salary payment transaction for <span className="font-extrabold text-white">{selectedStaff.name}</span>. This will automatically log a PG salary expense transaction.
            </p>

            <form onSubmit={handlePaySubmit} className="space-y-4 text-xs font-semibold">
              {/* Amount */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block">Salary Amount (₹)</label>
                <div className="relative">
                  <input
                    type="number"
                    placeholder="e.g. 15000"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="w-full bg-black border border-zinc-900 h-10 pl-8 pr-3 rounded-lg focus:outline-none focus:border-zinc-800 text-white font-extrabold text-sm"
                    required
                  />
                  <IndianRupee className="h-4 w-4 text-zinc-650 absolute left-2.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* Month */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block">For Salary Month</label>
                <input
                  placeholder="e.g. May 2026"
                  value={salaryMonth}
                  onChange={(e) => setSalaryMonth(e.target.value)}
                  className="w-full bg-black border border-zinc-900 h-10 px-3 rounded-lg focus:outline-none focus:border-zinc-800 text-white"
                  required
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block">Optional Notes</label>
                <textarea
                  placeholder="e.g. Paid via Paytm / Cash..."
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-black border border-zinc-900 focus:border-zinc-800 rounded-lg focus:outline-none transition-all resize-none text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={paySalaryMutation.isPending}
                  className="flex-1 bg-emerald-650 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider h-10 rounded-xl transition-all select-none"
                >
                  {paySalaryMutation.isPending ? 'Logging...' : 'Log Payment'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  className="flex-1 border border-zinc-900 hover:bg-zinc-900 text-zinc-400 hover:text-white font-bold text-xs uppercase tracking-wider h-10 rounded-xl transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StaffPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white p-6">Loading Staff Registry...</div>}>
      <StaffContent />
    </Suspense>
  );
}
