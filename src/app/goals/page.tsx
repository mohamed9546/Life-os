import { GoalsDashboard } from "@/features/goals/goals-dashboard";
import { ExportButton } from "@/components/export-button";

export default function GoalsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Goals</h1>
          <p className="text-sm text-text-tertiary mt-1">Track your goals and milestones.</p>
        </div>
        <ExportButton module="goals" />
      </div>
      <GoalsDashboard />
    </div>
  );
}
