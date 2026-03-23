import type { NextApiRequest, NextApiResponse } from "next";
import { loadDatasetRows } from "../../../lib/recommendation/dataset";

function normalizeKey(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function pickTop(counts: Map<string, number>) {
  let best = "";
  let bestCount = 0;
  for (const [key, count] of counts.entries()) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return best;
}

function pickTopN(counts: Map<string, number>, n = 3) {
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([value]) => value);
}

const PALETTE = [
  "#2f7d4c",
  "#7a5c3e",
  "#2f6f73",
  "#9c6b3f",
  "#4062bb",
  "#8f3b76",
  "#4d9078",
  "#c56b3c",
  "#6b6b83",
  "#1f7a8c",
  "#7a6bbd",
  "#b26b3b"
];

function buildColorMap(values: string[]) {
  const map: Record<string, string> = {};
  const unique = Array.from(new Set(values.filter(Boolean)));
  unique.forEach((value, idx) => {
    map[value] = PALETTE[idx % PALETTE.length];
  });
  return map;
}

function buildLayerMappings(
  rows: Awaited<ReturnType<typeof loadDatasetRows>>,
  key: "soil_type" | "seed_type" | "field_quality" | "field_history" | "field_composition"
) {
  const districtCounts = new Map<string, Map<string, number>>();
  const stateCounts = new Map<string, Map<string, number>>();
  const overallCounts = new Map<string, number>();
  const values: string[] = [];

  for (const row of rows) {
    const stateKey = normalizeKey(row.state || "");
    const districtKey = normalizeKey(row.district || "");
    const value = String(row[key] || "Unknown").trim();
    if (!value) continue;
    values.push(value);
    overallCounts.set(value, (overallCounts.get(value) || 0) + 1);

    if (stateKey) {
      if (!stateCounts.has(stateKey)) stateCounts.set(stateKey, new Map());
      const sMap = stateCounts.get(stateKey)!;
      sMap.set(value, (sMap.get(value) || 0) + 1);
    }
    if (stateKey && districtKey) {
      const dKey = `${districtKey}||${stateKey}`;
      if (!districtCounts.has(dKey)) districtCounts.set(dKey, new Map());
      const dMap = districtCounts.get(dKey)!;
      dMap.set(value, (dMap.get(value) || 0) + 1);
    }
  }

  const districtMap: Record<string, string> = {};
  for (const [keyName, counts] of districtCounts.entries()) {
    districtMap[keyName] = pickTop(counts);
  }

  const stateMap: Record<string, string> = {};
  for (const [keyName, counts] of stateCounts.entries()) {
    stateMap[keyName] = pickTop(counts);
  }

  const colorMap = buildColorMap(values);
  const legend = Object.entries(colorMap).map(([value, color]) => ({ value, color }));
  const overall = pickTop(overallCounts);

  return { districtMap, stateMap, colorMap, legend, overall };
}

function buildNumericLayerMappings(
  rows: Awaited<ReturnType<typeof loadDatasetRows>>,
  key: "moisture" | "soil_ph" | "temperature" | "humidity" | "rainfall"
) {
  const districtTotals = new Map<string, { sum: number; count: number }>();
  const stateTotals = new Map<string, { sum: number; count: number }>();
  let overallSum = 0;
  let overallCount = 0;

  for (const row of rows) {
    const stateKey = normalizeKey(row.state || "");
    const districtKey = normalizeKey(row.district || "");
    const raw = row[key];
    const value = typeof raw === "number" ? raw : Number.parseFloat(String(raw ?? ""));
    if (!Number.isFinite(value)) continue;

    overallSum += value;
    overallCount += 1;

    if (stateKey) {
      if (!stateTotals.has(stateKey)) stateTotals.set(stateKey, { sum: 0, count: 0 });
      const bucket = stateTotals.get(stateKey)!;
      bucket.sum += value;
      bucket.count += 1;
    }

    if (stateKey && districtKey) {
      const dKey = `${districtKey}||${stateKey}`;
      if (!districtTotals.has(dKey)) districtTotals.set(dKey, { sum: 0, count: 0 });
      const bucket = districtTotals.get(dKey)!;
      bucket.sum += value;
      bucket.count += 1;
    }
  }

  const districtMap: Record<string, number> = {};
  for (const [keyName, bucket] of districtTotals.entries()) {
    districtMap[keyName] = bucket.count ? bucket.sum / bucket.count : 0;
  }

  const stateMap: Record<string, number> = {};
  for (const [keyName, bucket] of stateTotals.entries()) {
    stateMap[keyName] = bucket.count ? bucket.sum / bucket.count : 0;
  }

  const overall = overallCount ? overallSum / overallCount : 0;

  return { districtMap, stateMap, overall };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const rows = await loadDatasetRows();

    const districtInsights: Record<string, { topCrops: string[]; topSeeds: string[] }> = {};
    const statesWithData = new Set<string>();
    const districtCropCounts = new Map<string, Map<string, number>>();
    const districtSeedCounts = new Map<string, Map<string, number>>();

    for (const row of rows) {
      const stateKey = normalizeKey(row.state || "");
      const districtKey = normalizeKey(row.district || "");
      if (!stateKey || !districtKey) continue;
      const key = `${districtKey}||${stateKey}`;
      statesWithData.add(stateKey);

      if (!districtCropCounts.has(key)) districtCropCounts.set(key, new Map());
      if (!districtSeedCounts.has(key)) districtSeedCounts.set(key, new Map());

      const crop = String(row.recommended_crop || row.crop || "Unknown").trim();
      const seed = String(row.recommended_seed || row.seed_name || "Unknown").trim();

      const cropMap = districtCropCounts.get(key)!;
      cropMap.set(crop, (cropMap.get(crop) || 0) + 1);

      const seedMap = districtSeedCounts.get(key)!;
      seedMap.set(seed, (seedMap.get(seed) || 0) + 1);
    }

    for (const [key, counts] of districtCropCounts.entries()) {
      const seeds = districtSeedCounts.get(key) || new Map();
      districtInsights[key] = {
        topCrops: pickTopN(counts, 3),
        topSeeds: pickTopN(seeds, 3)
      };
    }

    const soilLayer = buildLayerMappings(rows, "soil_type");
    const seedLayer = buildLayerMappings(rows, "seed_type");
    const qualityLayer = buildLayerMappings(rows, "field_quality");
    const historyLayer = buildLayerMappings(rows, "field_history");
    const compositionLayer = buildLayerMappings(rows, "field_composition");
    const moistureLayer = buildNumericLayerMappings(rows, "moisture");
    const soilPhLayer = buildNumericLayerMappings(rows, "soil_ph");
    const temperatureLayer = buildNumericLayerMappings(rows, "temperature");
    const humidityLayer = buildNumericLayerMappings(rows, "humidity");
    const rainfallLayer = buildNumericLayerMappings(rows, "rainfall");

    return res.status(200).json({
      layers: {
        soil: soilLayer,
        seedType: seedLayer,
        fieldQuality: qualityLayer,
        fieldHistory: historyLayer,
        fieldComposition: compositionLayer,
        moisture: moistureLayer,
        soilPh: soilPhLayer,
        temperature: temperatureLayer,
        humidity: humidityLayer,
        rainfall: rainfallLayer
      },
      districtInsights,
      statesWithData: Array.from(statesWithData)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: "Failed to build field map", details: message });
  }
}
