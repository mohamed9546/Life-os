"use client";

import { useState, useCallback } from "react";
import { readJsonResponse } from "@/lib/api/safe-json";

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useApi<T>() {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const call = useCallback(
    async (url: string, options?: RequestInit): Promise<T | null> => {
      setState({ data: null, loading: true, error: null });
      try {
        const res = await fetch(url, {
          headers: { "Content-Type": "application/json" },
          ...options,
        });
        const json = await readJsonResponse<{ error?: string } & Record<string, unknown>>(res);
        if (!res.ok) {
          const errMsg = json.error || `HTTP ${res.status}`;
          setState({ data: null, loading: false, error: errMsg });
          return null;
        }
        setState({ data: json as unknown as T, loading: false, error: null });
        return json as unknown as T;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Request failed";
        setState({ data: null, loading: false, error: errMsg });
        return null;
      }
    },
    []
  );

  return { ...state, call };
}
