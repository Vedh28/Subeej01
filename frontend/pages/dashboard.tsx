import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import ImageUploader from "../components/ImageUploader";
import SeedInput from "../components/SeedInput";
import AnalysisCard from "../components/AnalysisCard";
import DecisionCard from "../components/DecisionCard";
import ChartSection from "../components/ChartSection";
import AIInsightPanel from "../components/AIInsightPanel";
import {
  defaultDashboardAnalysis,
  DashboardAnalysisState,
  readDashboardAnalysisState,
  writeDashboardAnalysisState
} from "../../lib/dashboard-analysis-state";
import {
  DISTRICTS_BY_STATE,
  resolveDistrictOption,
  resolveStateOption,
  SUPPORTED_STATE_OPTIONS
} from "../../lib/india-location-options";
import { getApiUrl } from "../../lib/api-base";

const FieldMap = dynamic(() => import("../components/FieldMap"), { ssr: false });
const Seed3DViewer = dynamic(() => import("../components/Seed3DViewer"), { ssr: false });

export default function Dashboard() {
  const requestIdRef = useRef(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [seedName, setSeedName] = useState(defaultDashboardAnalysis.seed_name);
  const [stateName, setStateName] = useState(defaultDashboardAnalysis.state);
  const [districtName, setDistrictName] = useState(defaultDashboardAnalysis.district);
  const [analysis, setAnalysis] = useState<DashboardAnalysisState>(defaultDashboardAnalysis);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const normalizedStateName = resolveStateOption(stateName) || stateName.trim();
  const districtOptions = normalizedStateName ? DISTRICTS_BY_STATE[normalizedStateName] || [] : [];
  const hasSelectedState = normalizedStateName.length > 0;
  const isDistrictValid = districtOptions.includes(districtName);
  const hasImage = Boolean(imageUrl);
  const hasSeed = Boolean(seedName.trim());
  const canRunAnalysis = Boolean((hasImage || hasSeed) && hasSelectedState && districtOptions.length > 0 && isDistrictValid);
  const activeAnalysisMode: "field" | "seed" | "combined" =
    hasImage && hasSeed ? "combined" : hasImage ? "field" : "seed";

  useEffect(() => {
    const persisted = readDashboardAnalysisState();
    setImageUrl(persisted.image_url || "");
    setSeedName(persisted.seed_name || defaultDashboardAnalysis.seed_name);
    setStateName(persisted.state || "");
    setDistrictName(persisted.district || "");
    setAnalysis(persisted);
  }, []);

  useEffect(() => {
    if (!normalizedStateName) {
      if (districtName) {
        setDistrictName("");
      }
      return;
    }

    if (districtName && !districtOptions.includes(districtName)) {
      setDistrictName("");
    }
  }, [normalizedStateName, districtName, districtOptions]);

  useEffect(() => {
    writeDashboardAnalysisState({
      ...analysis,
      image_url: imageUrl,
      seed_name: seedName,
      state: stateName,
      district: districtName
    });
  }, [analysis, imageUrl, seedName, stateName, districtName]);

  const handleAnalyze = async () => {
    if (isAnalyzing) {
      return;
    }

    if (!canRunAnalysis) {
      setAnalysisError("Location is required, and at least one of field image or seed name must be provided.");
      return;
    }

    const mode = activeAnalysisMode;

    const nextRequestId = requestIdRef.current + 1;
    requestIdRef.current = nextRequestId;
    setIsAnalyzing(true);
    setAnalysisError("");

    try {
      const response = await fetch(getApiUrl("/api/field-analysis"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_data_url: imageUrl,
          seed_name: seedName,
          state: stateName,
          district: districtName,
          mode
        })
      });

      const data = (await response.json()) as DashboardAnalysisState & { error?: string; details?: string };
      if (requestIdRef.current !== nextRequestId) {
        return;
      }
      if (!response.ok) {
        throw new Error(data.details || data.error || "Analysis failed.");
      }

      setAnalysis({
        ...data,
        image_url: imageUrl,
        seed_name: seedName,
        state: stateName,
        district: districtName,
        last_mode: mode
      });
    } catch (error) {
      if (requestIdRef.current !== nextRequestId) {
        return;
      }
      setAnalysisError(error instanceof Error ? error.message : "Analysis failed.");
      setAnalysis({
        ...defaultDashboardAnalysis,
        seed_data: {
          ...defaultDashboardAnalysis.seed_data,
          seed: seedName || defaultDashboardAnalysis.seed_data.seed,
          compatibility: "Review needed"
        },
        ai_decision: {
          decision: "REVIEW",
          confidence: "0.55",
          explanation: "I could not complete the field-image review. Check the image quality and vision-model configuration, then try again."
        },
        ai_insights: [
          "Upload a clearer field image with visible soil and crop cover.",
          "Use a configured vision-capable model for image review.",
          "Keep the seed name selected so the seed intelligence panel stays relevant."
        ],
        image_url: imageUrl,
        seed_name: seedName,
        state: stateName,
        district: districtName,
        last_mode: mode
      });
    } finally {
      if (requestIdRef.current === nextRequestId) {
        setIsAnalyzing(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-seed-beige">
      <div className="flex min-h-screen">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <div className="flex-1 flex flex-col min-w-0">
          <Navbar onMenuClick={() => setIsSidebarOpen(true)} />
          <main className="flex-1 p-6 bg-grid bg-[length:90px_90px] min-w-0">
            <div className="grid gap-6 animate-fadeUp">
              <AnalysisCard
                title="Input Panel"
                subtitle="Upload a field image, choose location, and enter the seed name."
                className="neo-card"
              >
                <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
                  <ImageUploader
                    imageUrl={imageUrl}
                    onChange={(value) => {
                      setImageUrl(value);
                      setAnalysisError("");
                      setAnalysis((prev) => ({
                        ...defaultDashboardAnalysis,
                        seed_data: {
                          ...defaultDashboardAnalysis.seed_data,
                          seed: seedName || defaultDashboardAnalysis.seed_data.seed
                        },
                        image_url: value,
                        seed_name: seedName,
                        ai_insights:
                          prev.image_url && prev.image_url !== value
                            ? [
                                "A new image has been selected.",
                                "Run field analysis to refresh field and seed intelligence.",
                                "Previous analysis was cleared to avoid stale results."
                              ]
                            : defaultDashboardAnalysis.ai_insights
                      }));
                    }}
                  />
                  <div className="flex flex-col gap-4 rounded-[28px] border border-seed-green/15 bg-white/70 p-5">
                    <SeedInput
                      value={seedName}
                      onChange={(value) => {
                        setSeedName(value);
                        setAnalysisError("");
                      }}
                    />
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="flex flex-col gap-3">
                        <label className="text-sm font-medium text-seed-dark">
                          State <span className="text-seed-green">*</span>
                        </label>
                        <input
                          list="dashboard-state-options"
                          value={stateName}
                          onChange={(event) => {
                            setStateName(event.target.value);
                            setDistrictName("");
                            setAnalysisError("");
                          }}
                          onBlur={() => {
                            const matchedState = resolveStateOption(stateName);
                            if (matchedState && matchedState !== stateName) {
                              setStateName(matchedState);
                            }
                          }}
                          placeholder="Search or select state"
                          className="w-full rounded-2xl border border-seed-green/20 bg-white/80 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-seed-green/30"
                        />
                        <datalist id="dashboard-state-options">
                          {SUPPORTED_STATE_OPTIONS.map((stateOption) => (
                            <option key={stateOption} value={stateOption} />
                          ))}
                        </datalist>
                      </div>
                      <div className="flex flex-col gap-3">
                        <label className="text-sm font-medium text-seed-dark">
                          District <span className="text-seed-green">*</span>
                        </label>
                        <input
                          list="dashboard-district-options"
                          key={`district-${normalizedStateName || "none"}`}
                          value={districtName}
                          onChange={(event) => {
                            setDistrictName(event.target.value);
                            setAnalysisError("");
                          }}
                          onBlur={() => {
                            const matchedDistrict = resolveDistrictOption(normalizedStateName, districtName);
                            if (matchedDistrict && matchedDistrict !== districtName) {
                              setDistrictName(matchedDistrict);
                            }
                          }}
                          placeholder={hasSelectedState ? "Search or select district" : "Select state first"}
                          className="w-full rounded-2xl border border-seed-green/20 bg-white/80 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-seed-green/30"
                        />
                        <datalist id="dashboard-district-options">
                          {districtOptions.map((districtOption) => (
                            <option key={districtOption} value={districtOption} />
                          ))}
                        </datalist>
                        {hasSelectedState && districtOptions.length === 0 ? (
                          <div className="text-xs text-red-600">No district options found for the selected state.</div>
                        ) : hasSelectedState ? (
                          <div className="text-xs text-seed-dark/60">
                            Linked to state: {normalizedStateName}. Available districts: {districtOptions.length}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <button
                      onClick={handleAnalyze}
                      className={`w-full btn-primary ${isAnalyzing || !canRunAnalysis ? "opacity-60 cursor-not-allowed" : ""}`}
                      disabled={isAnalyzing || !canRunAnalysis}
                    >
                      {isAnalyzing
                        ? "Analyzing..."
                        : activeAnalysisMode === "combined"
                          ? "Run Combined Analysis"
                          : activeAnalysisMode === "field"
                            ? "Run Field Analysis"
                            : "Run Seed Analysis"}
                    </button>
                    <div className="text-xs text-seed-dark/60">
                      Current mode:{" "}
                      {activeAnalysisMode === "combined"
                        ? "Field + Seed"
                        : activeAnalysisMode === "field"
                          ? "Field Only"
                          : "Seed Only"}
                    </div>
                    {isAnalyzing ? (
                      <div className="text-xs text-seed-dark/60">
                        Running field analysis. Please wait for the current request to finish.
                      </div>
                    ) : null}
                    {analysisError ? (
                      <div className="text-xs text-red-600">{analysisError}</div>
                    ) : null}
                  </div>
                </div>
              </AnalysisCard>

              <AnalysisCard title="Field Intelligence" subtitle="Soil & vegetation analysis" className="neo-card">
                <div className="flex flex-col gap-4">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt="Field"
                      className="h-40 w-full object-cover rounded-2xl"
                    />
                  ) : (
                    <div className="h-40 rounded-2xl bg-seed-green/10 flex items-center justify-center text-xs text-seed-dark/60">
                      Field preview appears here
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3 text-sm">
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
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-seed-dark/50">Detected Crop</span>
                      <span className="font-semibold">{analysis.field_details.detected_crop}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-seed-dark/50">Growth Stage</span>
                      <span className="font-semibold">{analysis.field_details.growth_stage}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-seed-dark/50">Ground Cover</span>
                      <span className="font-semibold">
                        {analysis.field_details.ground_cover_percent === null
                          ? "Not available"
                          : `${analysis.field_details.ground_cover_percent}%`}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-seed-dark/50">Image Confidence</span>
                      <span className="font-semibold">{analysis.analysis_meta.image_confidence}</span>
                    </div>
                  </div>
                  {!analysis.analysis_meta.vision_enabled ? (
                    <div className="rounded-2xl border border-amber-300/40 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                      Real image intelligence needs a configured vision-capable AI model. The dashboard is staying conservative instead of inventing field details.
                    </div>
                  ) : null}
                </div>
              </AnalysisCard>

              <div className="grid gap-6 lg:grid-cols-2">
                <AnalysisCard title="Field Map" subtitle="Interactive farm boundary & layers" className="neo-card">
                  <FieldMap />
                </AnalysisCard>

                <AnalysisCard
                  title="Seed Intelligence"
                  subtitle="Compatibility & yield expectations"
                  className="neo-card"
                >
                  <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
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
                    <Seed3DViewer seedName={seedName} />
                  </div>
                </AnalysisCard>
              </div>

              <DecisionCard
                decision={analysis.ai_decision.decision}
                confidence={analysis.ai_decision.confidence}
                explanation={analysis.ai_decision.explanation}
                className="neo-card-strong"
              />

              <AIInsightPanel messages={analysis.ai_insights} className="neo-card" />

              <ChartSection
                yieldPrediction={analysis.yield_prediction}
                nutrientData={analysis.nutrient_data}
              />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
