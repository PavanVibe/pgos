'use client';

import { 
  UserPlus, 
  LogOut, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle2, 
  Activity 
} from 'lucide-react';

interface TimelineItem {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
}

interface RoomTimelineProps {
  timeline: TimelineItem[];
}

export function RoomTimeline({ timeline }: RoomTimelineProps) {
  if (timeline.length === 0) {
    return (
      <div className="h-48 flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-xl p-4 bg-zinc-950/20 text-center">
        <Activity className="h-8 w-8 text-zinc-700 mb-2" />
        <p className="text-zinc-400 text-sm font-semibold">No operational memory</p>
        <p className="text-zinc-500 text-xs mt-1">This room has no recorded operational events yet.</p>
      </div>
    );
  }

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'onboarding':
        return <UserPlus className="h-4 w-4 text-green-400" />;
      case 'vacate':
        return <LogOut className="h-4 w-4 text-red-400" />;
      case 'payment':
        return <DollarSign className="h-4 w-4 text-emerald-400" />;
      case 'complaint':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'complaint-resolved':
        return <CheckCircle2 className="h-4 w-4 text-indigo-400" />;
      default:
        return <Activity className="h-4 w-4 text-zinc-400" />;
    }
  };

  const getEventBg = (type: string) => {
    switch (type) {
      case 'onboarding':
        return 'bg-green-500/10 border-green-500/20';
      case 'vacate':
        return 'bg-red-500/10 border-red-500/20';
      case 'payment':
        return 'bg-emerald-500/10 border-emerald-500/20';
      case 'complaint':
        return 'bg-amber-500/10 border-amber-500/20';
      case 'complaint-resolved':
        return 'bg-indigo-500/10 border-indigo-500/20';
      default:
        return 'bg-zinc-800/60 border-zinc-700/30';
    }
  };

  return (
    <div className="relative pl-6 border-l border-zinc-850 space-y-6 py-2">
      {timeline.map((item, idx) => (
        <div key={item.id || idx} className="relative group">
          {/* Timeline Node Icon wrapper */}
          <span 
            className={`absolute -left-[37px] top-1.5 flex h-7 w-7 items-center justify-center rounded-full border shadow-sm transition-all duration-300 group-hover:scale-110
              ${getEventBg(item.type)}`}
          >
            {getEventIcon(item.type)}
          </span>

          <div className="space-y-1 bg-zinc-950/40 hover:bg-zinc-950/70 border border-zinc-900 rounded-xl p-3.5 transition-all duration-300 hover:border-zinc-800 shadow-sm">
            <div className="flex justify-between items-start">
              <h5 className="text-xs font-bold text-zinc-150 uppercase tracking-wide">
                {item.title}
              </h5>
              <time className="text-[10px] text-zinc-500 font-semibold">
                {new Date(item.timestamp).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </time>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed font-medium">
              {item.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
