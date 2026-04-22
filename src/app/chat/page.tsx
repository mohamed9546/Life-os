import { AIChat } from "@/features/chat/ai-chat";

export default function ChatPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text-primary">AI Chat</h1>
        <p className="text-sm text-text-tertiary mt-1">Your personal AI with access to all your life data.</p>
      </div>
      <AIChat />
    </div>
  );
}
