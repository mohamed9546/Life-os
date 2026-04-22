"use client";

import { useRouter } from "next/navigation";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";

export function SignOutButton({ mode }: { mode: "preview" | "supabase" }) {
  const router = useRouter();

  const handleClick = async () => {
    const supabase = createSupabaseClient();
    if (mode === "supabase" && supabase) {
      await supabase.auth.signOut();
    }

    router.replace("/");
    router.refresh();
  };

  return (
    <button className="btn-secondary w-full" onClick={handleClick}>
      {mode === "preview" ? "Leave preview" : "Sign out"}
    </button>
  );
}
