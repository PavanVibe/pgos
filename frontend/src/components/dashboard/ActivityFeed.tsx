'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, CheckCircle, IndianRupee, LogOut, UserPlus, AlertCircle } from "lucide-react";
import { fetchApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

interface LogItem {
  id: string;
  eventType: string;
  createdAt: string;
  metadata: any;
}

export default function ActivityFeed({ pgId }: { pgId: string }) {
  // Lightweight polling: refetch every 20 seconds
  const { data: response, isLoading, isError } = useQuery({
    queryKey: queryKeys.dashboard.activity(pgId),
    queryFn: () => fetchApi(`/pgs/${pgId}/dashboard/activity`),
    refetchInterval: 20000,
    enabled: !!pgId,
  });

  const logs: LogItem[] = response?.data || [];

  const getIcon = (type: string) => {
    switch (type) {
      case 'TENANT_MOVED_IN':
      case 'RESIDENT_ONBOARDED':
        return <UserPlus className="h-4 w-4 text-primary" />;
      case 'RENT_PAID':
        return <IndianRupee className="h-4 w-4 text-green-500" />;
      case 'COMPLAINT_CREATED':
      case 'COMPLAINT_RAISED':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'COMPLAINT_RESOLVED':
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case 'TENANT_MOVED_OUT':
      case 'RESIDENT_VACATED':
      case 'BED_VACATED':
      default:
        return <LogOut className="h-4 w-4 text-red-500" />;
    }
  };

  const getTimelineText = (log: LogItem) => {
    const meta = log.metadata || {};
    const name = meta.tenantName;
    const room = meta.roomNumber || 'N/A';
    const bed = meta.bedNumber || 'N/A';

    switch (log.eventType) {
      case 'TENANT_MOVED_IN':
      case 'RESIDENT_ONBOARDED':
      case 'BED_ALLOCATED':
        if (!name || name === 'Resident') {
          return `Resident onboarded to Room ${room} — Bed ${bed}`;
        }
        return `${name} onboarded to Room ${room} — Bed ${bed}`;
      case 'TENANT_MOVED_OUT':
      case 'RESIDENT_VACATED':
      case 'BED_VACATED':
        if (!name || name === 'Resident') {
          return `Room ${room} — Bed ${bed} vacated`;
        }
        return `${name} vacated Room ${room} — Bed ${bed}`;
      case 'RENT_PAID':
        if (!name || name === 'Resident') {
          return `Rent payment of ₹${meta.amount?.toLocaleString('en-IN') || '8,500'} received via ${String(meta.method || 'online').toUpperCase()}`;
        }
        return `${name} paid ₹${meta.amount?.toLocaleString('en-IN') || '8,500'} rent via ${String(meta.method || 'online').toUpperCase()}`;
      case 'COMPLAINT_CREATED':
      case 'COMPLAINT_RAISED':
        if (!name || name === 'Resident') {
          return `Complaint raised for Room ${room}: "${meta.description || 'issue'}"`;
        }
        return `${name} raised a complaint for Room ${room}: "${meta.description || 'issue'}"`;
      case 'COMPLAINT_RESOLVED':
        return `Complaint resolved for Room ${room}`;
      default:
        const cleanedType = log.eventType.replace(/_/g, ' ');
        if (/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i.test(cleanedType)) {
          return "Operational event registered";
        }
        return cleanedType;
    }
  };

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <Card className="col-span-1 border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="h-5 w-5 text-muted-foreground" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && (
          <div className="space-y-3 animate-pulse pl-3 pr-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4 items-center">
                <div className="h-6 w-6 bg-muted rounded-full" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3.5 bg-muted rounded w-3/4" />
                  <div className="h-2.5 bg-muted rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        )}

        {isError && (
          <div className="text-center text-sm text-red-500 py-4">
            Failed to load activity feed.
          </div>
        )}

        {!isLoading && !isError && logs.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-8">
            No recent operational events logged.
          </div>
        )}

        {!isLoading && !isError && logs.length > 0 && (
          <div className="relative border-l ml-3 pl-4 space-y-6 max-h-[300px] overflow-y-auto pr-1">
            {logs.map((log) => (
              <div key={log.id} className="relative">
                <div className="absolute -left-[25px] bg-background p-1 rounded-full border">
                  {getIcon(log.eventType)}
                </div>
                <div>
                  <p className="text-sm font-medium pr-1 leading-snug">{getTimelineText(log)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatTime(log.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
