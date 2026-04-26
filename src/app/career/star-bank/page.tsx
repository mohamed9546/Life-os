import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { StarBankManager } from "@/features/career/star-bank-manager";
import { getCurrentAppUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function CareerStarBankPage() {
  const user = await getCurrentAppUser();
  if (!user) {
    redirect("/");
  }

  return (
    <div>
      <PageHeader
        title="Career STAR Bank"
        subtitle="Build and maintain reusable STAR stories for CTA, QA, regulatory, and interview preparation."
        actions={<Link className="btn-secondary btn-sm" href="/career">Back to Career</Link>}
      />
      <StarBankManager />
    </div>
  );
}
