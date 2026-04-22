"use client";

import { FormEvent, useMemo, useState } from "react";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";

export function SignInCard() {
  const supabase = useMemo(() => createSupabaseClient(), []);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !email.trim()) return;

    setLoading(true);
    setMessage(null);
    setError(null);

    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/api/auth/callback?next=/welcome`
        : undefined;

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (signInError) {
      setError(signInError.message);
    } else {
      setMessage("Check your email for the Life OS magic link.");
    }

    setLoading(false);
  };

  return (
    <div className="card w-full max-w-md">
      <p className="text-xs font-medium uppercase tracking-[0.24em] text-text-tertiary">
        Life OS
      </p>
      <h1 className="text-3xl font-bold text-text-primary mt-3 tracking-tight">
        Sign in to your personal operating system
      </h1>
      <p className="text-sm text-text-secondary mt-3">
        Magic link access keeps the local-first app simple while we build the
        AI-native layers across career, money, routines, and planning.
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="input"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <button className="btn-primary w-full" disabled={loading || !email.trim()}>
          {loading ? "Sending link..." : "Send magic link"}
        </button>
      </form>

      {message && <p className="text-sm text-success mt-4">{message}</p>}
      {error && <p className="text-sm text-danger mt-4">{error}</p>}
    </div>
  );
}
