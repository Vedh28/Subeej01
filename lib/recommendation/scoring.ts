import { DatasetRow, RecommendationInput, RowScore } from "./types";

const WEIGHTS = {
  soil_and_composition: 0.25,
  season: 0.15,
  location: 0.15,
  weather: 0.2,
  field_history: 0.1,
  seed_suitability: 0.1,
  field_quality: 0.05
} as const;

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function tokenize(value: string) {
  return normalize(value)
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length > 2);
}

function tokenOverlap(a: string, b: string) {
  const aSet = new Set(tokenize(a));
  const bSet = new Set(tokenize(b));
  if (!aSet.size || !bSet.size) return 0;
  let overlap = 0;
  for (const token of aSet) {
    if (bSet.has(token)) overlap += 1;
  }
  return overlap / Math.max(aSet.size, bSet.size);
}

function exactOrPartial(a: string, b: string) {
  const x = normalize(a);
  const y = normalize(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return 0.7;
  return tokenOverlap(x, y);
}

function closeness(userValue: number, rowValue: number, range: number) {
  if (!Number.isFinite(userValue) || !Number.isFinite(rowValue) || range <= 0) return 0;
  const diff = Math.abs(userValue - rowValue);
  const score = 1 - diff / range;
  return Math.max(0, Math.min(1, score));
}

function inferSeason(input: RecommendationInput) {
  if (input.season?.trim()) return normalize(input.season);
  if (input.rainfall >= 600 && input.temperature >= 24) return "kharif";
  if (input.temperature <= 24 && input.rainfall <= 700) return "rabi";
  return "zaid";
}

function scoreWeather(input: RecommendationInput, row: DatasetRow) {
  const moistureScore = closeness(input.moisture, row.moisture, 100);
  const humidityScore = closeness(input.humidity, row.humidity, 100);
  const rainfallScore = closeness(input.rainfall, row.rainfall, 1500);
  const temperatureScore = closeness(input.temperature, row.temperature, 30);
  return (moistureScore + humidityScore + rainfallScore + temperatureScore) / 4;
}

function scoreLocation(input: RecommendationInput, row: DatasetRow) {
  const state = exactOrPartial(input.state, row.state);
  const district = exactOrPartial(input.district, row.district);
  return state * 0.65 + district * 0.35;
}

function scoreSoil(input: RecommendationInput, row: DatasetRow) {
  const composition = tokenOverlap(input.field_composition, row.field_composition);
  const suitableLand = tokenOverlap(input.suitable_land_type_for_seed, row.soil_type);
  const soilFromComposition = tokenOverlap(input.field_composition, row.soil_type);
  return composition * 0.5 + suitableLand * 0.3 + soilFromComposition * 0.2;
}

function scoreSeedSuitability(input: RecommendationInput, row: DatasetRow) {
  const seedName = exactOrPartial(input.seed_name, row.seed_name);
  const seedVariety = exactOrPartial(input.seed_variety, row.seed_variety);
  const seedType = exactOrPartial(input.seed_type, row.seed_type);
  const seedQuality = exactOrPartial(input.seed_quality, row.seed_quality);
  return seedName * 0.25 + seedVariety * 0.35 + seedType * 0.2 + seedQuality * 0.2;
}

function scoreFieldHistory(input: RecommendationInput, row: DatasetRow) {
  const history = exactOrPartial(input.field_history_or_crops, row.field_history);
  const cropHint = exactOrPartial(input.suitable_crop_for_field, row.recommended_crop || row.crop);
  return history * 0.7 + cropHint * 0.3;
}

function scoreFieldQuality(input: RecommendationInput, row: DatasetRow) {
  return exactOrPartial(input.field_quality, row.field_quality);
}

function scoreSeason(input: RecommendationInput, row: DatasetRow) {
  return exactOrPartial(inferSeason(input), row.season);
}

function scoreOne(input: RecommendationInput, row: DatasetRow): RowScore {
  const breakdown = {
    soil_and_composition: scoreSoil(input, row),
    season: scoreSeason(input, row),
    location: scoreLocation(input, row),
    weather: scoreWeather(input, row),
    field_history: scoreFieldHistory(input, row),
    seed_suitability: scoreSeedSuitability(input, row),
    field_quality: scoreFieldQuality(input, row)
  };

  const score =
    breakdown.soil_and_composition * WEIGHTS.soil_and_composition +
    breakdown.season * WEIGHTS.season +
    breakdown.location * WEIGHTS.location +
    breakdown.weather * WEIGHTS.weather +
    breakdown.field_history * WEIGHTS.field_history +
    breakdown.seed_suitability * WEIGHTS.seed_suitability +
    breakdown.field_quality * WEIGHTS.field_quality;

  const matched = Object.entries(breakdown)
    .filter(([, value]) => value >= 0.55)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  return {
    row,
    score: Number(score.toFixed(4)),
    matched_features: matched,
    score_breakdown: Object.fromEntries(
      Object.entries(breakdown).map(([k, v]) => [k, Number(v.toFixed(4))])
    )
  };
}

export function rankCandidates(input: RecommendationInput, rows: DatasetRow[]) {
  const prefiltered = rows.filter((row) => {
    const location = scoreLocation(input, row);
    const soil = scoreSoil(input, row);
    const seed = scoreSeedSuitability(input, row);
    const cropHint = exactOrPartial(input.suitable_crop_for_field, row.recommended_crop || row.crop);
    return Math.max(location, soil, seed, cropHint) >= 0.25;
  });

  const pool = prefiltered.length >= 50 ? prefiltered : rows;
  const scored = pool.map((row) => scoreOne(input, row)).sort((a, b) => b.score - a.score);
  return scored.slice(0, 3);
}

export function calculateConfidence(input: RecommendationInput, topMatches: RowScore[]) {
  if (!topMatches.length) return 0.0;
  const best = topMatches[0].score;
  const second = topMatches[1]?.score ?? 0;
  const margin = Math.max(0, best - second);

  const requiredFields = [
    "seed_name",
    "seed_variety",
    "seed_type",
    "seed_quality",
    "suitable_land_type_for_seed",
    "field_quality",
    "field_history_or_crops",
    "field_composition",
    "state",
    "district",
    "suitable_crop_for_field"
  ] as const;

  const filled = requiredFields.filter((key) => String(input[key] ?? "").trim().length > 0).length;
  const completeness = filled / requiredFields.length;
  const confidence = best * 0.8 + margin * 0.15 + completeness * 0.05;
  return Number(Math.max(0, Math.min(1, confidence)).toFixed(2));
}

export function describeRanking(topMatches: RowScore[]) {
  if (!topMatches.length) return "No matching rows found.";
  return topMatches
    .map(
      (entry, idx) =>
        `${idx + 1}) row ${entry.row.row_id}: ${entry.row.recommended_crop} | ${entry.row.recommended_seed} | score=${entry.score}`
    )
    .join("\n");
}
