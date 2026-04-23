"use client";

import { useState, useEffect, useRef } from "react";
import { Send, Loader2, MessageSquare, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import { useAIHealth } from "@/hooks/use-ai-health";

interface Message { role: "user" | "assistant"; content: string; ts: string; }

const CHIPS = [
  "Summarise my week",
  "Best jobs to apply to",
  "Am I on budget?",
  "What decisions are overdue?",
  "How are my routines going?",
  "What should I focus on today?",
];

export function AIChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { health, config } = useAIHealth(60_000);
  const agentLabel = health?.primaryModel || config?.model || "Life OS AI";

  useEffect(() => {
    fetch("/api/ai/chat")
      .then(r => r.json())
      .then(d => setMessages(d.history ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg) return;
    setInput("");
    const userMsg: Message = { role: "user", content: msg, ts: new Date().toISOString() };
    setMessages(m => [...m, userMsg]);
    setLoading(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, history: messages.slice(-6) }),
      });
      const d = await res.json();
      const aiMsg: Message = { role: "assistant", content: d.reply, ts: new Date().toISOString() };
      setMessages(m => [...m, aiMsg]);
    } catch {
      toast.error("AI unavailable");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-accent-subtle border border-accent/20 flex items-center justify-center mx-auto mb-4">
              <Sparkles size={24} className="text-accent" />
            </div>
            <h2 className="text-sm font-semibold text-text-primary mb-1">{agentLabel}</h2>
            <p className="text-xs text-text-tertiary max-w-xs mx-auto">Ask me anything about your career, money, routines, or goals.</p>
          </div>
        )}
        <div className="flex flex-col gap-3">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              {m.role === "assistant" && (
                <div className="w-6 h-6 rounded-full bg-accent-subtle border border-accent/20 flex items-center justify-center flex-shrink-0 mr-2 mt-1">
                  <Sparkles size={12} className="text-accent" />
                </div>
              )}
              <div className={m.role === "user" ? "chat-bubble-user" : "chat-bubble-ai"}>
                <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-accent-subtle flex items-center justify-center"><Sparkles size={12} className="text-accent" /></div>
              <div className="chat-bubble-ai flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-text-tertiary" />
                <span className="text-text-tertiary">Thinking…</span>
              </div>
            </div>
          )}
        </div>
        <div ref={bottomRef} />
      </div>

      {/* Chips */}
      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {CHIPS.map(c => (
            <button key={c} onClick={() => send(c)} className="px-3 py-1.5 rounded-full bg-surface-2 border border-surface-3 text-xs text-text-secondary hover:border-accent/30 hover:text-text-primary transition-all duration-150">
              {c}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex items-end gap-2 bg-surface-1 border border-surface-3 rounded-xl p-2">
        <textarea
          className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary resize-none outline-none min-h-[40px] max-h-[120px] py-2 px-2"
          placeholder="Ask anything about your life data…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          rows={1}
        />
        <button
          onClick={() => send()}
          disabled={loading || !input.trim()}
          className="btn-primary btn-sm p-2 aspect-square flex-shrink-0"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
