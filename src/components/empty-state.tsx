"use client";

import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-surface-2 border border-surface-3 flex items-center justify-center mb-4">
        <Icon size={24} className="text-text-tertiary" />
      </div>
      <h3 className="text-sm font-semibold text-text-primary mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-text-tertiary max-w-xs leading-relaxed">{description}</p>
      )}
      {action && (
        <button onClick={action.onClick} className="btn-primary btn-sm mt-4">
          {action.label}
        </button>
      )}
    </div>
  );
}
