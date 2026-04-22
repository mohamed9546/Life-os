import type { Metadata } from "next";
import { getCurrentAppUser } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { CommandPalette } from "@/components/command-palette";
import { QuickCapture } from "@/components/quick-capture";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { Providers } from "./providers";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Personal Life OS",
  description:
    "AI-first second-brain operating system for career, money, routines, decisions, and operational control.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentAppUser();

  return (
    <html lang="en">
      <body className="min-h-screen bg-surface-0 text-text-primary">
        <Providers>
          {user ? (
            <AppShell user={user}>{children}</AppShell>
          ) : (
            <main className="min-h-screen flex items-center justify-center p-6">
              {children}
            </main>
          )}
          {user && (
            <>
              <CommandPalette />
              <QuickCapture />
              <KeyboardShortcuts />
            </>
          )}
        </Providers>
      </body>
    </html>
  );
}
