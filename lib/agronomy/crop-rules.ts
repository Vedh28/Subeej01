import { DatasetRow, RecommendationInput, RowScore } from "../recommendation/types";

type MoistureBand = "low" | "medium" | "high";

interface CropRule {
  preferredSeason: string[];
  bestGrowthMonths: string;
  temperatureRange: [number, number];
  rainfallRange: [number, number];
  humidityRange?: [number, number];
  soilTypes: string[];
  moisture: MoistureBand;
  notes: string[];
}

interface AgronomicEvaluation {
  penalty: number;
  adjusted_score: number;
  status: "Suitable" | "Suitable with conditions" | "Not suitable";
  rule_reasons: string[];
  notes: string[];
}

const CROP_ALIASES: Record<string, string> = {
  soybean: "soybean",
  soyabean: "soybean",
  tomato: "tomato",
  tomatoes: "tomato",
  wheat: "wheat",
  rice: "rice",
  cotton: "cotton",
  maize: "maize",
  pulse: "pulses",
  pulses: "pulses"
};

const CROP_RULES: Record<string, CropRule> = {
  soybean: {
    preferredSeason: ["Kharif"],
    bestGrowthMonths: "June to September",
    temperatureRange: [22, 32],
    rainfallRange: [600, 1200],
    humidityRange: [55, 85],
    soilTypes: ["black soil", "loamy", "clay loam", "well-drained"],
    moisture: "medium",
    notes: ["Soybean prefers Kharif conditions with reliable rainfall and well-drained medium to deep soils."]
  },
  tomato: {
    preferredSeason: ["Rabi", "Zaid"],
    bestGrowthMonths: "October to February, or January to April with irrigation",
    temperatureRange: [18, 30],
    rainfallRange: [400, 800],
    humidityRange: [45, 75],
    soilTypes: ["loamy", "sandy loam", "well-drained", "alluvial"],
    moisture: "medium",
    notes: ["Tomato performs best in well-drained loamy soil with moderate moisture and stable warm temperatures."]
  },
  wheat: {
    preferredSeason: ["Rabi"],
    bestGrowthMonths: "November to February",
    temperatureRange: [12, 25],
    rainfallRange: [300, 700],
    humidityRange: [40, 70],
    soilTypes: ["loamy", "clay loam", "alluvial"],
    moisture: "medium",
    notes: ["Wheat performs best in cooler Rabi conditions with moderate moisture and lower rainfall."]
  },
  rice: {
    preferredSeason: ["Kharif"],
    bestGrowthMonths: "June to October",
    temperatureRange: [20, 35],
    rainfallRange: [1000, 2000],
    humidityRange: [65, 95],
    soilTypes: ["clayey", "alluvial", "loamy"],
    moisture: "high",
    notes: ["Rice prefers high moisture, warm temperatures, and sustained rainfall or assured irrigation."]
  },
  cotton: {
    preferredSeason: ["Kharif"],
    bestGrowthMonths: "June to November",
    temperatureRange: [21, 35],
    rainfallRange: [500, 900],
    humidityRange: [45, 75],
    soilTypes: ["black soil", "deep black", "well-drained"],
    moisture: "medium",
    notes: ["Cotton suits warm Kharif conditions and performs well in deep black soils with moderate rainfall."]
  },
  maize: {
    preferredSeason: ["Kharif", "Rabi"],
    bestGrowthMonths: "June to September, or October to January with irrigation",
    temperatureRange: [18, 32],
    rainfallRange: [500, 900],
    humidityRange: [45, 80],
    soilTypes: ["loamy", "sandy loam", "well-drained", "alluvial"],
    moisture: "medium",
    notes: ["Maize needs good drainage, moderate moisture, and stable temperatures during establishment."]
  },
  pulses: {
    preferredSeason: ["Rabi", "Zaid"],
    bestGrowthMonths: "October to February, depending on the pulse variety",
    temperatureRange: [18, 30],
    rainfallRange: [300, 700],
    humidityRange: [35, 70],
    soilTypes: ["loamy", "sandy loam", "alluvial", "well-drained"],
    moisture: "low",
    notes: ["Most pulses prefer lighter soils, lower humidity, and controlled moisture to avoid disease pressure."]
  }
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function inferMoistureBand(value: number): MoistureBand | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  if (value <= 35) return "low";
  if (value <= 70) return "medium";
  return "high";
}

function soilMatches(rule: CropRule, input: RecommendationInput, row: DatasetRow) {
  const candidateText = [
    input.field_composition,
    input.suitable_land_type_for_seed,
    row.soil_type,
    row.field_composition
  ]
    .filter(Boolean)
    .map(normalize)
    .join(" ");

  return rule.soilTypes.some((soil) => candidateText.includes(normalize(soil)));
}

function cropRuleFor(row: DatasetRow) {
  const cropName = normalize(row.recommended_crop || row.crop);
  if (CROP_RULES[cropName]) return CROP_RULES[cropName];
  if (cropName.includes("pulse")) return CROP_RULES.pulses;
  return null;
}

function cropRuleByName(cropName: string) {
  const normalized = normalize(cropName);
  const canonical = CROP_ALIASES[normalized] || normalized;
  if (CROP_RULES[canonical]) return { cropKey: canonical, rule: CROP_RULES[canonical] };
  if (canonical.includes("pulse")) return { cropKey: "pulses", rule: CROP_RULES.pulses };
  return null;
}

export function evaluateAgronomicFit(input: RecommendationInput, scoredRow: RowScore): AgronomicEvaluation {
  const rule = cropRuleFor(scoredRow.row);
  if (!rule) {
    return {
      penalty: 0,
      adjusted_score: scoredRow.score,
      status: "Suitable",
      rule_reasons: [],
      notes: []
    };
  }

  let penalty = 0;
  const reasons: string[] = [];

  if (input.season && !rule.preferredSeason.map(normalize).includes(normalize(input.season))) {
    penalty += 30;
    reasons.push(`${scoredRow.row.recommended_crop} prefers ${rule.preferredSeason.join("/")} season conditions.`);
  }

  if (Number.isFinite(input.temperature) && input.temperature > 0) {
    const [minTemp, maxTemp] = rule.temperatureRange;
    if (input.temperature < minTemp || input.temperature > maxTemp) {
      penalty += 20;
      reasons.push(
        `${scoredRow.row.recommended_crop} performs best around ${minTemp}-${maxTemp}C, while current temperature is ${input.temperature}C.`
      );
    }
  }

  if (Number.isFinite(input.rainfall) && input.rainfall > 0) {
    const [minRain, maxRain] = rule.rainfallRange;
    if (input.rainfall < minRain || input.rainfall > maxRain) {
      penalty += 15;
      reasons.push(
        `${scoredRow.row.recommended_crop} typically needs ${minRain}-${maxRain} mm rainfall support.`
      );
    }
  }

  if (!soilMatches(rule, input, scoredRow.row)) {
    penalty += 15;
    reasons.push(`${scoredRow.row.recommended_crop} is less compatible with the current soil profile.`);
  }

  const moistureBand = inferMoistureBand(input.moisture);
  if (moistureBand && moistureBand !== rule.moisture) {
    penalty += 10;
    reasons.push(`${scoredRow.row.recommended_crop} usually prefers ${rule.moisture} moisture conditions.`);
  }

  if (rule.humidityRange && Number.isFinite(input.humidity) && input.humidity > 0) {
    const [minHumidity, maxHumidity] = rule.humidityRange;
    if (input.humidity < minHumidity || input.humidity > maxHumidity) {
      penalty += 10;
      reasons.push(
        `${scoredRow.row.recommended_crop} is usually more stable around ${minHumidity}-${maxHumidity}% humidity.`
      );
    }
  }

  const adjustedScore = Number(Math.max(0, scoredRow.score - penalty / 100).toFixed(4));
  const status =
    penalty >= 45 ? "Not suitable" : penalty >= 20 ? "Suitable with conditions" : "Suitable";

  return {
    penalty,
    adjusted_score: adjustedScore,
    status,
    rule_reasons: reasons,
    notes: rule.notes
  };
}

export function applyAgronomicEvaluation(input: RecommendationInput, topMatches: RowScore[]) {
  return topMatches
    .map((match) => {
      const evaluation = evaluateAgronomicFit(input, match);
      const matchedFeatures =
        evaluation.status === "Suitable"
          ? Array.from(new Set([...match.matched_features, "agronomic_fit"]))
          : match.matched_features;

      return {
        ...match,
        score: evaluation.adjusted_score,
        matched_features: matchedFeatures,
        score_breakdown: {
          ...match.score_breakdown,
          agronomic_penalty: Number((evaluation.penalty / 100).toFixed(4))
        },
        agronomic_evaluation: evaluation
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function summarizeAgronomicEvaluation(topMatches: RowScore[]) {
  return topMatches
    .map((match, index) => {
      const evaluation = match.agronomic_evaluation;
      if (!evaluation) {
        return `${index + 1}) ${match.row.recommended_crop}: no explicit agronomic rule applied.`;
      }

      return `${index + 1}) ${match.row.recommended_crop}: ${evaluation.status}; penalty=${evaluation.penalty}; reasons=${evaluation.rule_reasons.join(
        " | "
      ) || "none"}`;
    })
    .join("\n");
}

export function explainAgronomicFit(cropName: string, input: RecommendationInput) {
  const found = cropRuleByName(cropName);
  if (!found) return null;

  const syntheticRow: RowScore = {
    row: {
      row_id: 0,
      seed_name: input.seed_name,
      seed_variety: input.seed_variety,
      seed_type: input.seed_type,
      seed_quality: input.seed_quality,
      crop: found.cropKey,
      season: input.season || "",
      soil_type: input.suitable_land_type_for_seed || input.field_composition || "",
      field_composition: input.field_composition || "",
      soil_ph: 0,
      temperature: input.temperature || 0,
      humidity: input.humidity || 0,
      rainfall: input.rainfall || 0,
      moisture: input.moisture || 0,
      field_quality: input.field_quality || "",
      field_history: input.field_history_or_crops || "",
      state: input.state || "",
      district: input.district || "",
      recommended_crop: cropName,
      recommended_seed: input.seed_name || "",
      area: 0,
      production: 0,
      yield: 0
    },
    score: 1,
    matched_features: [],
    score_breakdown: {}
  };

  const evaluation = evaluateAgronomicFit(input, syntheticRow);
  return {
    crop: cropName,
    preferredSeason: found.rule.preferredSeason,
    bestGrowthMonths: found.rule.bestGrowthMonths,
    temperatureRange: found.rule.temperatureRange,
    rainfallRange: found.rule.rainfallRange,
    soilTypes: found.rule.soilTypes,
    notes: found.rule.notes,
    evaluation
  };
}
