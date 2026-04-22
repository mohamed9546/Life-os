import { HealthDashboard } from "@/features/health/health-dashboard";

export default function HealthPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Health & Wellness</h1>
        <p className="text-text-secondary text-sm mt-1">Track energy, mood, and sleep to understand your wellbeing patterns</p>
      </div>
      <HealthDashboard />
    </div>
  );
}
