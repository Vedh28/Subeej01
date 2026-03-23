import { MapContainer, TileLayer, LayersControl, GeoJSON } from "react-leaflet";
import L from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import { getApiUrl } from "../../lib/api-base";

const position: [number, number] = [22.9734, 78.6569];

type LayerData = {
  districtMap: Record<string, string>;
  stateMap: Record<string, string>;
  colorMap: Record<string, string>;
  legend: Array<{ value: string; color: string }>;
  overall: string;
};

type FieldMapData = {
  layers: {
    soil: LayerData;
    seedType: LayerData;
    fieldQuality: LayerData;
    fieldHistory: LayerData;
    fieldComposition: LayerData;
    moisture: NumericLayerData;
    soilPh: NumericLayerData;
    temperature: NumericLayerData;
    humidity: NumericLayerData;
    rainfall: NumericLayerData;
  };
  districtInsights: Record<string, { topCrops: string[]; topSeeds: string[] }>;
  statesWithData: string[];
};

type GeoFeature = {
  type: string;
  properties: Record<string, unknown>;
  geometry: unknown;
};

type NumericLayerData = {
  districtMap: Record<string, number>;
  stateMap: Record<string, number>;
  overall: number;
};

type SelectedField = {
  district: string;
  state: string;
  soil: string;
  composition: string;
  fieldQuality: string;
  fieldHistory: string;
  moisture: number | null;
  soilPh: number | null;
  temperature: number | null;
  humidity: number | null;
  rainfall: number | null;
};

type FieldMapProps = {
  onSelect?: (field: SelectedField) => void;
};

export default function FieldMap({ onSelect }: FieldMapProps) {
  const [geoData, setGeoData] = useState<{ type: string; features: GeoFeature[] } | null>(null);
  const [stateData, setStateData] = useState<{ type: string; features: GeoFeature[] } | null>(null);
  const [mapData, setMapData] = useState<FieldMapData | null>(null);
  const mapDataRef = useRef<FieldMapData | null>(null);
  const activeLayer: "soil" | "seedType" | "fieldQuality" = "soil";

  useEffect(() => {
    const defaultIcon = L.Icon.Default.prototype as { _getIconUrl?: string };
    delete defaultIcon._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png"
    });
  }, []);

  useEffect(() => {
    mapDataRef.current = mapData;
  }, [mapData]);

  useEffect(() => {
    const safeSetGeo = (setter: (value: { type: string; features: GeoFeature[] } | null) => void) =>
      (data: unknown) => {
        if (
          !data ||
          typeof data !== "object" ||
          (data as { type?: string }).type !== "FeatureCollection" ||
          !Array.isArray((data as { features?: unknown }).features)
        ) {
          setter(null);
          return;
        }

        const raw = data as { type: string; features: GeoFeature[] };
        const filtered = raw.features.filter((feature) => {
          if (!feature || typeof feature !== "object") return false;
          const geometry = (feature as { geometry?: { type?: string; coordinates?: unknown } }).geometry;
          if (!geometry || typeof geometry !== "object") return false;
          if (!geometry.type) return false;
          if (geometry.coordinates === undefined || geometry.coordinates === null) return false;
          return true;
        });

        if (!filtered.length) {
          setter(null);
          return;
        }

        const normalized = filtered.map((feature) => ({
          ...feature,
          type: "Feature"
        })) as GeoFeature[];

        setter({ type: "FeatureCollection", features: normalized });
      };

    fetch("/maps/india_districts.geojson")
      .then((res) => res.json())
      .then(safeSetGeo(setGeoData))
      .catch(() => setGeoData(null));

    fetch("/maps/india_states.geojson")
      .then((res) => res.json())
      .then(safeSetGeo(setStateData))
      .catch(() => setStateData(null));

    fetch(getApiUrl("/api/field-map"))
      .then((res) => res.json())
      .then((data) => setMapData(data as FieldMapData))
      .catch(() => setMapData(null));
  }, []);

  const legendItems = useMemo(() => {
    if (!mapData) return [];
    return mapData.layers[activeLayer]?.legend?.slice(0, 12) || [];
  }, [mapData, activeLayer]);

  const normalizeKey = (value: unknown) =>
    String(value || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, " ")
      .trim();

  const statesWithData = useMemo(() => {
    if (!mapData?.statesWithData) return new Set<string>();
    return new Set(mapData.statesWithData);
  }, [mapData]);

  const getLayerValue = (props: Record<string, unknown>) => {
    if (!mapData) return "Unknown";
    const district = normalizeKey(props.District ?? props.district ?? "");
    const state = normalizeKey(props.STATE ?? props.state ?? props.NAME_1 ?? "");
    if (district && state) {
      const key = `${district}||${state}`;
      const districtMap = mapData.layers[activeLayer]?.districtMap || {};
      if (districtMap[key]) return districtMap[key];
    }
    const layer = mapData.layers[activeLayer];
    const stateMap = layer?.stateMap || {};
    if (state && stateMap[state]) return stateMap[state];
    if (layer?.overall) return layer.overall;
    return "Unknown";
  };

  const getSoilValue = (props: Record<string, unknown>) => {
    if (!mapData) return { value: "Unknown", source: "none" as const };
    const district = normalizeKey(props.District ?? props.district ?? "");
    const state = normalizeKey(props.STATE ?? props.state ?? props.NAME_1 ?? "");
    const soilLayer = mapData.layers.soil;
    if (!soilLayer) return { value: "Unknown", source: "none" as const };
    if (district && state) {
      const key = `${district}||${state}`;
      if (soilLayer.districtMap[key]) return { value: soilLayer.districtMap[key], source: "district" as const };
    }
    if (state && soilLayer.stateMap[state]) return { value: soilLayer.stateMap[state], source: "state" as const };
    if (soilLayer.overall) return { value: soilLayer.overall, source: "overall" as const };
    return { value: "Unknown", source: "none" as const };
  };

  const getCompositionValue = (props: Record<string, unknown>) => {
    if (!mapData) return { value: "Unknown", source: "none" as const };
    const district = normalizeKey(props.District ?? props.district ?? "");
    const state = normalizeKey(props.STATE ?? props.state ?? props.NAME_1 ?? "");
    const compositionLayer = mapData.layers.fieldComposition;
    if (!compositionLayer) return { value: "Unknown", source: "none" as const };
    if (district && state) {
      const key = `${district}||${state}`;
      if (compositionLayer.districtMap[key]) return { value: compositionLayer.districtMap[key], source: "district" as const };
    }
    if (state && compositionLayer.stateMap[state]) return { value: compositionLayer.stateMap[state], source: "state" as const };
    if (compositionLayer.overall) return { value: compositionLayer.overall, source: "overall" as const };
    return { value: "Unknown", source: "none" as const };
  };

  const getStringLayerValue = (props: Record<string, unknown>, layer: LayerData) => {
    const district = normalizeKey(props.District ?? props.district ?? "");
    const state = normalizeKey(props.STATE ?? props.state ?? props.NAME_1 ?? "");
    if (district && state) {
      const key = `${district}||${state}`;
      if (layer.districtMap[key]) return layer.districtMap[key];
    }
    if (state && layer.stateMap[state]) return layer.stateMap[state];
    return layer.overall || "Unknown";
  };

  const getNumericValue = (props: Record<string, unknown>, layer: NumericLayerData) => {
    const district = normalizeKey(props.District ?? props.district ?? "");
    const state = normalizeKey(props.STATE ?? props.state ?? props.NAME_1 ?? "");
    if (district && state) {
      const key = `${district}||${state}`;
      if (Number.isFinite(layer.districtMap[key])) return layer.districtMap[key];
    }
    if (state && Number.isFinite(layer.stateMap[state])) return layer.stateMap[state];
    return Number.isFinite(layer.overall) ? layer.overall : null;
  };

  const getAnyDistrictForState = (stateKey: string) => {
    if (!geoData) return "Any district";
    const match = geoData.features.find((feature) => {
      const props = (feature?.properties || {}) as Record<string, unknown>;
      const featureState = normalizeKey(props.STATE ?? props.state ?? props.NAME_1 ?? "");
      return featureState === stateKey;
    });
    if (!match) return "Any district";
    const props = (match.properties || {}) as Record<string, unknown>;
    return String(props.District || props.district || "Any district");
  };

  const getFillColor = (props: Record<string, unknown>) => {
    if (!mapData) return "#d1d5db";
    const value = getLayerValue(props);
    return mapData.layers[activeLayer]?.colorMap?.[value] || "#d1d5db";
  };

  return (
    <div className="map-container relative">
      {legendItems.length ? (
        <div className="absolute bottom-4 left-4 z-[500] rounded-lg bg-white/90 p-3 text-xs shadow-lg">
          <div className="mb-2 font-semibold text-seed-dark">Soil Types</div>
          {legendItems.map((item) => (
            <div key={item.value} className="flex items-center gap-2 text-seed-dark/90">
              <span
                className="inline-block h-3 w-3 rounded-sm"
                style={{ backgroundColor: item.color }}
              />
              <span>{item.value}</span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="map-canvas">
        <MapContainer center={position} zoom={5} scrollWheelZoom className="h-full w-full">
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Satellite">
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Terrain">
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
              />
            </LayersControl.BaseLayer>
            <LayersControl.Overlay checked name="Field Layer">
            {geoData && mapData ? (
              <GeoJSON
                data={geoData as never}
                style={(feature) => ({
                  color: "#2f2f2f",
                  weight: 0.6,
                  fillOpacity: 0.55,
                  fillColor: getFillColor((feature?.properties || {}) as Record<string, unknown>)
                })}
                interactive
                onEachFeature={(feature, layer) => {
                  const props = (feature?.properties || {}) as Record<string, unknown>;
                  const district = String(props.District || props.district || "Unknown");
                  const state = String(props.STATE || props.state || props.NAME_1 || "Unknown");
                  const value = getLayerValue(props);
                  const soilInfo = getSoilValue(props);
                  const soilSourceLabel =
                    soilInfo.source === "district"
                      ? "District"
                      : soilInfo.source === "state"
                        ? "State"
                        : soilInfo.source === "overall"
                          ? "Overall"
                          : "Not in dataset";
                  const districtKey = normalizeKey(district);
                  const stateKey = normalizeKey(state);
                  const key = `${districtKey}||${stateKey}`;
                  const insights = mapData?.districtInsights?.[key];
                  const cropsLabel = insights?.topCrops?.length ? insights.topCrops.join(", ") : "Not available";
                  const seedsLabel = insights?.topSeeds?.length ? insights.topSeeds.join(", ") : "Not available";
                  const label =
                    activeLayer === "soil"
                      ? `Soil: ${value}`
                      : activeLayer === "seedType"
                        ? `Seed Type: ${value}`
                        : `Field Quality: ${value}`;
                  layer.bindTooltip(
                    `${district}, ${state}<br/>${label}<br/>Dataset Soil (${soilSourceLabel}): ${soilInfo.value}<br/>Top Crops: ${cropsLabel}<br/>Top Seeds: ${seedsLabel}`,
                    { sticky: true, direction: "top", opacity: 0.95 }
                  );
                  layer.on({
                    click: () => {
                      const liveMapData = mapDataRef.current;
                      if (!liveMapData) return;
                      const soilInfo = getSoilValue(props);
                      const compositionInfo = getCompositionValue(props);
                      const fieldQuality = getStringLayerValue(props, liveMapData.layers.fieldQuality);
                      const fieldHistory = getStringLayerValue(props, liveMapData.layers.fieldHistory);
                      const moisture = getNumericValue(props, liveMapData.layers.moisture);
                      const soilPh = getNumericValue(props, liveMapData.layers.soilPh);
                      const temperature = getNumericValue(props, liveMapData.layers.temperature);
                      const humidity = getNumericValue(props, liveMapData.layers.humidity);
                      const rainfall = getNumericValue(props, liveMapData.layers.rainfall);
                      onSelect?.({
                        district,
                        state,
                        soil: soilInfo.value,
                        composition: compositionInfo.value,
                        fieldQuality,
                        fieldHistory,
                        moisture,
                        soilPh,
                        temperature,
                        humidity,
                        rainfall
                      });
                    }
                  });
                  layer.on({
                    mouseover: () => layer.openTooltip(),
                    mouseout: () => layer.closeTooltip()
                  });
                }}
              />
            ) : null}
            </LayersControl.Overlay>
          <LayersControl.Overlay checked name="State Boundaries">
            {stateData ? (
              <GeoJSON
                data={stateData as never}
                style={(feature) => {
                  const props = (feature?.properties || {}) as Record<string, unknown>;
                  const state = normalizeKey(props.STATE ?? props.state ?? props.NAME_1 ?? "");
                  const hasData = state ? statesWithData.has(state) : false;
                  return {
                    color: hasData ? "#0f5132" : "#1f2937",
                    weight: hasData ? 2 : 1.4,
                    fillOpacity: hasData ? 0.12 : 0,
                    fillColor: hasData ? "#48b86a" : "transparent"
                  };
                }}
                onEachFeature={(feature, layer) => {
                  const props = (feature?.properties || {}) as Record<string, unknown>;
                  const stateName = String(props.STATE || props.state || props.NAME_1 || "Unknown");
                  const stateKey = normalizeKey(stateName);
                  layer.on({
                    click: () => {
                      const liveMapData = mapDataRef.current;
                      if (!liveMapData) return;
                      const anyDistrict = getAnyDistrictForState(stateKey);
                      const soilInfo = getSoilValue({ STATE: stateName });
                      const compositionInfo = getCompositionValue({ STATE: stateName });
                      const fieldQuality = getStringLayerValue({ STATE: stateName }, liveMapData.layers.fieldQuality);
                      const fieldHistory = getStringLayerValue({ STATE: stateName }, liveMapData.layers.fieldHistory);
                      const moisture = getNumericValue({ STATE: stateName }, liveMapData.layers.moisture);
                      const soilPh = getNumericValue({ STATE: stateName }, liveMapData.layers.soilPh);
                      const temperature = getNumericValue({ STATE: stateName }, liveMapData.layers.temperature);
                      const humidity = getNumericValue({ STATE: stateName }, liveMapData.layers.humidity);
                      const rainfall = getNumericValue({ STATE: stateName }, liveMapData.layers.rainfall);
                      onSelect?.({
                        district: anyDistrict,
                        state: stateName,
                        soil: soilInfo.value,
                        composition: compositionInfo.value,
                        fieldQuality,
                        fieldHistory,
                        moisture,
                        soilPh,
                        temperature,
                        humidity,
                        rainfall
                      });
                    }
                  });
                }}
              />
            ) : null}
          </LayersControl.Overlay>
          </LayersControl>
        </MapContainer>
      </div>
    </div>
  );
}
