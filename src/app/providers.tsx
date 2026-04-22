"use client";

import { Toaster } from "react-hot-toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: "var(--surface-2)",
            color: "var(--text-primary)",
            border: "1px solid var(--surface-3)",
            borderRadius: "12px",
            fontSize: "13px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
          },
          success: {
            iconTheme: { primary: "#22c55e", secondary: "var(--surface-2)" },
            duration: 4000,
          },
          error: {
            iconTheme: { primary: "#ef4444", secondary: "var(--surface-2)" },
            duration: 6000,
          },
        }}
      />
    </>
  );
}
