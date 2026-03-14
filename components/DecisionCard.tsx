interface DecisionCardProps {
  decision: string;
  confidence: string;
  explanation: string;
  className?: string;
}

export default function DecisionCard({ decision, confidence, explanation, className }: DecisionCardProps) {
  return (
    <div className={`glass-card rounded-3xl p-8 shadow-glow border border-seed-green/20 ${className ?? ""}`}>
      <div className="flex flex-col gap-2">
        <div className="text-3xl font-bold text-seed-green">{decision}</div>
        <div className="text-sm text-seed-dark/70">Confidence: {confidence}</div>
        <p className="text-sm text-seed-dark/80 max-w-xl">{explanation}</p>
      </div>
    </div>
  );
}
