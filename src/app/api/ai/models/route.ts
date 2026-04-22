import { NextResponse } from "next/server";
import { loadAIConfig } from "@/lib/ai/config";

export const dynamic = "force-dynamic";

interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
}

interface OllamaTagsResponse {
  models: OllamaModel[];
}

export async function GET() {
  try {
    const config = await loadAIConfig();
    const baseUrl = config.baseUrl || process.env.OLLAMA_BASE_URL || (process.env.NODE_ENV === "production" ? "" : "http://localhost:11434");

    const res = await fetch(`${baseUrl}/api/tags`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Ollama returned ${res.status}`, models: [] },
        { status: 200 }
      );
    }

    const data = (await res.json()) as OllamaTagsResponse;
    const models = (data.models || []).map((m) => ({
      name: m.name,
      size: m.size,
      modifiedAt: m.modified_at,
    }));

    return NextResponse.json({ models });
  } catch {
    return NextResponse.json({ models: [], error: "Ollama not reachable" });
  }
}
