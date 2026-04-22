"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html>
      <body style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "system-ui, sans-serif", background: "#0a0a0f", color: "#e2e8f0" }}>
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.5rem" }}>Something went wrong</h2>
          <p style={{ fontSize: "0.875rem", color: "#94a3b8", marginBottom: "1rem" }}>
            {error.message || "A critical error occurred."}
          </p>
          <button
            onClick={reset}
            style={{ padding: "0.5rem 1.25rem", background: "#6366f1", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "0.875rem" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
