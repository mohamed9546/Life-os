import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { JdArchiveBrowser } from "@/features/career/jd-archive-browser";
import { getCurrentAppUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function CareerJdArchivePage() {
  const user = await getCurrentAppUser();
  if (!user) {
    redirect("/");
  }

  return (
    <div>
      <PageHeader
        title="Career JD Archive"
        subtitle="Browse ingested job documents, triage results, and extracted role requirements."
        actions={<Link className="btn-secondary btn-sm" href="/career">Back to Career</Link>}
      />
      <JdArchiveBrowser />
    </div>
  );
}
