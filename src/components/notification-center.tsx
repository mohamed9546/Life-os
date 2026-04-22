"use client";

import { Bell, X, CheckCheck, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";

interface Notification {
  id: string;
  title: string;
  body: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean;
  createdAt: string;
}

const TYPE_COLORS: Record<string, string> = {
  info:    "bg-info text-info",
  success: "bg-success text-success",
  warning: "bg-warning text-warning",
  error:   "bg-danger text-danger",
};

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => setNotifications(d.notifications ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await fetch("/api/notifications", { method: "PATCH", body: JSON.stringify({ action: "mark-all-read" }) });
  }

  async function clearAll() {
    setNotifications([]);
    await fetch("/api/notifications", { method: "DELETE" });
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="btn-icon btn-ghost text-text-tertiary hover:text-text-primary relative"
        aria-label="Notifications"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-accent text-white text-2xs flex items-center justify-center font-bold">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 glass-panel animate-slide-down z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-3">
            <span className="text-sm font-semibold text-text-primary">Notifications</span>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button onClick={markAllRead} className="btn-ghost btn-sm gap-1 text-text-tertiary" title="Mark all read">
                  <CheckCheck size={13} />
                </button>
              )}
              {notifications.length > 0 && (
                <button onClick={clearAll} className="btn-ghost btn-sm gap-1 text-text-tertiary" title="Clear all">
                  <Trash2 size={13} />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="btn-ghost btn-sm text-text-tertiary">
                <X size={13} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-center text-xs text-text-tertiary py-8">No notifications</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-surface-3/50 transition-colors ${
                    n.read ? "opacity-60" : "bg-surface-2/30"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className={`status-dot mt-1 ${TYPE_COLORS[n.type].split(" ")[0]}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-text-primary">{n.title}</p>
                      <p className="text-2xs text-text-tertiary mt-0.5">{n.body}</p>
                      <p className="text-2xs text-text-tertiary mt-1">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
