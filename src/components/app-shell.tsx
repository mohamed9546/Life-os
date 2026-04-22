import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";
import { AuthenticatedAppUser } from "@/types";

export function AppShell({
  user,
  children,
}: {
  user: AuthenticatedAppUser;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(148,163,184,0.08),transparent_32%),radial-gradient(circle_at_top_right,rgba(30,41,59,0.42),transparent_34%),linear-gradient(180deg,#020617_0%,#0f172a_100%)]">
      <Sidebar user={user} />
      <div
        className="main-content flex min-h-screen flex-1 flex-col transition-[margin-left] duration-300"
        style={{ marginLeft: "var(--sidebar-current-width, var(--sidebar-width))" }}
      >
        <TopBar user={user} />
        <main className="min-h-screen px-4 pb-10 pt-[88px] sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1440px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
