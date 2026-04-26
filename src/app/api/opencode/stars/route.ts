import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import {
  deleteStarStory,
  listStarStories,
  saveStarStory,
} from "@/lib/opencode/star-bank";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAppUser();
    const stories = await listStarStories();
    return NextResponse.json({ stories });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load STAR stories" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAppUser();
    const body = (await request.json()) as {
      title?: string;
      tags?: string[];
      situation?: string;
      task?: string;
      action?: string;
      result?: string;
      slug?: string;
    };

    if (!body.title?.trim()) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const story = await saveStarStory({
      title: body.title,
      tags: body.tags || [],
      situation: body.situation || "",
      task: body.task || "",
      action: body.action || "",
      result: body.result || "",
      slug: body.slug,
    });

    return NextResponse.json({ success: true, story });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save STAR story" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAppUser();
    const slug = request.nextUrl.searchParams.get("slug");
    if (!slug) {
      return NextResponse.json({ error: "slug is required" }, { status: 400 });
    }
    await deleteStarStory(slug);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete STAR story" },
      { status: 500 }
    );
  }
}
