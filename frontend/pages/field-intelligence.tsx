import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import AnalysisCard from "../components/AnalysisCard";
import { defaultDashboardAnalysis, readDashboardAnalysisState } from "../../lib/dashboard-analysis-state";

export default function FieldIntelligencePage() {
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
          <Navbar title="Field Intelligence" onMenuClick={() => setIsSidebarOpen(true)} />
          <main className="flex-1 p-6 bg-grid bg-[length:90px_90px] min-w-0">
            <div className="grid gap-8 max-w-6xl mx-auto animate-fadeUp">
              <AnalysisCard title="Field Intelligence Report" subtitle="LLM-generated land summary" className="neo-card">
                <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="flex flex-col gap-5 text-base leading-relaxed text-seed-dark/75">
                    <p>
                      {analysis.ai_decision.explanation}
                    </p>
                    <p>
                      {analysis.ai_insights[0] || "Upload and analyze a field image to populate this report with current field observations."}
                    </p>
                    <p>
                      {analysis.ai_insights[1] || "Field-specific notes will appear here after image analysis."}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-seed-dark/50">Soil Type</span>
                      <span className="font-semibold">{analysis.soil_analysis.soil}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-seed-dark/50">Moisture Level</span>
                      <span className="font-semibold">{analysis.soil_analysis.moisture}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-seed-dark/50">Vegetation Level</span>
                      <span className="font-semibold">{analysis.soil_analysis.vegetation}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-seed-dark/50">Field Health Score</span>
                      <span className="font-semibold">{analysis.soil_analysis.health}</span>
                    </div>
                    <div className="col-span-2 flex flex-col gap-2 mt-2">
                      <span className="text-xs text-seed-dark/50">Key Notes</span>
                      <ul className="text-sm text-seed-dark/70 space-y-1">
                        {analysis.ai_insights.map((note) => (
                          <li key={note}>{note}</li>
                        ))}
                      </ul>
                    </div>
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
