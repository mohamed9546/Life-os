import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import {
  getApplicationProfile,
  saveApplicationProfile,
} from "@/lib/applications/storage";
import { ApplicationProfile } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireAppUser();
    const profile = await getApplicationProfile(user.id, user.email);
    return NextResponse.json({ success: true, profile });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to load application profile",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAppUser();
    const current = await getApplicationProfile(user.id, user.email);
    const body = (await request.json()) as Partial<ApplicationProfile>;
    await saveApplicationProfile({
      ...current,
      ...body,
      id: user.id,
      email: body.email || user.email,
      updatedAt: new Date().toISOString(),
    });
    const profile = await getApplicationProfile(user.id, user.email);
    return NextResponse.json({ success: true, profile });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to save application profile",
      },
      { status: 500 }
    );
  }
}
