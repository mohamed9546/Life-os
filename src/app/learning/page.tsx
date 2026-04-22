import { LearningDashboard } from "@/features/learning/learning-dashboard";
import { ExportButton } from "@/components/export-button";

export default function LearningPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Learning</h1>
          <p className="text-sm text-text-tertiary mt-1">Books, courses, articles, and more.</p>
        </div>
        <ExportButton module="learning" />
      </div>
      <LearningDashboard />
    </div>
  );
}
