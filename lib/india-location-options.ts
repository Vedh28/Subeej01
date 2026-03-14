import { DATASET_DISTRICTS_BY_STATE, DATASET_STATE_OPTIONS } from "./dataset-location-options";

export const DISTRICTS_BY_STATE: Record<string, string[]> = DATASET_DISTRICTS_BY_STATE;

export const INDIA_STATE_OPTIONS = DATASET_STATE_OPTIONS;
export const SUPPORTED_STATE_OPTIONS = DATASET_STATE_OPTIONS;

export function getDistrictOptionsForState(state: string) {
  const matchedState = resolveStateOption(state);
  if (!matchedState) {
    return [];
  }
  return DISTRICTS_BY_STATE[matchedState] || [];
}

export function resolveStateOption(state: string) {
  const normalized = state.trim().toLowerCase();
  return INDIA_STATE_OPTIONS.find((option) => option.toLowerCase() === normalized) || "";
}

export function resolveDistrictOption(state: string, district: string) {
  const normalizedDistrict = district.trim().toLowerCase();
  const districtOptions = getDistrictOptionsForState(state);
  return districtOptions.find((option) => option.toLowerCase() === normalizedDistrict) || "";
}
