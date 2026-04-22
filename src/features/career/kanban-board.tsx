"use client";

import { useState, useCallback } from "react";
import {
  DndContext, DragEndEvent, DragOverEvent, DragOverlay,
  PointerSensor, useSensor, useSensors, closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import toast from "react-hot-toast";

interface Job {
  id: string;
  title: string;
  company: string;
  fitScore?: number;
  priority?: string;
  status?: string;
  [key: string]: unknown;
}

const COLUMNS = [
  { id: "inbox",     label: "Inbox",     color: "text-text-tertiary" },
  { id: "ranked",    label: "Ranked",    color: "text-info" },
  { id: "tracked",   label: "Tracked",   color: "text-accent" },
  { id: "applied",   label: "Applied",   color: "text-warning" },
  { id: "interview", label: "Interview", color: "text-success" },
  { id: "offer",     label: "Offer",     color: "text-success" },
  { id: "rejected",  label: "Rejected",  color: "text-danger" },
];

function KanbanCard({ job, isDragging }: { job: Job; isDragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: job.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const score = job.fitScore ?? 0;
  const scoreColor = score >= 70 ? "text-success" : score >= 40 ? "text-warning" : "text-danger";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="kanban-card"
    >
      <p className="text-xs font-medium text-text-primary line-clamp-2 mb-1">{job.title}</p>
      <p className="text-2xs text-text-secondary mb-2">{job.company}</p>
      {score > 0 && (
        <div className="flex items-center gap-1.5">
          <div className="flex-1 progress-bar">
            <div
              className={`progress-fill ${score >= 70 ? "bg-success" : score >= 40 ? "bg-warning" : "bg-danger"}`}
              style={{ width: `${score}%` }}
            />
          </div>
          <span className={`text-2xs font-mono font-medium ${scoreColor}`}>{score}</span>
        </div>
      )}
    </div>
  );
}

function KanbanColumn({ column, jobs }: { column: typeof COLUMNS[0]; jobs: Job[] }) {
  return (
    <div className="kanban-column">
      <div className="flex items-center justify-between mb-3">
        <span className={`text-xs font-semibold uppercase tracking-wider ${column.color}`}>
          {column.label}
        </span>
        <span className="text-2xs text-text-tertiary bg-surface-3 rounded-full px-2 py-0.5">
          {jobs.length}
        </span>
      </div>
      <SortableContext items={jobs.map(j => j.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 min-h-[80px]">
          {jobs.map((job) => (
            <KanbanCard key={job.id} job={job} />
          ))}
          {jobs.length === 0 && (
            <div className="border border-dashed border-surface-3 rounded-lg h-16 flex items-center justify-center">
              <span className="text-2xs text-text-tertiary">Drop here</span>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export function KanbanBoard({ jobs }: { jobs: Job[] }) {
  const [items, setItems] = useState<Job[]>(jobs);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const grouped = useCallback(() => {
    const map: Record<string, Job[]> = {};
    COLUMNS.forEach(c => { map[c.id] = []; });
    items.forEach(job => {
      const col = job.status ?? "inbox";
      if (map[col]) map[col].push(job);
      else map["inbox"].push(job);
    });
    return map;
  }, [items]);

  function getJobColumn(id: string) {
    return COLUMNS.find(c => grouped()[c.id]?.some(j => j.id === id))?.id ?? "inbox";
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) { setActiveId(null); return; }

    const fromCol = getJobColumn(active.id as string);
    const toCol = COLUMNS.find(c => c.id === over.id)?.id
      ?? getJobColumn(over.id as string)
      ?? fromCol;

    if (fromCol !== toCol) {
      setItems(prev => prev.map(j => j.id === active.id ? { ...j, status: toCol } : j));
      try {
        await fetch(`/api/jobs/${active.id}/pipeline`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: toCol }),
        });
        toast.success(`Moved to ${toCol}`);
      } catch {
        toast.error("Failed to update job");
      }
    }
    setActiveId(null);
  }

  const g = grouped();
  const activeJob = activeId ? items.find(j => j.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={e => setActiveId(e.active.id as string)}
      onDragEnd={onDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-none">
        {COLUMNS.map(col => (
          <KanbanColumn key={col.id} column={col} jobs={g[col.id] ?? []} />
        ))}
      </div>

      <DragOverlay>
        {activeJob && <KanbanCard job={activeJob} isDragging />}
      </DragOverlay>
    </DndContext>
  );
}
