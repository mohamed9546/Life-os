import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import { loadAIConfig, saveAIConfig } from "@/lib/ai/config";
import { AIConfig } from "@/types";

export const dynamic = "force-dynamic";

function sanitizeConfig(config: AIConfig) {
  return {
    ...config,
    apiKey: null,
  };
}

export async function GET() {
  try {
    await requireAppUser();
    const config = await loadAIConfig();
    return NextResponse.json(sanitizeConfig(config));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unauthorized" },
      { status: 401 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAppUser();
    const body = (await request.json()) as Partial<AIConfig>;
    delete body.apiKey;
    const config = await saveAIConfig(body);
    return NextResponse.json(sanitizeConfig(config));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update AI config" },
      { status: 500 }
    );
  }
}
