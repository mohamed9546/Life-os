import { JournalDashboard } from "@/features/journal/journal-dashboard";

export default function JournalPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text-primary">Journal</h1>
        <p className="text-sm text-text-tertiary mt-1">Daily entries, mood tracking, and reflections.</p>
      </div>
      <JournalDashboard />
    </div>
  );
}
