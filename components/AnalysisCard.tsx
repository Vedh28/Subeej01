import { ReactNode } from "react";

interface AnalysisCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

export default function AnalysisCard({ title, subtitle, children, className }: AnalysisCardProps) {
  return (
    <div className={`glass-card rounded-3xl p-6 shadow-card card-animate w-full min-w-0 ${className ?? ""}`}>
      <div className="flex flex-col gap-1 mb-4">
        <h3 className="text-base font-semibold text-seed-dark">{title}</h3>
        {subtitle ? <p className="text-xs text-seed-dark/60">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}
