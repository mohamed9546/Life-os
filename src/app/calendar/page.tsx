import { CalendarView } from "@/features/calendar/calendar-view";

export default function CalendarPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text-primary">Calendar</h1>
        <p className="text-sm text-text-tertiary mt-1">Unified view of routines, decisions, goals, and journal entries.</p>
      </div>
      <CalendarView />
    </div>
  );
}
