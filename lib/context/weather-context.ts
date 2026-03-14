export interface WeatherContext {
  city: string;
  state?: string;
  temperature?: number;
  humidity?: number;
  rainfall?: number;
  weather?: string;
  source: "openweathermap" | "inferred";
  resolved_from?: "district" | "state";
  fetched_at: string;
}

interface GeocodingRow {
  name?: string;
  state?: string;
  country?: string;
  lat?: number;
  lon?: number;
}

interface OpenWeatherResponse {
  main?: {
    temp?: number;
    humidity?: number;
  };
  weather?: Array<{ main?: string; description?: string }>;
  rain?: {
    ["1h"]?: number;
    ["3h"]?: number;
  };
}

const STATE_CAPITALS: Record<string, string> = {
  "andhra pradesh": "Amaravati",
  "arunachal pradesh": "Itanagar",
  assam: "Dispur",
  bihar: "Patna",
  chhattisgarh: "Raipur",
  goa: "Panaji",
  gujarat: "Gandhinagar",
  haryana: "Chandigarh",
  "himachal pradesh": "Shimla",
  jharkhand: "Ranchi",
  karnataka: "Bengaluru",
  kerala: "Thiruvananthapuram",
  "madhya pradesh": "Bhopal",
  maharashtra: "Mumbai",
  manipur: "Imphal",
  meghalaya: "Shillong",
  mizoram: "Aizawl",
  nagaland: "Kohima",
  odisha: "Bhubaneswar",
  punjab: "Chandigarh",
  rajasthan: "Jaipur",
  sikkim: "Gangtok",
  "tamil nadu": "Chennai",
  telangana: "Hyderabad",
  tripura: "Agartala",
  "uttar pradesh": "Lucknow",
  uttarakhand: "Dehradun",
  "west bengal": "Kolkata"
};

const CACHE_TTL_MS = 1000 * 60 * 15;
const weatherCache = new Map<string, { expiresAt: number; value: WeatherContext | null }>();

function getConfig() {
  return {
    apiKey: process.env.OPENWEATHER_API_KEY || process.env.OWM_API_KEY || "",
    baseUrl: process.env.OPENWEATHER_BASE_URL || "https://api.openweathermap.org"
  };
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

function normalizeRainfall(data?: OpenWeatherResponse["rain"]) {
  if (!data) return undefined;
  if (typeof data["1h"] === "number") return Number(data["1h"].toFixed(1));
  if (typeof data["3h"] === "number") return Number((data["3h"] / 3).toFixed(1));
  return undefined;
}

async function geocodeLocation(query: string, apiKey: string, baseUrl: string) {
  const geoRes = await fetch(
    `${baseUrl}/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=1&appid=${apiKey}`
  );

  if (!geoRes.ok) {
    throw new Error(`Weather geocoding failed (${geoRes.status}).`);
  }

  const geoRows = (await geoRes.json()) as GeocodingRow[];
  return geoRows[0] || null;
}

async function fetchWeatherByCoordinates(
  coords: { lat: number; lon: number },
  apiKey: string,
  baseUrl: string
) {
  const weatherRes = await fetch(
    `${baseUrl}/data/2.5/weather?lat=${coords.lat}&lon=${coords.lon}&appid=${apiKey}&units=metric`
  );

  if (!weatherRes.ok) {
    throw new Error(`Weather lookup failed (${weatherRes.status}).`);
  }

  return (await weatherRes.json()) as OpenWeatherResponse;
}

export async function getWeatherContext(location: {
  district?: string;
  state?: string;
}): Promise<WeatherContext | null> {
  const district = String(location.district || "").trim();
  const state = String(location.state || "").trim();
  if (!district && !state) return null;

  const cfg = getConfig();
  if (!cfg.apiKey) return null;

  const cacheKey = `${normalizeKey(state)}|${normalizeKey(district)}`;
  const cached = weatherCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  let geo: GeocodingRow | null = null;
  let resolvedFrom: "district" | "state" = "district";

  if (district) {
    geo = await geocodeLocation([district, state, "IN"].filter(Boolean).join(","), cfg.apiKey, cfg.baseUrl);
  }

  if ((!geo || !Number.isFinite(geo.lat) || !Number.isFinite(geo.lon)) && state) {
    const capital = STATE_CAPITALS[normalizeKey(state)];
    if (capital) {
      geo = await geocodeLocation([capital, state, "IN"].filter(Boolean).join(","), cfg.apiKey, cfg.baseUrl);
      resolvedFrom = "state";
    }
  }

  if (!geo || !Number.isFinite(geo.lat) || !Number.isFinite(geo.lon)) {
    weatherCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value: null });
    return null;
  }

  const weather = await fetchWeatherByCoordinates(
    { lat: Number(geo.lat), lon: Number(geo.lon) },
    cfg.apiKey,
    cfg.baseUrl
  );

  const result: WeatherContext = {
    city: geo.name || district,
    state: geo.state || state || undefined,
    temperature: typeof weather.main?.temp === "number" ? Number(weather.main.temp.toFixed(1)) : undefined,
    humidity: typeof weather.main?.humidity === "number" ? Number(weather.main.humidity.toFixed(1)) : undefined,
    rainfall: normalizeRainfall(weather.rain),
    weather: weather.weather?.[0]?.description || weather.weather?.[0]?.main || undefined,
    source: "openweathermap",
    resolved_from: resolvedFrom,
    fetched_at: new Date().toISOString()
  };

  weatherCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value: result });
  return result;
}
