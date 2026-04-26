import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import { listArchivedJds, readArchivedJd } from "@/lib/opencode/jd-archive";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireAppUser();
    const slug = request.nextUrl.searchParams.get("slug");
    if (slug) {
      const doc = await readArchivedJd(slug);
      if (!doc) {
        return NextResponse.json({ error: "JD not found" }, { status: 404 });
      }
      return NextResponse.json({ doc });
    }
    const docs = await listArchivedJds();
    return NextResponse.json({ docs });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load JD archive" },
      { status: 500 }
    );
  }
}
