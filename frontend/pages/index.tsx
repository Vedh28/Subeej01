import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";

const features = [
  {
    title: "Seed Intelligence",
    description: "Match seed genetics to soil and weather signals in seconds."
  },
  {
    title: "Field Intelligence",
    description: "Analyze moisture, vegetation, and soil health from a single image."
  },
  {
    title: "AI Decision Engine",
    description: "Actionable sowing recommendations with confidence scoring."
  }
];

export default function Home() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  return (
    <div className="min-h-screen md:h-screen bg-grid bg-[length:80px_80px] relative overflow-auto md:overflow-hidden">
      <div className="absolute inset-0 bg-radial opacity-60" />
      <main className="relative z-10 px-6 max-w-6xl mx-auto min-h-screen flex items-center md:items-center py-12 md:py-0">
        <div className="w-full">
          <header className="flex flex-col gap-6 text-center items-center animate-fadeUp">
          <span className="text-xs uppercase tracking-[0.3em] text-seed-green/70">AI Agriculture Platform</span>
          <h1 className="text-4xl md:text-6xl font-semibold text-seed-dark">Subeej Intelligence</h1>
          <p className="text-base md:text-lg text-seed-dark/70 max-w-2xl">
            AI-powered Seed and Field Analysis
          </p>
          <Link
            href="/dashboard"
            onClick={(event) => {
              event.preventDefault();
              if (isLoading) return;
              setIsLoading(true);
              setTimeout(() => {
                router.push("/dashboard");
              }, 700);
            }}
            className="btn-primary rounded-full"
          >
            Analyze Field
          </Link>
        </header>

        <section className="mt-16 grid gap-6 md:grid-cols-3 animate-fadeUp" style={{ animationDelay: "120ms" }}>
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="glass-card rounded-3xl p-6 card-animate animate-fadeUp"
              style={{ animationDelay: `${index * 120}ms` }}
            >
              <h3 className="text-lg font-semibold text-seed-dark">{feature.title}</h3>
              <p className="mt-3 text-sm text-seed-dark/70">{feature.description}</p>
            </div>
          ))}
        </section>

        <section
          className="mt-20 grid gap-6 md:grid-cols-[1.2fr_0.8fr] animate-fadeUp"
          style={{ animationDelay: "240ms" }}
        >
          <div className="glass-card rounded-3xl p-8 flex flex-col gap-4">
            <h2 className="text-2xl font-semibold text-seed-dark">Modern agriculture, simplified</h2>
            <p className="text-sm text-seed-dark/70">
              Upload your field image, choose a seed, and let the AI engine map soil, moisture, and weather
              signals into clear sowing guidance.
            </p>
            <div className="flex flex-wrap gap-3 text-xs text-seed-dark/70">
              <span className="px-3 py-1 rounded-full bg-seed-green/10">Satellite + drone ready</span>
              <span className="px-3 py-1 rounded-full bg-seed-brown/10">Localized recommendations</span>
              <span className="px-3 py-1 rounded-full bg-seed-green/10">Instant AI insights</span>
            </div>
          </div>
          <div className="glass-card rounded-3xl p-8 flex flex-col gap-6">
            <h3 className="text-lg font-semibold">Live Insights Preview</h3>
            <div className="flex flex-col gap-4 text-sm text-seed-dark/70">
              <div className="ai-bubble rounded-2xl px-4 py-3">
                Moisture levels are stable with a 72% vegetation index.
              </div>
              <div className="ai-bubble rounded-2xl px-4 py-3">
                Recommended seed window opens in 4 days.
              </div>
            </div>
          </div>
        </section>
        </div>
      </main>
      {isLoading ? (
        <div className="fixed bottom-6 right-6 z-20 flex items-center justify-center rounded-2xl bg-black/90 px-4 py-3 shadow-card border border-white/10">
          <div className="loader-triangle" aria-label="Loading">
            <span />
            <span />
            <span />
          </div>
        </div>
      ) : null}
    </div>
  );
}
