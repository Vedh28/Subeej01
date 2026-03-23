interface AIInsightPanelProps {
  messages: string[];
  className?: string;
}

export default function AIInsightPanel({ messages, className }: AIInsightPanelProps) {
  return (
    <div className={`glass-card rounded-3xl p-6 flex flex-col gap-4 ${className ?? ""}`}>
      <h4 className="text-sm font-semibold">AI Insights</h4>
      <div className="flex flex-col gap-3">
        {messages.map((message, index) => (
          <div key={index} className="ai-bubble rounded-2xl px-4 py-3 text-sm text-seed-dark/80">
            {message}
          </div>
        ))}
      </div>
    </div>
  );
}
