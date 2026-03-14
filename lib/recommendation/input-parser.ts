import { RecommendationInput } from "./types";

type PartialInput = Partial<RecommendationInput>;
export type PendingQuestionField =
  | "state"
  | "district"
  | "field_composition"
  | "suitable_land_type_for_seed"
  | "season"
  | "moisture"
  | "humidity"
  | "rainfall"
  | "temperature"
  | "field_history_or_crops"
  | "field_quality";
export type ChatIntent =
  | "greeting"
  | "help"
  | "collecting_fields"
  | "ready_for_action"
  | "agronomy_advice"
  | "compatibility_check"
  | "recommendation_request"
  | "informational_question"
  | "follow_up_explanation"
  | "correction_or_complaint"
  | "format_request"
  | "unknown";

const KNOWN_STATES = [
  "andhra pradesh",
  "arunachal pradesh",
  "assam",
  "bihar",
  "chhattisgarh",
  "goa",
  "gujarat",
  "haryana",
  "himachal pradesh",
  "jharkhand",
  "karnataka",
  "kerala",
  "madhya pradesh",
  "maharashtra",
  "manipur",
  "meghalaya",
  "mizoram",
  "nagaland",
  "odisha",
  "punjab",
  "rajasthan",
  "sikkim",
  "tamil nadu",
  "telangana",
  "tripura",
  "uttar pradesh",
  "uttarakhand",
  "west bengal"
];

const STATE_ALIASES: Record<string, string> = {
  maharashta: "maharashtra",
  maharastra: "maharashtra",
  maharshtra: "maharashtra",
  gujrat: "gujarat",
  karnatka: "karnataka",
  telengana: "telangana",
  "utter pradesh": "uttar pradesh"
};

const DISTRICT_ALIASES: Record<string, string> = {
  kokan: "konkan",
  konkan: "konkan",
  ahemdabad: "ahmedabad",
  ahmedbad: "ahmedabad",
  nasik: "nashik"
};

const KNOWN_DISTRICTS = [
  "ahmedabad",
  "aurangabad",
  "konkan",
  "kolhapur",
  "nagpur",
  "nashik",
  "palghar",
  "patna",
  "pune",
  "satara",
  "solapur"
];

const CROP_ALIASES: Record<string, string> = {
  soybean: "Soybean",
  soyabean: "Soybean",
  tomato: "Tomato",
  tomatoes: "Tomato",
  wheat: "Wheat",
  rice: "Rice",
  cotton: "Cotton",
  maize: "Maize",
  pumpkin: "Pumpkin",
  pulse: "Pulses",
  pulses: "Pulses"
};

const KEY_MAP: Array<{ keys: string[]; field: keyof RecommendationInput }> = [
  { keys: ["seed_name", "seed name"], field: "seed_name" },
  { keys: ["seed_variety", "seed variety", "variety"], field: "seed_variety" },
  { keys: ["seed_type", "seed type"], field: "seed_type" },
  { keys: ["seed_quality", "seed quality"], field: "seed_quality" },
  {
    keys: ["suitable_land_type_for_seed", "suitable land type", "land type", "soil type"],
    field: "suitable_land_type_for_seed"
  },
  { keys: ["field_quality", "field quality", "land quality"], field: "field_quality" },
  {
    keys: ["field_history_or_crops", "field history", "history", "previous crop", "previous crops"],
    field: "field_history_or_crops"
  },
  { keys: ["field_composition", "field composition", "land composition"], field: "field_composition" },
  { keys: ["moisture"], field: "moisture" },
  { keys: ["humidity"], field: "humidity" },
  { keys: ["rainfall"], field: "rainfall" },
  { keys: ["temperature", "temp"], field: "temperature" },
  { keys: ["state"], field: "state" },
  { keys: ["district"], field: "district" },
  { keys: ["suitable_crop_for_field", "suitable crop", "crop"], field: "suitable_crop_for_field" },
  { keys: ["season"], field: "season" }
];

const NUMERIC_FIELDS = new Set<keyof RecommendationInput>([
  "moisture",
  "humidity",
  "rainfall",
  "temperature"
]);

function norm(text: string) {
  return text.toLowerCase().trim();
}

function extractNumber(value: string) {
  const match = value.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractRelativeScale(value: string, field: keyof RecommendationInput) {
  const text = norm(value);
  const mapByField: Record<string, Record<string, number>> = {
    moisture: { dry: 25, low: 25, medium: 55, moist: 55, wet: 80, high: 75 },
    humidity: { low: 35, medium: 60, high: 80 },
    rainfall: { low: 300, medium: 700, high: 1100 },
    temperature: { low: 18, medium: 28, high: 36 }
  };
  const mapping = mapByField[field] || {};
  for (const [key, mapped] of Object.entries(mapping)) {
    if (text.includes(key)) return mapped;
  }
  return null;
}

function assignField(result: PartialInput, field: keyof RecommendationInput, rawValue: string) {
  if (!rawValue.trim()) return;
  if (NUMERIC_FIELDS.has(field)) {
    const n = extractNumber(rawValue);
    if (n !== null) {
      result[field] = n as never;
      return;
    }
    const r = extractRelativeScale(rawValue, field);
    if (r !== null) result[field] = r as never;
    return;
  }
  result[field] = rawValue.trim() as never;
}

function titleCaseValue(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function cleanEntityValue(value: string) {
  return value
    .replace(/\b(in my field|for my field|my field|in field|for field)\b/gi, "")
    .replace(/\b(seed|seeds|crop|crops)\b/gi, "")
    .replace(/\b(to sow|to plant|to grow|for sowing|for planting)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractGenericCropOrSeed(text: string) {
  const patterns = [
    /\bbest\s+([a-z][a-z ]{1,40}?)\s+seeds?\b/i,
    /\b([a-z][a-z ]{1,40}?)\s+seeds?\b/i,
    /\bplant\s+([a-z][a-z ]{1,40}?)(?:\b|$)/i,
    /\bsow\s+([a-z][a-z ]{1,40}?)(?:\b|$)/i,
    /\bgrow\s+([a-z][a-z ]{1,40}?)(?:\b|$)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const cleaned = cleanEntityValue(match[1] || "");
    if (cleaned && cleaned.split(/\s+/).length <= 4) {
      return titleCaseValue(cleaned);
    }
  }

  return "";
}

function parseKeyValueText(message: string) {
  const result: PartialInput = {};
  const parts = message
    .split(/\n|,/g)
    .map((p) => p.trim())
    .filter(Boolean);

  for (const part of parts) {
    const idx = part.indexOf(":");
    if (idx === -1) continue;
    const rawKey = norm(part.slice(0, idx));
    const rawValue = part.slice(idx + 1).trim();
    const mapping = KEY_MAP.find((entry) => entry.keys.includes(rawKey));
    if (!mapping) continue;
    assignField(result, mapping.field, rawValue);
  }

  return result;
}

function parseLoosePatterns(message: string) {
  const result: PartialInput = {};
  const text = norm(message);
  const messageTokens = text.split(/\s+/).filter(Boolean);

  const patterns: Array<{ field: keyof RecommendationInput; regex: RegExp }> = [
    { field: "state", regex: /\bstate\s+([a-z ]{2,})/i },
    { field: "district", regex: /\bdistrict\s+([a-z ]{2,})/i },
    { field: "seed_name", regex: /\bseed\s+name\s+([a-z0-9 ]{2,})/i },
    { field: "seed_variety", regex: /\bvariety\s+([a-z0-9\- ]{2,})/i },
    { field: "field_quality", regex: /\b(field|land)\s+quality\s+([a-z ]{2,})/i },
    { field: "suitable_crop_for_field", regex: /\bcrop\s+([a-z ]{2,})/i },
    { field: "moisture", regex: /\bmoisture[^0-9]*(-?\d+(\.\d+)?)/i },
    { field: "humidity", regex: /\bhumidity[^0-9]*(-?\d+(\.\d+)?)/i },
    { field: "rainfall", regex: /\brainfall[^0-9]*(-?\d+(\.\d+)?)/i },
    { field: "temperature", regex: /\b(temp|temperature)[^0-9\-]*(-?\d+(\.\d+)?)/i }
  ];

  for (const p of patterns) {
    const m = text.match(p.regex);
    if (!m) continue;
    const value = (m[2] || m[1] || "").trim();
    assignField(result, p.field, value);
  }

  const soilHints: Array<{ token: string; value: string }> = [
    { token: "black soil", value: "Black" },
    { token: "deep black", value: "Black" },
    { token: "sandy loam", value: "Sandy Loam" },
    { token: "loamy", value: "Loamy" },
    { token: "clay loam", value: "Clay Loam" },
    { token: "clayey", value: "Clayey" },
    { token: "sandy", value: "Sandy" },
    { token: "red soil", value: "Red Soil" }
  ];
  for (const hint of soilHints) {
    if (text.includes(hint.token) && !result.suitable_land_type_for_seed) {
      result.suitable_land_type_for_seed = hint.value;
      if (!result.field_composition) {
        result.field_composition = hint.value;
      }
    }
  }

  for (const state of KNOWN_STATES) {
    if (text.includes(state)) {
      result.state = state
        .split(" ")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
      break;
    }
  }

  if (!result.state) {
    for (const [alias, canonical] of Object.entries(STATE_ALIASES)) {
      if (text.includes(alias)) {
        result.state = titleCaseValue(canonical);
        break;
      }
    }
  }

  for (const district of KNOWN_DISTRICTS) {
    if (text.includes(district)) {
      result.district = titleCaseValue(district);
      break;
    }
  }

  if (!result.district) {
    for (const [alias, canonical] of Object.entries(DISTRICT_ALIASES)) {
      if (text.includes(alias)) {
        result.district = titleCaseValue(canonical);
        break;
      }
    }
  }

  if (!result.state) {
    for (const state of KNOWN_STATES) {
      const stateTokens = state.split(" ");
      const firstTokenIndex = messageTokens.findIndex((token) => token === stateTokens[0]);
      if (firstTokenIndex === -1) continue;
      const candidate = messageTokens.slice(firstTokenIndex, firstTokenIndex + stateTokens.length).join(" ");
      if (candidate === state) {
        result.state = titleCaseValue(state);
        const trailing = messageTokens.slice(firstTokenIndex + stateTokens.length).join(" ").trim();
        if (trailing && !result.district && trailing.split(/\s+/).length <= 3) {
          result.district = titleCaseValue(trailing);
        }
        break;
      }
    }
  }

  if (!result.state) {
    for (const [alias, canonical] of Object.entries(STATE_ALIASES)) {
      const aliasTokens = alias.split(" ");
      const firstTokenIndex = messageTokens.findIndex((token) => token === aliasTokens[0]);
      if (firstTokenIndex === -1) continue;
      const candidate = messageTokens.slice(firstTokenIndex, firstTokenIndex + aliasTokens.length).join(" ");
      if (candidate === alias) {
        result.state = titleCaseValue(canonical);
        const trailing = messageTokens.slice(firstTokenIndex + aliasTokens.length).join(" ").trim();
        if (trailing && !result.district && trailing.split(/\s+/).length <= 3) {
          result.district = titleCaseValue(trailing.replace(/\bdistrict\b/i, "").trim());
        }
        break;
      }
    }
  }

  const districtMatch = text.match(/\b([a-z]+(?:\s+[a-z]+){0,2})\s+district\b/i);
  if (districtMatch && !result.district) {
    const districtCandidate = districtMatch[1]
      .trim()
      .split(/\s+/)
      .slice(-2)
      .join(" ");
    result.district = titleCaseValue(districtCandidate);
  }

  const stateDistrictPattern = text.match(
    /\b(?:in|from)\s+([a-z ]+?)\s+(?:in|,)\s+([a-z ]{2,})(?:\b|$)/i
  );
  if (stateDistrictPattern) {
    const possibleState = stateDistrictPattern[1].trim().toLowerCase();
    if (!result.state && KNOWN_STATES.includes(possibleState)) {
      result.state = titleCaseValue(possibleState);
    }
    if (!result.district && stateDistrictPattern[2].trim().split(/\s+/).length <= 3) {
      result.district = titleCaseValue(stateDistrictPattern[2].trim());
    }
  }

  const districtStatePattern = text.match(
    /\b(?:live in|from|in)\s+([a-z ]{2,})\s+(maharashtra|gujarat|karnataka|kerala|punjab|rajasthan|bihar|assam|odisha|telangana|tamil nadu|uttar pradesh|madhya pradesh|west bengal)\b/i
  );
  if (districtStatePattern) {
    const possibleDistrict = districtStatePattern[1].trim().toLowerCase();
    const normalizedDistrict = DISTRICT_ALIASES[possibleDistrict] || possibleDistrict;
    if (!result.district && normalizedDistrict.split(/\s+/).length <= 3) {
      result.district = titleCaseValue(normalizedDistrict);
    }
    if (!result.state) {
      result.state = titleCaseValue(districtStatePattern[2].trim().toLowerCase());
    }
  }

  const seasonMatch = text.match(/\b(kharif|rabi|zaid)\b/i);
  if (seasonMatch) {
    const s = seasonMatch[1].toLowerCase();
      result.season = s.charAt(0).toUpperCase() + s.slice(1);
  }

  for (const [alias, canonical] of Object.entries(CROP_ALIASES)) {
    if (new RegExp(`\\b${alias}\\b`, "i").test(text)) {
      if (!result.suitable_crop_for_field) {
        result.suitable_crop_for_field = canonical;
      }
      if (new RegExp(`\\b${alias}\\s+seed[s]?\\b`, "i").test(text) && !result.seed_name) {
        result.seed_name = `${canonical} seed`;
      }
      break;
    }
  }

  const genericEntity = extractGenericCropOrSeed(text);
  if (genericEntity) {
    if (!result.seed_name && /\bseed|seeds\b/i.test(text)) {
      result.seed_name = `${genericEntity} seed`;
    }
    if (!result.suitable_crop_for_field) {
      result.suitable_crop_for_field = genericEntity;
    }
  }

  return result;
}

function countUsefulFields(data: PartialInput) {
  return Object.entries(data).filter(([, v]) => {
    if (v === undefined || v === null) return false;
    if (typeof v === "number") return Number.isFinite(v);
    return String(v).trim().length > 0;
  }).length;
}

export function parseFieldInputFromMessage(message: string) {
  const kv = parseKeyValueText(message);
  const loose = parseLoosePatterns(message);
  const merged: PartialInput = { ...loose, ...kv };
  return { fieldInput: merged, usefulFields: countUsefulFields(merged) };
}

export function mergeFieldInputs(...items: PartialInput[]) {
  const merged: PartialInput = {};
  for (const item of items) {
    for (const [key, value] of Object.entries(item)) {
      if (value === undefined || value === null) continue;
      if (typeof value === "string" && value.trim().length === 0) continue;
      if (typeof value === "number" && !Number.isFinite(value)) continue;
      merged[key as keyof RecommendationInput] = value as never;
    }
  }
  return merged;
}

export function detectIntent(
  message: string,
  options?: {
    hasRecommendationContext?: boolean;
    hasFieldContext?: boolean;
    guidedCollectionActive?: boolean;
    conversationMode?: string;
  }
): ChatIntent {
  const text = norm(message);
  if (!text) return "unknown";
  const hasFieldSpecificSuitabilitySignal =
    /\b(suitable|plant|sow|grow)\b/i.test(text) &&
    /\b(wheat|rice|cotton|maize|soybean|soyabean|tomato|tomatoes|pulse|pulses)\b/i.test(text) &&
    /\b(my field|for my field|in my field|i live in|my district|my state|district|state|soil|land)\b/i.test(text);
  const hasDetailedRecommendationSignal =
    /\b(compare|comparison|best match|higher yield|profitable|profit|best time|sowing time|when to sow|which seed|which crop|best crop|best seed|recommend|suggest)\b/i.test(
      text
    ) &&
    /\b(seed|seeds|crop|crops|field|soil|kharif|rabi|zaid|grow|sow|plant|yield)\b/i.test(text);

  const greetingRegex = /^(hi|hello|hey|hii|good morning|good evening|namaste|hola)\b/i;
  const greetingStripped = text.replace(greetingRegex, "").trim();
  const greetingHasRealQuestion =
    greetingStripped.length > 0 &&
    /\b(seed|seeds|crop|crops|soil|field|yield|weather|rainfall|humidity|temperature|recommend|suggest|suitable|plant|sow|kharif|rabi|zaid|tell me about|what is|need|want|know)\b/i.test(
      greetingStripped
    );

  if (greetingRegex.test(text) && text.split(/\s+/).length <= 6 && !greetingHasRealQuestion) {
    return "greeting";
  }

  if (/\b(format|template|schema|json format|input format)\b/i.test(text)) {
    return "format_request";
  }

  if (/\b(i never asked|that is not what i wanted|why are you recommending|i asked something else|stop recommending|not what i wanted)\b/i.test(text)) {
    return "correction_or_complaint";
  }

  if (
    /\b(suitable conditions|conditions to grow|grow this crop|grow this seed|best conditions to grow|how to grow)\b/i.test(
      text
    )
  ) {
    return "agronomy_advice";
  }

  if (
    /\b(which soil|what soil|best soil|exact soil|required soil|soil required|suitable soil|what seed type|best seed type)\b/i.test(
      text
    ) &&
    /\b(wheat|rice|cotton|maize|soybean|soyabean|tomato|tomatoes|pulse|pulses)\b/i.test(text)
  ) {
    return "agronomy_advice";
  }

  if (
    /\b(is .* suitable|is .* good for my field|can i plant|can i sow|is it suitable|suitable for my field|compatible)\b/i.test(
      text
    )
  ) {
    return "compatibility_check";
  }

  if (
    options?.hasFieldContext &&
    /\b(what about|how about|what if i plant|what if i sow|if i plant|if i sow)\b/i.test(text) &&
    /\b(soybean|soyabean|tomato|tomatoes|wheat|rice|cotton|maize|pulse|pulses)\b/i.test(text)
  ) {
    return /\bplant|sow\b/i.test(text) ? "compatibility_check" : "agronomy_advice";
  }

  if (
    /\b(why did you suggest|why not|explain confidence|what matched|why this crop|why this seed|explain this recommendation)\b/i.test(
      text
    )
  ) {
    return "follow_up_explanation";
  }

  if (
    /\b(what is|what are|define|meaning of|explain|what affects|tell me about)\b/i.test(text) &&
    !hasFieldSpecificSuitabilitySignal &&
    /\b(kharif|rabi|zaid|black soil|alluvial|loamy|sandy|clayey|yield|seed quality|soil|moisture|humidity|rainfall|temperature|seed|seeds)\b/i.test(
      text
    )
  ) {
    return "informational_question";
  }

  if (
    /\b(know about|tell me about|information about|understand)\b/i.test(text) &&
    !hasFieldSpecificSuitabilitySignal &&
    /\b(seed|seeds|soil|crop|yield|fertilizer|season)\b/i.test(text)
  ) {
    return "informational_question";
  }

  if (
    /\b(recommend|suggest|best crop|best seed|which crop|which seed|what should i plant|recommend crop|suggest seed)\b/i.test(text) ||
    hasFieldSpecificSuitabilitySignal ||
    hasDetailedRecommendationSignal ||
    (/\b(best|suitable)\b/i.test(text) && /\bseed|seeds|crop|crops\b/i.test(text) && /\b(my field|for my field|in my field)\b/i.test(text)) ||
    (/\b(seed|seeds)\b/i.test(text) && /\b(sow|plant)\b/i.test(text) && /\b(my field|for my field|in my field)\b/i.test(text)) ||
    (/\b(best|suitable|recommend|suggest)\b/i.test(text) && /\b(seed|seeds|variety|varieties)\b/i.test(text)) ||
    (/\b(sow|plant|grow)\b/i.test(text) && /\b(seed|seeds)\b/i.test(text) && /\b(backyard|garden|home garden|field)\b/i.test(text))
  ) {
    return "recommendation_request";
  }

  if (
    /\b(help me|guide me|step by step|ask step by step|walk me through|guide|start)\b/i.test(text) &&
    !hasDetailedRecommendationSignal
  ) {
    return "help";
  }

  if (options?.hasRecommendationContext && /\b(why|explain|matched|confidence|not)\b/i.test(text)) {
    return "follow_up_explanation";
  }

  if (
    options?.conversationMode === "collecting_fields" &&
    options?.guidedCollectionActive
  ) {
    return "collecting_fields";
  }

  return "unknown";
}

export function summarizeCapturedFields(data: PartialInput) {
  const items: string[] = [];
  const push = (formatter: (value: string | number) => string, key: keyof RecommendationInput) => {
    const value = data[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      items.push(formatter(value));
    }
  };
  push((value) => `State: ${value}`, "state");
  push((value) => `District: ${value}`, "district");
  if (String(data.field_composition || "").trim()) {
    push((value) => `Field composition: ${value}`, "field_composition");
  } else {
    push((value) => `Soil type: ${value}`, "suitable_land_type_for_seed");
  }
  if (Number.isFinite(data.moisture)) {
    items.push(`Field moisture condition: ${describeMoistureValue(Number(data.moisture))}`);
  }
  push((value) => `Season: ${value}`, "season");
  push((value) => `Field history: ${value}`, "field_history_or_crops");
  push((value) => `Field quality: ${value}`, "field_quality");
  push((value) => `Seed: ${value}`, "seed_name");
  push((value) => `Seed variety: ${value}`, "seed_variety");
  return items;
}

export function getNextImportantMissingField(data: PartialInput): PendingQuestionField | undefined {
  if (!String(data.state || "").trim()) return "state";
  if (!String(data.district || "").trim()) return "district";
  if (!String(data.suitable_land_type_for_seed || "").trim() && !String(data.field_composition || "").trim()) {
    return "field_composition";
  }
  if (!String(data.season || "").trim()) return "season";
  if (!Number.isFinite(data.moisture)) return "moisture";
  if (!Number.isFinite(data.rainfall)) return "rainfall";
  if (!Number.isFinite(data.humidity)) return "humidity";
  if (!Number.isFinite(data.temperature)) return "temperature";
  if (!String(data.field_history_or_crops || "").trim()) return "field_history_or_crops";
  if (!String(data.field_quality || "").trim()) return "field_quality";
  return undefined;
}

export function parsePendingFieldAnswer(
  message: string,
  expectedField?: keyof RecommendationInput
): PartialInput | null {
  const trimmed = message.trim();
  if (!trimmed || !expectedField) return null;

  const parsed = parseFieldInputFromMessage(trimmed).fieldInput;
  if (parsed[expectedField] !== undefined && String(parsed[expectedField]).trim() !== "") {
    return { [expectedField]: parsed[expectedField] } as PartialInput;
  }

  const lower = norm(trimmed);
  if (trimmed.length > 80 && !/[,:]/.test(trimmed)) {
    return null;
  }

  switch (expectedField) {
    case "state":
      for (const state of KNOWN_STATES) {
        if (lower === state || lower.includes(state)) {
          const remainder = trimmed.slice(lower.indexOf(state) + state.length).trim();
          return {
            state: state
              .split(" ")
              .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
              .join(" "),
            ...(remainder && remainder.split(/\s+/).length <= 3
              ? { district: titleCaseValue(remainder.replace(/^[,\s-]+/, "").trim()) }
              : {})
          };
        }
      }
      if (trimmed.length >= 2) {
        const parts = trimmed.split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
          return {
            state: titleCaseValue(parts[0]),
            district: titleCaseValue(parts.slice(1).join(" "))
          };
        }
        return { state: titleCaseValue(trimmed) };
      }
      return null;
    case "district":
      return isDirectShortAnswer(trimmed, 4)
        ? { district: titleCaseValue(trimmed.replace(/\bdistrict\b/i, "").trim()) }
        : null;
    case "season": {
      const seasonMatch = lower.match(/\b(kharif|rabi|zaid)\b/);
      return seasonMatch
        ? { season: seasonMatch[1].charAt(0).toUpperCase() + seasonMatch[1].slice(1) }
        : null;
    }
    case "field_composition":
    case "suitable_land_type_for_seed": {
      if (/\bmuddy\b/i.test(trimmed)) {
        return {
          suitable_land_type_for_seed: "Clayey",
          field_composition: "Clayey",
          moisture: 80
        };
      }
      if (/^(it'?s\s+)?(very\s+)?(dry|wet|moist|damp)$/i.test(trimmed)) {
        const moistureScale = extractRelativeScale(trimmed, "moisture");
        return moistureScale !== null ? { moisture: moistureScale } : null;
      }
      if (!isDirectShortAnswer(trimmed, 5) && !/\bsoil|loam|clay|sandy|black|red|alluvial\b/i.test(trimmed)) {
        return null;
      }
      const soilParsed = parseFieldInputFromMessage(trimmed).fieldInput;
      const soilValue =
        String(soilParsed.suitable_land_type_for_seed || "").trim() ||
        String(soilParsed.field_composition || "").trim() ||
        normalizeSoilAnswer(trimmed);
      if (!soilValue.trim()) return null;
      return {
        suitable_land_type_for_seed: soilValue,
        field_composition: soilValue
      };
    }
    case "moisture": {
      const numericParsed = parseFieldInputFromMessage(trimmed).fieldInput.moisture;
      if (typeof numericParsed === "number" && Number.isFinite(numericParsed)) {
        return { moisture: numericParsed };
      }
      const moistureScale = extractRelativeScale(trimmed, "moisture");
      return moistureScale !== null ? { moisture: moistureScale } : null;
    }
    case "humidity":
    case "rainfall":
    case "temperature": {
      const numericParsed = parseFieldInputFromMessage(trimmed).fieldInput[expectedField];
      if (typeof numericParsed === "number" && Number.isFinite(numericParsed)) {
        return { [expectedField]: numericParsed } as PartialInput;
      }
      const scaledValue = extractRelativeScale(trimmed, expectedField);
      if (scaledValue !== null) {
        return { [expectedField]: scaledValue } as PartialInput;
      }
      return null;
    }
    case "field_history_or_crops":
      return isDirectShortAnswer(trimmed, 6) ? { field_history_or_crops: titleCaseValue(trimmed) } : null;
    case "field_quality": {
      const qualityMatch = lower.match(/\b(low|medium|high)\b/);
      return qualityMatch ? { field_quality: titleCaseValue(qualityMatch[1]) } : null;
    }
    default:
      return null;
  }
}

function isDirectShortAnswer(value: string, maxWords: number) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("?")) return false;
  const words = trimmed.split(/\s+/).filter(Boolean);
  return words.length > 0 && words.length <= maxWords && trimmed.length <= 40;
}

function normalizeSoilAnswer(value: string) {
  const lower = norm(value);
  if (lower.includes("black")) return "Black soil";
  if (lower.includes("red")) return "Red soil";
  if (lower.includes("sandy loam")) return "Sandy loam";
  if (lower.includes("loam")) return "Loamy";
  if (lower.includes("clay")) return "Clayey";
  if (lower.includes("muddy")) return "Clayey";
  if (lower.includes("alluvial")) return "Alluvial";
  return titleCaseValue(value);
}

function describeMoistureValue(value: number) {
  if (value <= 30) return "Dry";
  if (value <= 65) return "Moderate";
  return "Wet";
}

export function hasMinimumForRecommendation(data: PartialInput) {
  const requiredState = Boolean((data.state || "").toString().trim());
  const requiredSeason = Boolean((data.season || "").toString().trim());
  const requiredSoil =
    Boolean((data.suitable_land_type_for_seed || "").toString().trim()) ||
    Boolean((data.field_composition || "").toString().trim());
  return requiredState && requiredSeason && requiredSoil;
}

export function hasMinimumForCompatibility(data: PartialInput) {
  const requiredState = Boolean((data.state || "").toString().trim());
  const requiredSeason = Boolean((data.season || "").toString().trim());
  const requiredSoil =
    Boolean((data.suitable_land_type_for_seed || "").toString().trim()) ||
    Boolean((data.field_composition || "").toString().trim());
  return requiredState && requiredSeason && requiredSoil;
}

export function nextFollowUpQuestions(data: PartialInput) {
  const missing = missingCriticalFields(data);
  const has = (key: keyof RecommendationInput) => !missing.includes(key);
  const questions: string[] = [];

  if (!has("state")) {
    questions.push("Which state is your field in?");
  } else if (!has("district")) {
    questions.push("Which district is your field in?");
  } else if (!has("suitable_land_type_for_seed") && !has("field_composition")) {
    questions.push("What is the land/soil type or field composition?");
  } else if (!has("season")) {
    questions.push("Which season are you planning for, Kharif or Rabi?");
  } else if (!has("moisture") || !has("rainfall")) {
    questions.push("Please share moisture (%) and rainfall (mm).");
  } else if (!has("temperature") || !has("humidity")) {
    questions.push("Please share temperature (C) and humidity (%).");
  } else if (!has("seed_name") || !has("seed_variety")) {
    questions.push("What seed name and variety are you planning to use?");
  } else if (!has("field_quality") || !has("field_history_or_crops")) {
    questions.push("What is field quality and previous crop history?");
  } else if (!has("suitable_crop_for_field")) {
    questions.push("Do you already have a target crop in mind?");
  }

  if (questions.length < 2 && missing.length > 0) {
    const preferredOrder: Array<keyof RecommendationInput> = [
      "state",
      "district",
      "field_composition",
      "suitable_land_type_for_seed",
      "season",
      "moisture",
      "rainfall",
      "humidity",
      "temperature",
      "field_history_or_crops",
      "field_quality",
      "seed_name",
      "seed_variety",
      "seed_type",
      "seed_quality",
      "suitable_crop_for_field"
    ];
    const second = preferredOrder.find((key) => missing.includes(key)) ?? missing[0];
    questions.push(`Also share ${String(second).replace(/_/g, " ")}.`);
  }

  return questions.slice(0, 2);
}

export function missingCriticalFields(data: PartialInput) {
  const required: Array<keyof RecommendationInput> = [
    "seed_name",
    "seed_variety",
    "seed_type",
    "seed_quality",
    "suitable_land_type_for_seed",
    "field_quality",
    "field_history_or_crops",
    "field_composition",
    "moisture",
    "humidity",
    "rainfall",
    "temperature",
    "state",
    "district",
    "suitable_crop_for_field"
  ];

  return required.filter((key) => {
    const v = data[key];
    if (v === undefined || v === null) return true;
    if (typeof v === "number") return !Number.isFinite(v);
    return String(v).trim().length === 0;
  });
}
