import { FormEvent, useState } from "react";

interface ChatMessage {
  sender: "user" | "ai";
  text: string;
}

const starterMessages: ChatMessage[] = [
  {
    sender: "ai",
    text: "Hi Hemant, I can help analyze sowing windows and field conditions. Ask me anything."
  },
  {
    sender: "ai",
    text: "Try: What seed should I sow in this field next week?"
  }
];

export default function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>(starterMessages);
  const [input, setInput] = useState("");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    setMessages((prev) => [
      ...prev,
      { sender: "user", text: trimmed },
      {
        sender: "ai",
        text: "LLM response placeholder. We'll connect the live model here soon."
      }
    ]);
    setInput("");
  };

  return (
    <div className="glass-card rounded-3xl p-6 flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold">Subeej Chat</h4>
          <p className="text-xs text-seed-dark/60">LLM assistant for agronomy decisions</p>
        </div>
        <span className="text-[10px] px-2 py-1 rounded-full bg-seed-green/10 text-seed-green">
          Mock
        </span>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-3">
        {messages.map((message, index) => (
          <div
            key={`${message.sender}-${index}`}
            className={`rounded-2xl px-4 py-3 text-sm max-w-[90%] ${
              message.sender === "user"
                ? "ml-auto bg-seed-green text-white"
                : "ai-bubble text-seed-dark/80"
            }`}
          >
            {message.text}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-3">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask about seed compatibility, yield, or weather."
          className="flex-1 rounded-2xl border border-seed-green/20 bg-white/80 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-seed-green/30"
        />
        <button
          type="submit"
          className="rounded-2xl bg-seed-brown px-4 py-3 text-white text-sm font-medium hover:bg-seed-brown/90 transition"
        >
          Send
        </button>
      </form>
    </div>
  );
}
