import { FormEvent, useEffect, useState } from "react";
import { readChatSessionState, StoredChatMessage, writeChatSessionState } from "../../lib/chat-session-state";
import { getApiUrl } from "../../lib/api-base";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";

interface StructuredResponse {
  intent?: string;
  response_mode?: string;
  title?: string;
  recommendation?: string;
  suitable_conditions?: string[];
  why?: string;
  missing_details_needed?: string[];
  follow_up_question?: string;
  final_answer?: string;
  quick_actions?: string[];
}

interface ChatMessage extends StoredChatMessage {
  structured?: StructuredResponse;
}

interface ChatApiResponse {
  reply?: string;
  error?: string;
  details?: string;
  session_id?: string;
  structured_response?: StructuredResponse;
}

const starterMessages: ChatMessage[] = [
  {
    sender: "ai",
    text: "Welcome to Subeej Chat. Ask about crop recommendations, soil suitability, disease help, fertilizer guidance, or yield estimates.",
    structured: {
      title: "Subeej Agriculture Assistant",
      final_answer:
        "I can help with crop recommendations, soil suitability, seed choice, fertilizer guidance, disease support, weather-related farming questions, and yield estimation."
    }
  }
];

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readChatResponse(response: Response): Promise<ChatApiResponse> {
  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return JSON.parse(text) as ChatApiResponse;
  }

  if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
    throw new Error("temporary_html_response");
  }

  throw new Error(text || "Chat API returned an unexpected response.");
}

async function requestChatReply(body: {
  message: string;
  history: Array<{ role: string; content: string }>;
  session_id?: string;
}) {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(getApiUrl("/api/llm/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const data = await readChatResponse(response);
      return { response, data };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("request_failed");
      if (lastError.message !== "temporary_html_response" || attempt === 1) {
        break;
      }
      await delay(500);
    }
  }

  throw lastError || new Error("request_failed");
}

function toUserSafeError(error: unknown) {
  if (!(error instanceof Error)) {
    return "Service is temporarily unavailable. Please try again.";
  }

  if (error.message === "temporary_html_response") {
    return "Service is temporarily unavailable. Please try again in a few seconds.";
  }

  if (error.message.includes("Failed to fetch")) {
    return "Unable to reach the chat service right now. Please try again.";
  }

  return error.message || "Service is temporarily unavailable. Please try again.";
}

function ResponseCard({
  message
}: {
  message: ChatMessage;
}) {
  const structured = message.structured;

  if (!structured) {
    return <p className="chat-paragraph">{message.text}</p>;
  }

  return (
    <div className="chat-response-stack">
      {structured.title ? <div className="chat-response-title">{structured.title}</div> : null}
      <p className="chat-paragraph">{structured.final_answer || message.text}</p>

      {structured.recommendation ? (
        <section className="chat-section-card">
          <div className="chat-section-title">Recommendation</div>
          <p className="chat-paragraph">{structured.recommendation}</p>
        </section>
      ) : null}

      {structured.suitable_conditions?.length ? (
        <section className="chat-section-card">
          <div className="chat-section-title">Suitable Conditions</div>
          <div className="chat-chip-row">
            {structured.suitable_conditions.map((item) => (
              <span key={item} className="chat-condition-chip">
                {item}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {structured.why ? (
        <section className="chat-section-card">
          <div className="chat-section-title">Why This Fits</div>
          <p className="chat-paragraph">{structured.why}</p>
        </section>
      ) : null}

      {structured.follow_up_question ? (
        <section className="chat-section-card">
          <div className="chat-section-title">Need From You Next</div>
          <p className="chat-paragraph">{structured.follow_up_question}</p>
        </section>
      ) : null}
    </div>
  );
}

export default function ChatPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(starterMessages);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sessionId, setSessionId] = useState("");

  useEffect(() => {
    const stored = readChatSessionState();
    if (stored.messages.length) {
      setMessages(stored.messages as ChatMessage[]);
    }
    if (stored.sessionId) {
      setSessionId(stored.sessionId);
    }
  }, []);

  useEffect(() => {
    writeChatSessionState({ messages, sessionId });
  }, [messages, sessionId]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const nextMessages = [...messages, { sender: "user" as const, text: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setIsSending(true);

    try {
      const history = nextMessages
        .slice(0, -1)
        .map((message) => ({
          role: message.sender === "user" ? "user" : "assistant",
          content: message.structured?.final_answer || message.text
        }));

      const { response, data } = await requestChatReply({
        message: trimmed,
        history,
        session_id: sessionId || undefined
      });

      if (data.session_id) {
        setSessionId(data.session_id);
      }
      if (!response.ok || !data.reply) {
        throw new Error(data.details || data.error || "Unable to get a response right now.");
      }

      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: data.reply || "",
          structured: data.structured_response
        }
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: toUserSafeError(error),
          structured: {
            title: "Chat Service",
            final_answer: toUserSafeError(error)
          }
        }
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-seed-beige">
      <div className="flex min-h-screen">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <div className="flex-1 flex flex-col">
          <Navbar title="Subeej Chat" onMenuClick={() => setIsSidebarOpen(true)} />
          <main className="flex-1 px-6 pb-8">
            <div className="glass-card rounded-3xl p-6 mt-6 h-[calc(100vh-9rem)] flex flex-col animate-fadeUp">
              <div className="flex items-center justify-between border-b border-seed-green/10 pb-4">
                <div>
                  <h2 className="text-lg font-semibold">Chat with Subeej AI</h2>
                  <p className="text-xs text-seed-dark/60">Controlled LLM-first agriculture assistant.</p>
                </div>
                <span className="text-[10px] px-2 py-1 rounded-full bg-seed-green/10 text-seed-green">Live</span>
              </div>
              <div className="flex-1 overflow-y-auto py-6 space-y-5">
                {messages.map((message, index) => (
                  <div key={`${message.sender}-${index}`} className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`px-5 py-4 text-[15px] max-w-[84%] ${
                        message.sender === "user"
                          ? "rounded-[24px] bg-seed-green text-white leading-7 shadow-sm"
                          : "chatgpt-ai-bubble chat-ai-message text-seed-dark/90"
                      }`}
                    >
                      {message.sender === "user" ? (
                        message.text
                      ) : (
                        <ResponseCard message={message} />
                      )}
                    </div>
                  </div>
                ))}

                {isSending ? (
                  <div className="flex justify-start">
                    <div className="chat-loading-card">
                      <div className="chat-loading-bar" />
                      <div className="chat-loading-bar short" />
                      <div className="chat-loading-label">Analyzing your farm query and preparing a structured recommendation...</div>
                    </div>
                  </div>
                ) : null}
              </div>

              <form onSubmit={handleSubmit} className="border-t border-seed-green/10 pt-4">
                <div className="flex items-center gap-3">
                  <input
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="Ask about crop recommendation, soil suitability, disease help, or yield estimate."
                    className="flex-1 rounded-2xl border border-seed-green/20 bg-white/80 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-seed-green/30"
                    disabled={isSending}
                  />
                  <button type="submit" className="btn-secondary" disabled={isSending}>
                    {isSending ? "Thinking..." : "Send"}
                  </button>
                </div>
              </form>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
