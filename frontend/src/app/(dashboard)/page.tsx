import QuickActions from "@/components/dashboard/QuickActions";
import OnboardingSheet from "@/components/onboarding/OnboardingSheet";
import TodaysTasksPanel from "@/components/dashboard/TodaysTasksPanel";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import { UniversalActionSheet } from "@/components/shared/UniversalActionSheet";
import { FloatingActionButton } from "@/components/shared/FloatingActionButton";
import ComplaintDrawer from "@/components/complaints/ComplaintDrawer";
import RaiseComplaintSheet from "@/components/complaints/RaiseComplaintSheet";
import MarkPaidSheet from "@/components/rent/MarkPaidSheet";
import VacateResidentSheet from "@/components/vacate/VacateResidentSheet";


export default function DashboardPage() {
  return (
    <main className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight mb-6">Overview</h1>
      
      <QuickActions pgId="demo-pg-123" />
      <OnboardingSheet />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <TodaysTasksPanel pgId="demo-pg-123" />
        <ActivityFeed pgId="demo-pg-123" />
      </div>
      
      {/* Dynamic Occupancy Grid placeholder */}
      <h2 className="text-xl font-semibold mb-4">Live Occupancy Grid</h2>
      <div className="grid grid-cols-4 sm:grid-cols-8 md:grid-cols-12 gap-2">
        {Array.from({ length: 48 }).map((_, i) => (
          <div key={i} className={`h-12 rounded border flex items-center justify-center text-xs font-mono
            ${i % 7 === 0 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
            B{i+1}
          </div>
        ))}
      </div>
      <UniversalActionSheet pgId="demo-pg-123" />
      <FloatingActionButton pgId="demo-pg-123" />

      <ComplaintDrawer />
      <RaiseComplaintSheet />
      <MarkPaidSheet />
      <VacateResidentSheet pgId="demo-pg-123" />
    </main>
  );
}
