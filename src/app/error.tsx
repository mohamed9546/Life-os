"use client";

import { useEffect } from "react";

export default function Error({
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
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <div className="w-12 h-12 rounded-xl bg-danger/10 flex items-center justify-center">
        <span className="text-danger text-xl">!</span>
      </div>
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Something went wrong</h2>
        <p className="text-sm text-text-secondary mt-1 max-w-sm">
          {error.message || "An unexpected error occurred."}
        </p>
      </div>
      <button
        onClick={reset}
        className="btn-primary btn-sm"
      >
        Try again
      </button>
    </div>
  );
}
