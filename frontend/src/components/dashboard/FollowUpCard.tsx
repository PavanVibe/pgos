'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, IndianRupee, AlertCircle, Phone, ExternalLink } from "lucide-react";
import { fetchApi } from "@/lib/api";

interface FollowUpItem {
  id: string;
  tenantId: string;
  type: 'RENT' | 'DEPOSIT' | 'DAMAGE';
  residentName: string;
  phone: string;
  roomNumber: string;
  amount: number;
  dueDate: string;
  daysOverdue: number;
  label: string;
}

export default function FollowUpCard({ pgId }: { pgId: string }) {
  const { data: response, isLoading, isError } = useQuery({
    queryKey: ['follow-ups', pgId],
    queryFn: () => fetchApi(`/pgs/${pgId}/operations/follow-ups`),
    enabled: !!pgId,
  });

  const followUps: FollowUpItem[] = response?.data || [];

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'RENT': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'DEPOSIT': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'DAMAGE': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      default: return 'bg-zinc-900 text-zinc-400 border-zinc-800';
    }
  };

  const getWhatsAppLink = (item: FollowUpItem) => {
    let cleanPhone = item.phone.replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = `91${cleanPhone}`;
    }

    let text = '';
    if (item.type === 'RENT') {
      text = `Hi ${item.residentName}, friendly reminder that rent of ₹${item.amount.toLocaleString('en-IN')} is outstanding. Please pay at your earliest convenience.`;
    } else if (item.type === 'DEPOSIT') {
      text = `Hi ${item.residentName}, security deposit of ₹${item.amount.toLocaleString('en-IN')} is pending collection. Please settle the balance.`;
    } else if (item.type === 'DAMAGE') {
      text = `Hi ${item.residentName}, damage recovery charges of ₹${item.amount.toLocaleString('en-IN')} are due. Please settle.`;
    }

    return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
  };

  return (
    <Card className="border border-zinc-900 bg-zinc-950/20">
      <CardHeader className="pb-3 border-b border-zinc-900/60">
        <CardTitle className="text-lg flex items-center gap-2 font-black text-white">
          <MessageSquare className="h-5 w-5 text-emerald-400" />
          Follow-Up Center
          <span className="text-[10px] font-semibold text-zinc-500 ml-auto bg-zinc-900 px-2 py-0.5 rounded border border-zinc-850">
            {followUps.length} Actions Pending
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading && (
          <div className="p-5 space-y-4 animate-pulse">
            <div className="h-10 bg-zinc-900 rounded-lg" />
            <div className="h-10 bg-zinc-900 rounded-lg" />
            <div className="h-10 bg-zinc-900 rounded-lg" />
          </div>
        )}

        {isError && (
          <div className="p-5 text-sm text-red-500 font-semibold flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Failed to load follow-ups list.
          </div>
        )}

        {!isLoading && !isError && followUps.length === 0 && (
          <div className="p-6 text-center text-zinc-550 flex flex-col items-center justify-center space-y-2">
            <MessageSquare className="h-8 w-8 text-zinc-700" />
            <p className="font-bold text-sm text-zinc-400">All caught up!</p>
            <p className="text-xs text-zinc-600 mt-1">No residents owe rent, deposits, or damage charges today.</p>
          </div>
        )}

        {!isLoading && !isError && followUps.length > 0 && (
          <div className="divide-y divide-zinc-900/60 max-h-[360px] overflow-y-auto">
            {followUps.map((item) => (
              <div 
                key={item.id} 
                className="p-4 flex items-center justify-between hover:bg-zinc-950/40 transition-colors gap-3"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-white truncate max-w-[120px] sm:max-w-[160px]">
                      {item.residentName}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-bold">
                      Room {item.roomNumber}
                    </span>
                    <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded border ${getBadgeColor(item.type)}`}>
                      {item.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-semibold">
                    <span className="flex items-center text-zinc-300 font-black">
                      <IndianRupee className="h-3 w-3 mr-0.5 text-zinc-450" />
                      {item.amount.toLocaleString('en-IN')}
                    </span>
                    <span>•</span>
                    <span className={item.daysOverdue > 0 ? 'text-red-400 font-bold' : ''}>
                      {item.daysOverdue === 0 ? 'Due today' : `Overdue by ${item.daysOverdue} days`}
                    </span>
                  </div>
                </div>

                <a
                  href={getWhatsAppLink(item)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600/10 hover:bg-emerald-600 text-emerald-400 hover:text-white font-extrabold text-[10px] uppercase tracking-wider transition-all select-none border border-emerald-500/10 hover:border-transparent"
                >
                  <Phone className="h-3.5 w-3.5 fill-current" />
                  <span>WhatsApp</span>
                  <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                </a>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
