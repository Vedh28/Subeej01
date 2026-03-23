import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import Seed3DViewer from "../components/Seed3DViewer";
import AnalysisCard from "../components/AnalysisCard";
import { defaultDashboardAnalysis, readDashboardAnalysisState } from "../../lib/dashboard-analysis-state";

export default function SeedIntelligencePage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [analysis, setAnalysis] = useState(defaultDashboardAnalysis);

  useEffect(() => {
    setAnalysis(readDashboardAnalysisState());
  }, []);

  return (
    <div className="min-h-screen bg-seed-beige">
      <div className="flex min-h-screen">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <div className="flex-1 flex flex-col min-w-0">
          <Navbar title="Seed Intelligence" onMenuClick={() => setIsSidebarOpen(true)} />
          <main className="flex-1 p-6 bg-grid bg-[length:90px_90px] min-w-0">
            <div className="grid gap-8 max-w-6xl mx-auto animate-fadeUp">
              <AnalysisCard title="Seed Intelligence Report" subtitle="LLM-generated seed summary" className="neo-card">
                <div className="grid gap-8 md:grid-cols-[1.1fr_0.9fr]">
                  <div className="flex flex-col gap-5 text-base leading-relaxed text-seed-dark/75">
                    <p>
                      {analysis.seed_data.compatibility}
                    </p>
                    <p>
                      {analysis.seed_data.ideal_conditions}
                    </p>
                    <p>
                      {analysis.seed_data.expected_yield}
                    </p>
                  </div>
                  <div className="grid gap-4 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-seed-dark/50">Seed</span>
                        <span className="font-semibold">{analysis.seed_data.seed}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-seed-dark/50">Compatibility</span>
                        <span className="font-semibold">{analysis.seed_data.compatibility}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-seed-dark/50">Ideal Conditions</span>
                        <span className="font-semibold">{analysis.seed_data.ideal_conditions}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-seed-dark/50">Expected Yield</span>
                        <span className="font-semibold">{analysis.seed_data.expected_yield}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 mt-2">
                      <span className="text-xs text-seed-dark/50">Key Notes</span>
                      <ul className="text-sm text-seed-dark/70 space-y-1">
                        {analysis.ai_insights.map((note) => (
                          <li key={note}>{note}</li>
                        ))}
                      </ul>
                    </div>
                      <Seed3DViewer seedName={analysis.seed_data.seed} />
                  </div>
                </div>
              </AnalysisCard>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
