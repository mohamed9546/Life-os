import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import { createDecision, getDecisions } from "@/lib/decisions/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireAppUser();
    const decisions = await getDecisions(user.id);
    return NextResponse.json({ decisions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load decisions" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAppUser();
    const body = await request.json();
    const {
      title,
      context,
      options,
      chosenOption,
      outcome,
      status,
    } = body as {
      title?: string;
      context?: string;
      options?: string[];
      chosenOption?: string;
      outcome?: string;
      status?: "open" | "decided" | "reviewed";
    };

    if (!title || !context || !options || options.length === 0) {
      return NextResponse.json(
        { error: "title, context, and at least one option are required" },
        { status: 400 }
      );
    }

    const decision = await createDecision(
      {
        title,
        context,
        options,
        chosenOption,
        outcome,
        status: status || "open",
      },
      user.id
    );

    return NextResponse.json({ success: true, decision });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create decision" },
      { status: 500 }
    );
  }
}
