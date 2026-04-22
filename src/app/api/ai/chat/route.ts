import { NextRequest, NextResponse } from "next/server";
import { callAI } from "@/lib/ai/client";
import { readCollection, appendToCollection } from "@/lib/storage";

interface ChatMessage { role: "user" | "assistant"; content: string; ts: string; }

interface ContextData {
  jobs: string;
  txns: string;
  decisions: string;
  routineCount: string;
  goals: string;
}

async function buildContext(): Promise<{ text: string; data: ContextData }> {
  try {
    const [jobs, txns, decisions, routines, goals] = await Promise.all([
      readCollection("jobs-ranked").then(d => d.slice(0, 5)),
      readCollection("transactions").then(d => d.slice(0, 10)),
      readCollection("decisions"),
      readCollection("routines"),
      readCollection("goals"),
    ]);

    const data: ContextData = {
      jobs: (jobs as {title?: string}[]).map(j => j.title).filter(Boolean).join(", ") || "none",
      txns: (txns as {description?: string; amount?: number}[]).map(t => `${t.description} £${t.amount}`).join("; ") || "none",
      decisions: (decisions as {status?: string; title?: string}[]).filter(d => d.status === "open").map(d => d.title).filter(Boolean).join(", ") || "none",
      routineCount: String((routines as unknown[]).length),
      goals: (goals as {title?: string}[]).map(g => g.title).filter(Boolean).join(", ") || "none",
    };

    return {
      text: [
        `Jobs in pipeline: ${data.jobs}`,
        `Recent transactions: ${data.txns}`,
        `Open decisions: ${data.decisions}`,
        `Routines count: ${data.routineCount}`,
        `Goals: ${data.goals}`,
      ].join("\n"),
      data,
    };
  } catch {
    const empty: ContextData = { jobs: "none", txns: "none", decisions: "none", routineCount: "0", goals: "none" };
    return { text: "Context unavailable.", data: empty };
  }
}

function buildFallbackReply(message: string, ctx: ContextData): string {
  const msg = message.toLowerCase();

  if (msg.match(/job|apply|career|role|interview|pipeline/)) {
    return ctx.jobs === "none"
      ? "No jobs in your pipeline yet — run the job search to get started."
      : `Your pipeline: ${ctx.jobs}. Head to the Career tab to review and track applications.`;
  }
  if (msg.match(/budget|money|spend|transaction|afford|finance/)) {
    return ctx.txns === "none"
      ? "No recent transactions found. Add some in the Money tab to track your budget."
      : `Recent transactions: ${ctx.txns}. Check the Money tab for a full breakdown.`;
  }
  if (msg.match(/decision|decide|choice/)) {
    return ctx.decisions === "none"
      ? "No open decisions right now — you're all clear."
      : `Open decisions needing attention: ${ctx.decisions}.`;
  }
  if (msg.match(/goal|target|objective|okr/)) {
    return ctx.goals === "none"
      ? "No goals set yet. Add some in the Goals tab."
      : `Current goals: ${ctx.goals}.`;
  }
  if (msg.match(/routine|habit|streak|today|focus/)) {
    return `You have ${ctx.routineCount} routine${ctx.routineCount === "1" ? "" : "s"} set up. Check the Routines tab for today's focus.`;
  }
  if (msg.match(/week|summary|overview|review|how am i/)) {
    const parts: string[] = [];
    if (ctx.jobs !== "none") parts.push(`Pipeline: ${ctx.jobs}`);
    if (ctx.decisions !== "none") parts.push(`Open decisions: ${ctx.decisions}`);
    if (ctx.goals !== "none") parts.push(`Goals: ${ctx.goals}`);
    return parts.length > 0
      ? parts.join(" · ")
      : "Your Life OS is set up but doesn't have much data yet.";
  }

  // Generic fallback — show what's available
  const snippets: string[] = [];
  if (ctx.jobs !== "none") snippets.push(`jobs: ${ctx.jobs}`);
  if (ctx.decisions !== "none") snippets.push(`decisions: ${ctx.decisions}`);
  if (ctx.goals !== "none") snippets.push(`goals: ${ctx.goals}`);
  return snippets.length > 0
    ? `AI is temporarily offline. Here's what I can see — ${snippets.join(" | ")}.`
    : "AI is temporarily offline. Add data across the Career, Money, and Goals tabs to get started.";
}

export async function POST(req: NextRequest) {
  const { message, history = [] } = await req.json() as { message: string; history: ChatMessage[] };

  const { text: contextText, data: contextData } = await buildContext();
  const conversationHistory = (history as ChatMessage[]).slice(-6)
    .map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");

  const prompt = `You are the Life OS AI assistant. You have access to the user's personal data:
${contextText}

${conversationHistory ? `Conversation so far:\n${conversationHistory}\n` : ""}User: ${message}

Give a helpful, concise response about their career, money, routines, goals, or decisions. Be specific and reference their actual data. Reply in plain text — no JSON.`;

  const result = await callAI({
    taskType: "chat",
    prompt,
    maxTokens: 500,
    rawTextOutput: true,
  });

  const reply = result.success && typeof result.data === "string" && result.data.trim()
    ? result.data.trim()
    : buildFallbackReply(message, contextData);

  const msgs: ChatMessage[] = [
    { role: "user",      content: message, ts: new Date().toISOString() },
    { role: "assistant", content: reply,   ts: new Date().toISOString() },
  ];
  await appendToCollection("chat-history", msgs).catch(() => {});

  return NextResponse.json({ reply });
}

export async function GET() {
  const history = await readCollection<ChatMessage>("chat-history");
  return NextResponse.json({ history: history.slice(-50) });
}
