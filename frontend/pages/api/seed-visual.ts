import type { NextApiRequest, NextApiResponse } from "next";
import { loadDatasetRows } from "../../../lib/recommendation/dataset";

type SeedVisualProfile = {
  shape: "sphere" | "oval" | "flat-oval" | "elongated" | "kidney";
  scale: [number, number, number];
  baseColor: string;
  accentColor: string;
  gloss: number;
  roughness: number;
  speckle: boolean;
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function pickTop<T extends string>(counts: Map<T, number>) {
  let best = "";
  let bestCount = 0;
  for (const [key, count] of counts.entries()) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return best as T;
}

function colorFromCrop(crop: string) {
  const value = crop.toLowerCase();
  if (value.includes("cotton")) return "#f3f0e8";
  if (value.includes("rice")) return "#e9e1cf";
  if (value.includes("wheat")) return "#d9b26e";
  if (value.includes("maize") || value.includes("corn")) return "#e6c34f";
  if (value.includes("soy")) return "#a57b4b";
  if (value.includes("bajra") || value.includes("millet")) return "#c8a070";
  if (value.includes("groundnut") || value.includes("peanut")) return "#c28b5a";
  if (value.includes("cotton")) return "#efe7db";
  return "#9a764f";
}

function shapeFromSeedType(seedType: string, crop: string) {
  const type = seedType.toLowerCase();
  const c = crop.toLowerCase();
  if (c.includes("rice")) return "elongated";
  if (c.includes("wheat")) return "oval";
  if (c.includes("cotton")) return "kidney";
  if (c.includes("soy")) return "oval";
  if (type.includes("hyv")) return "flat-oval";
  if (type.includes("hybrid")) return "oval";
  return "sphere";
}

function profileFromSeed(seedName: string, matches: ReturnType<typeof buildSeedMatchSummary>): SeedVisualProfile {
  const crop = matches.topCrop || "";
  const seedType = matches.topSeedType || "";
  const seedQuality = matches.topSeedQuality || "";
  const baseColor = colorFromCrop(crop);
  const accentColor = seedQuality.toLowerCase().includes("fresh") ? "#e8d9c2" : "#8b6a45";
  const shape = shapeFromSeedType(seedType, crop);

  let scale: [number, number, number] = [1.1, 0.75, 0.75];
  if (shape === "elongated") scale = [1.5, 0.5, 0.5];
  if (shape === "flat-oval") scale = [1.3, 0.55, 0.8];
  if (shape === "kidney") scale = [1.35, 0.65, 0.85];
  if (shape === "sphere") scale = [1.0, 1.0, 1.0];

  const gloss = seedQuality.toLowerCase().includes("fresh") ? 0.35 : 0.15;
  const roughness = seedQuality.toLowerCase().includes("fresh") ? 0.45 : 0.7;
  const speckle = seedName.toLowerCase().includes("bt") || seedType.toLowerCase().includes("hyv");

  return { shape, scale, baseColor, accentColor, gloss, roughness, speckle };
}

function buildSeedMatchSummary(rows: Awaited<ReturnType<typeof loadDatasetRows>>, seedName: string) {
  const normalized = normalize(seedName);
  const matches = rows.filter((row) => {
    const seed = normalize(row.seed_name || "");
    const recommended = normalize(row.recommended_seed || "");
    return seed.includes(normalized) || recommended.includes(normalized);
  });

  const scope = matches.length ? matches : rows.filter((row) => normalize(row.seed_name || "").includes(normalized));

  const crops = new Map<string, number>();
  const types = new Map<string, number>();
  const qualities = new Map<string, number>();

  for (const row of scope) {
    const crop = String(row.recommended_crop || row.crop || "").trim();
    const type = String(row.seed_type || "").trim();
    const quality = String(row.seed_quality || "").trim();
    if (crop) crops.set(crop, (crops.get(crop) || 0) + 1);
    if (type) types.set(type, (types.get(type) || 0) + 1);
    if (quality) qualities.set(quality, (qualities.get(quality) || 0) + 1);
  }

  return {
    matchCount: scope.length,
    topCrop: pickTop(crops),
    topSeedType: pickTop(types),
    topSeedQuality: pickTop(qualities)
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const seedName = String(req.query.seed_name || "").trim();
  if (!seedName) {
    return res.status(400).json({ error: "seed_name is required" });
  }

  try {
    const rows = await loadDatasetRows();
    const summary = buildSeedMatchSummary(rows, seedName);
    const profile = profileFromSeed(seedName, summary);
    return res.status(200).json({
      seedName,
      summary,
      profile
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: "Failed to build seed visual", details: message });
  }
}
