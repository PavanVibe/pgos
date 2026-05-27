'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Clock, DoorOpen, CreditCard, LogOut, AlertTriangle, ArrowRight } from "lucide-react";
import { useOnboardingStore } from "@/store/useOnboardingStore";
import { useVacateStore } from "@/store/useVacateStore";
import { useRentStore } from "@/store/useRentStore";
import { useComplaintStore } from "@/store/useComplaintStore";
import { fetchApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "sonner";

interface TaskItem {
  id: string;
  title: string;
  subtitle: string;
  type: 'complaint' | 'invoice' | 'vacate' | 'onboarding';
  urgency: 'high' | 'medium' | 'low';
  actionLabel: string;
}

export default function TodaysTasksPanel({ pgId }: { pgId: string }) {
  const { openOnboarding } = useOnboardingStore();
  const { openVacate } = useVacateStore();
  const { openMarkPaid, openOverdue } = useRentStore();
  const { openViewComplaint } = useComplaintStore();

  const { data: response, isLoading, isError } = useQuery({
    queryKey: queryKeys.dashboard.tasks(pgId),
    queryFn: () => fetchApi(`/pgs/${pgId}/dashboard/tasks`),
    enabled: !!pgId,
  });

  const getIcon = (taskId: string, type: string) => {
    if (taskId === 'overdue_invoices') {
      return <AlertTriangle className="h-4.5 w-4.5 text-red-400" />;
    }
    if (taskId === 'due_today_collections') {
      return <CreditCard className="h-4.5 w-4.5 text-amber-400" />;
    }
    if (taskId === 'chronic_delay_tenants') {
      return <AlertCircle className="h-4.5 w-4.5 text-orange-400" />;
    }

    switch (type) {
      case 'invoice':
        return <CreditCard className="h-4.5 w-4.5 text-zinc-400" />;
      case 'complaint':
        return <AlertCircle className="h-4.5 w-4.5 text-red-400" />;
      case 'vacate':
        return <LogOut className="h-4.5 w-4.5 text-orange-400" />;
      case 'onboarding':
      default:
        return <DoorOpen className="h-4.5 w-4.5 text-green-400" />;
    }
  };

  const getUrgencyClass = (taskId: string, urgency: string) => {
    if (taskId === 'overdue_invoices') {
      return 'bg-red-500/10 border border-red-500/20 text-red-400';
    }
    if (taskId === 'due_today_collections') {
      return 'bg-amber-500/10 border border-amber-500/20 text-amber-400';
    }
    if (taskId === 'chronic_delay_tenants') {
      return 'bg-orange-500/10 border border-orange-500/20 text-orange-400';
    }
    if (urgency === 'high') {
      return 'bg-red-500/10 border border-red-500/20 text-red-400';
    }
    if (urgency === 'medium') {
      return 'bg-amber-500/10 border border-amber-500/20 text-amber-400';
    }
    return 'bg-zinc-900 border border-zinc-800 text-zinc-400';
  };

  const getAction = (task: TaskItem) => {
    if (task.id === 'overdue_invoices') {
      return () => openOverdue('overdue');
    }
    if (task.id === 'due_today_collections') {
      return () => openOverdue('due-today');
    }
    if (task.id === 'chronic_delay_tenants') {
      return () => openOverdue('chronic');
    }
    if (task.id === 'rent_due_tomorrow') {
      return () => openOverdue('all-unpaid');
    }

    switch (task.type) {
      case 'onboarding':
        return () => openOnboarding(pgId);
      case 'vacate':
        return () => openVacate();
      case 'invoice':
        return () => openMarkPaid();
      case 'complaint':
        return async () => {
          try {
            const complaintsResponse = await fetchApi(`/pgs/${pgId}/complaints`);
            const pending = complaintsResponse?.data?.filter((c: any) => c.status === 'PENDING' || c.status === 'ESCALATED') || [];
            if (pending.length > 0 && pending[0]) {
              openViewComplaint(pending[0].id);
            } else {
              toast.error('No pending complaints found.');
            }
          } catch (error: any) {
            toast.error('Failed to locate pending complaints.');
          }
        };
      default:
        return () => console.log('Action triggered:', task.type);
    }
  };

  const tasks: TaskItem[] = response?.data || [];
  
  // Enforcing strict task card density limits for a calm UI
  const visibleTasks = tasks.slice(0, 5);
  const remainingCount = Math.max(0, tasks.length - 5);

  return (
    <Card className="col-span-1 lg:col-span-2 border border-zinc-900 bg-zinc-950/20">
      <CardHeader className="pb-3 border-b border-zinc-900/60">
        <CardTitle className="text-sm font-black uppercase tracking-wider text-zinc-450 flex items-center gap-2 text-zinc-300">
          <Clock className="h-4.5 w-4.5 text-primary" />
          Today's Tasks
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3.5 pt-4">
        {isLoading && (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-900 bg-zinc-950/30">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 bg-zinc-900 rounded-full" />
                  <div className="space-y-2">
                    <div className="h-4 w-32 bg-zinc-900 rounded" />
                    <div className="h-3 w-24 bg-zinc-900 rounded" />
                  </div>
                </div>
                <div className="h-7 w-16 bg-zinc-900 rounded" />
              </div>
            ))}
          </div>
        )}

        {isError && (
          <div className="text-center text-xs text-red-500 py-6 border border-dashed border-red-950/40 rounded-xl bg-red-950/5 font-semibold">
            Failed to retrieve operational task list.
          </div>
        )}

        {!isLoading && !isError && tasks.length === 0 && (
          <div className="text-center text-xs text-zinc-500 font-bold uppercase tracking-widest py-10 border border-dashed border-zinc-900 rounded-xl bg-zinc-950/5">
            You're all caught up for today!
          </div>
        )}

        {!isLoading && !isError && visibleTasks.map((task) => (
          <div 
            key={task.id} 
            className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-900/60 bg-zinc-950/40 hover:border-zinc-800 hover:bg-zinc-900/10 transition-all duration-200"
          >
            <div className="flex items-center gap-3.5">
              <div className={`p-2 rounded-xl border ${getUrgencyClass(task.id, task.urgency)}`}>
                {getIcon(task.id, task.type)}
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-black text-zinc-150 text-zinc-200">{task.title}</p>
                <p className="text-[11px] font-medium text-zinc-500">{task.subtitle}</p>
              </div>
            </div>
            <button
              onClick={getAction(task)}
              className="text-[10px] font-bold uppercase tracking-widest bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white px-3.5 py-2 rounded-lg border border-zinc-800 transition-colors flex items-center gap-1 active:scale-[0.98]"
            >
              {task.actionLabel}
              <ArrowRight className="h-3 w-3 text-zinc-500" />
            </button>
          </div>
        ))}

        {/* Dynamic overflow card indicator to limit density */}
        {!isLoading && !isError && remainingCount > 0 && (
          <div className="text-center text-[10px] font-bold text-zinc-500 uppercase tracking-widest py-3 border border-dashed border-zinc-900 rounded-xl bg-zinc-950/10">
            +{remainingCount} more operational item{remainingCount !== 1 ? 's' : ''} requiring attention
          </div>
        )}
      </CardContent>
    </Card>
  );
}
