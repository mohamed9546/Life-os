import { NextRequest, NextResponse } from "next/server";

interface ReceiptExtraction {
  merchant: string;
  amount: number;
  date: string;
}

function extractJSON(text: string): ReceiptExtraction | null {
  const match = text.match(/\{[^}]+\}/s);
  if (!match) return null;
  try {
    const raw = JSON.parse(match[0]) as Record<string, unknown>;
    const merchant = typeof raw.merchant === "string" ? raw.merchant.trim() : "";
    const amount = typeof raw.amount === "number"
      ? raw.amount
      : parseFloat(String(raw.amount ?? "0").replace(/[^0-9.-]/g, ""));
    const date = typeof raw.date === "string" ? raw.date.trim() : "";
    if (!merchant && !amount && !date) return null;
    return { merchant, amount: isNaN(amount) ? 0 : amount, date };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let image: string;
  try {
    const body = (await req.json()) as { image?: string };
    if (!body.image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }
    image = body.image;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Strip data URL prefix — Ollama expects raw base64
  const base64 = image.replace(/^data:image\/[^;]+;base64,/, "");

  try {
    const ollamaUrl = process.env.OLLAMA_BASE_URL || (process.env.NODE_ENV === "production" ? "" : "http://localhost:11434");
    const endpoint = `${ollamaUrl}/api/generate`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llava",
        prompt: [
          "Look at this receipt image carefully.",
          "Extract exactly three pieces of information:",
          "1. merchant - the store or business name",
          "2. amount - the total amount paid as a number (no currency symbol)",
          "3. date - the transaction date in YYYY-MM-DD format",
          "Return ONLY a JSON object like this: { \"merchant\": \"Tesco\", \"amount\": 12.50, \"date\": \"2026-04-22\" }",
          "If you cannot determine a value, use an empty string or 0.",
        ].join(" "),
        images: [base64],
        stream: false,
        options: { temperature: 0.1, num_predict: 80 },
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "unknown");
      console.error(`[vision-receipt] Ollama returned ${res.status}: ${errText}`);
      return NextResponse.json(
        { error: `llava model error (${res.status}). Make sure llava is installed: ollama pull llava` },
        { status: 502 }
      );
    }

    const data = (await res.json()) as { response?: string };
    const responseText = data.response ?? "";
    const extracted = extractJSON(responseText);

    if (!extracted) {
      console.warn("[vision-receipt] Could not extract JSON from llava response:", responseText.slice(0, 200));
      return NextResponse.json(
        { error: "Could not read receipt — try a clearer photo" },
        { status: 422 }
      );
    }

    return NextResponse.json(extracted);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[vision-receipt] Error:", msg);
    return NextResponse.json(
      { error: msg.includes("fetch") || msg.includes("connect") ? "Cannot reach Ollama — is it running?" : msg },
      { status: 500 }
    );
  }
}
