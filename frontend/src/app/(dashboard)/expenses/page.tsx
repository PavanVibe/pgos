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
  FileText,
  Sparkles,
  TrendingDown,
  Layers,
  ArrowRight,
  ShieldCheck,
  X
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface ExpenseItem {
  id: string;
  title: string;
  amount: number;
  category: string;
  incurredAt: string;
  notes: string | null;
  receiptUrl: string | null;
}

function ExpensesContent() {
  const { activePgId, availablePgs, setActivePgId } = useOrganizationStore();
  const queryClient = useQueryClient();

  // Form States
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('MISC');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');

  // Fetch Expenses Timeline List
  const { data: response, isLoading, isError } = useQuery({
    queryKey: ['expenses-timeline', activePgId],
    queryFn: () => fetchApi(`/pgs/${activePgId}/expenses/timeline`),
    enabled: !!activePgId,
  });

  const expenses: ExpenseItem[] = response?.data || [];
  const totalSpent = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  // Add Expense Mutation
  const addExpenseMutation = useMutation({
    mutationFn: (body: any) => {
      return fetchApi(`/pgs/${activePgId}/expenses`, {
        method: 'POST',
        body: JSON.stringify(body)
      });
    },
    onSuccess: () => {
      toast.success('Expense recorded successfully.');
      queryClient.invalidateQueries({ queryKey: ['expenses-timeline', activePgId] });
      queryClient.invalidateQueries({ queryKey: ['profit-summary', activePgId] });
      setTitle('');
      setAmount('');
      setCategory('MISC');
      setNotes('');
      setReceiptUrl('');
      setShowAddForm(false);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to record expense.');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Please specify a valid expense amount.');
      return;
    }
    if (!title.trim()) {
      toast.error('Please enter an expense title.');
      return;
    }

    addExpenseMutation.mutate({
      title: title.trim(),
      amount: parsedAmount,
      category,
      incurredAt: date,
      notes: notes.trim() || undefined,
      receiptUrl: receiptUrl.trim() || undefined
    });
  };

  const getCategoryColor = (cat: string) => {
    switch (cat.toUpperCase()) {
      case 'ELECTRICITY': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'WATER': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'INTERNET': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      case 'SALARY': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'FOOD': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'MAINTENANCE': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'FURNITURE': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      default: return 'bg-zinc-900 text-zinc-400 border-zinc-800';
    }
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
              Expense Manager
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
                <TrendingDown className="h-3.5 w-3.5" />
              </span>
            </h1>
            <p className="text-zinc-400 text-sm mt-0.5">Track your PG utility bills, salaries, repairs, and other day-to-day spending.</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Summary and Adding Form */}
        <div className="space-y-6 lg:col-span-1">
          {/* Quick Expense Stats Card */}
          <Card className="border border-zinc-900 bg-zinc-950/20">
            <CardContent className="p-5 space-y-2">
              <span className="text-[10px] font-black text-zinc-550 uppercase tracking-widest block">Total Spent This Month</span>
              <span className="text-3xl font-black text-white block flex items-center">
                <IndianRupee className="h-6 w-6 text-red-500" />
                {totalSpent.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-zinc-500 block">Total PG Operational Expenses recorded.</span>

              {!showAddForm && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-650 hover:bg-red-700 text-white font-extrabold text-xs uppercase tracking-wider transition-all select-none"
                >
                  <Plus className="h-4 w-4 stroke-[3]" /> Add New Expense
                </button>
              )}
            </CardContent>
          </Card>

          {/* Add Expense Form Panel */}
          {showAddForm && (
            <Card className="border border-zinc-900 bg-zinc-950/40 p-5 space-y-4 animate-scaleUp">
              <div className="flex justify-between items-center border-b border-zinc-900 pb-3">
                <h3 className="text-sm font-black uppercase text-white tracking-wider flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-red-400" /> Record Expense
                </h3>
                <button 
                  onClick={() => setShowAddForm(false)}
                  className="text-zinc-550 hover:text-zinc-300 font-bold p-1 bg-zinc-900 hover:bg-zinc-800 rounded"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold">
                {/* Title */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block">Expense Title</label>
                  <input
                    placeholder="e.g. May Electricity Bill, New Table, Room 101 Bulb..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-black border border-zinc-900 h-9 px-3 rounded-lg focus:outline-none focus:border-zinc-800 text-white"
                    required
                  />
                </div>

                {/* Amount & Category */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block">Amount (₹)</label>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="0"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full bg-black border border-zinc-900 h-9 pl-7 pr-3 rounded-lg focus:outline-none focus:border-zinc-800 text-white font-bold"
                        required
                      />
                      <IndianRupee className="h-3.5 w-3.5 text-zinc-650 absolute left-2 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-black border border-zinc-900 h-9 px-2 rounded-lg focus:outline-none focus:border-zinc-800 text-white cursor-pointer"
                    >
                      <option value="ELECTRICITY">Electricity</option>
                      <option value="WATER">Water</option>
                      <option value="INTERNET">Internet</option>
                      <option value="SALARY">Salary</option>
                      <option value="FOOD">Food</option>
                      <option value="MAINTENANCE">Maintenance</option>
                      <option value="FURNITURE">Furniture</option>
                      <option value="MISC">Misc</option>
                    </select>
                  </div>
                </div>

                {/* Date */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block">Expense Date</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full bg-black border border-zinc-900 h-9 pl-9 pr-3 rounded-lg focus:outline-none focus:border-zinc-800 text-white cursor-pointer"
                      required
                    />
                    <Calendar className="h-3.5 w-3.5 text-zinc-650 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block">Optional Notes</label>
                  <textarea
                    placeholder="Provide additional details..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 bg-black border border-zinc-900 focus:border-zinc-800 rounded-lg focus:outline-none transition-all resize-none text-white"
                  />
                </div>

                {/* Receipt Link */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block">Receipt / Bill Photo Link</label>
                  <div className="relative">
                    <input
                      placeholder="e.g. upload link, photo URL..."
                      value={receiptUrl}
                      onChange={(e) => setReceiptUrl(e.target.value)}
                      className="w-full bg-black border border-zinc-900 h-9 pl-9 pr-3 rounded-lg focus:outline-none focus:border-zinc-800 text-white"
                    />
                    <FileText className="h-3.5 w-3.5 text-zinc-650 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={addExpenseMutation.isPending}
                    className="flex-1 bg-red-650 hover:bg-red-700 text-white font-extrabold text-xs uppercase tracking-wider h-10 rounded-xl transition-all select-none"
                  >
                    {addExpenseMutation.isPending ? 'Saving...' : 'Confirm'}
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

        {/* Right Side: Chronological Paytm-Style timeline of expenses */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-black uppercase text-zinc-400 tracking-wider flex items-center gap-1.5">
            <Layers className="h-4 w-4 text-zinc-500" /> Spending Timeline
          </h3>

          {isLoading && (
            <div className="space-y-4 animate-pulse">
              <div className="h-20 bg-zinc-900 rounded-xl" />
              <div className="h-20 bg-zinc-900 rounded-xl" />
              <div className="h-20 bg-zinc-900 rounded-xl" />
            </div>
          )}

          {isError && (
            <div className="h-32 flex flex-col items-center justify-center border border-dashed border-red-950 bg-red-950/5 rounded-2xl text-red-500 font-semibold text-sm">
              Failed to load expenses timeline.
            </div>
          )}

          {!isLoading && !isError && expenses.length === 0 && (
            <div className="h-48 flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-xl bg-zinc-950/20 text-zinc-500 text-center">
              <TrendingDown className="h-8 w-8 text-zinc-700 mb-2" />
              <p className="font-bold text-sm">No expenses recorded yet</p>
              <p className="text-xs text-zinc-650 mt-1">Operational PG expenses will show up on a timeline here.</p>
            </div>
          )}

          {!isLoading && !isError && expenses.length > 0 && (
            <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-900">
              {expenses.map((exp) => (
                <div key={exp.id} className="pl-8 relative text-xs text-left animate-fadeIn">
                  {/* Paytm-style timeline bullet */}
                  <div className="absolute left-[9px] top-4 h-2.5 w-2.5 rounded-full bg-red-500 border border-zinc-950 shadow" />
                  
                  <div className="bg-zinc-950/40 border border-zinc-900 hover:border-zinc-800 rounded-xl p-4 flex justify-between items-start transition-all">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-white">{exp.title}</span>
                        <span className={`px-2 py-0.5 text-[8px] font-extrabold uppercase rounded border ${getCategoryColor(exp.category)}`}>
                          {exp.category}
                        </span>
                      </div>
                      
                      {exp.notes && (
                        <p className="text-zinc-450 text-[11px] font-medium leading-relaxed bg-zinc-950/90 p-2 rounded-lg border border-zinc-900 max-w-lg">
                          {exp.notes}
                        </p>
                      )}

                      {exp.receiptUrl && (
                        <a 
                          href={exp.receiptUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-black text-purple-400 hover:underline tracking-wider uppercase pt-1"
                        >
                          <FileText className="h-3 w-3" /> View Attachment <ArrowRight className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </div>

                    <div className="text-right space-y-1">
                      <span className="text-base font-black text-white block flex items-center justify-end">
                        <IndianRupee className="h-4 w-4 text-zinc-400" />
                        {exp.amount.toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] font-bold text-zinc-500 block">
                        {new Date(exp.incurredAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ExpensesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white p-6">Loading Expense Manager...</div>}>
      <ExpensesContent />
    </Suspense>
  );
}
