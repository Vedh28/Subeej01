import { RecommendationInput } from "./types";
import { ChatIntent } from "./input-parser";

type PartialInput = Partial<RecommendationInput>;

interface LastRecommendationRecord {
  input: RecommendationInput;
  result: {
    recommended_crop: string;
    recommended_seed: string;
    confidence_score: number;
    reason: string;
    matched_features: string[];
    source_rows_used: number[];
  };
  top_matches: Array<{
    row_id: number;
    recommended_crop: string;
    recommended_seed: string;
    state: string;
    district: string;
    season: string;
    soil_type: string;
    field_composition: string;
    field_quality: string;
    field_history: string;
    moisture: number;
    humidity: number;
    rainfall: number;
    temperature: number;
    score: number;
    matched_features: string[];
    score_breakdown: Record<string, number>;
    agronomic_evaluation?: {
      penalty: number;
      adjusted_score: number;
      status: "Suitable" | "Suitable with conditions" | "Not suitable";
      rule_reasons: string[];
      notes: string[];
    };
  }>;
}

interface SessionContextRecord {
  season?: string;
  weather?: string;
  temperature?: number;
  humidity?: number;
  rainfall?: number;
  source?: string;
  city?: string;
  fetched_at?: string;
}

interface SessionRecord {
  session_id: string;
  fields: PartialInput;
  context?: SessionContextRecord;
  guided_collection_active: boolean;
  pending_question_field?: keyof RecommendationInput;
  pending_user_message?: string;
  pending_action_intent?: ChatIntent;
  ready_for_action: boolean;
  last_intent?: ChatIntent;
  conversation_mode?: string;
  last_recommendation?: LastRecommendationRecord;
  updated_at: number;
}

const TTL_MS = 1000 * 60 * 60 * 4;
const sessions = new Map<string, SessionRecord>();

function generateSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function cleanupExpired() {
  const now = Date.now();
  for (const [key, record] of sessions.entries()) {
    if (now - record.updated_at > TTL_MS) {
      sessions.delete(key);
    }
  }
}

function mergeFields(existing: PartialInput, incoming: PartialInput) {
  const merged: PartialInput = { ...existing };
  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value.trim().length === 0) continue;
    if (typeof value === "number" && !Number.isFinite(value)) continue;
    merged[key as keyof RecommendationInput] = value as never;
  }
  return merged;
}

export function getOrCreateSession(sessionId?: string) {
  cleanupExpired();
  if (sessionId && sessions.has(sessionId)) {
    return sessions.get(sessionId)!;
  }
  const id = sessionId || generateSessionId();
  const created: SessionRecord = {
    session_id: id,
    fields: {},
    guided_collection_active: false,
    ready_for_action: false,
    updated_at: Date.now()
  };
  sessions.set(id, created);
  return created;
}

export function updateSessionFields(sessionId: string, incoming: PartialInput) {
  const current = getOrCreateSession(sessionId);
  current.fields = mergeFields(current.fields, incoming);
  current.updated_at = Date.now();
  sessions.set(sessionId, current);
  return current;
}

export function updateSessionContext(
  sessionId: string,
  incoming: Partial<SessionContextRecord>
) {
  const current = getOrCreateSession(sessionId);
  current.context = { ...(current.context || {}), ...incoming };
  current.updated_at = Date.now();
  sessions.set(sessionId, current);
  return current;
}

export function setGuidedCollection(sessionId: string, active: boolean) {
  const current = getOrCreateSession(sessionId);
  current.guided_collection_active = active;
  current.updated_at = Date.now();
  sessions.set(sessionId, current);
  return current;
}

export function setPendingQuestionField(
  sessionId: string,
  field: keyof RecommendationInput | undefined
) {
  const current = getOrCreateSession(sessionId);
  current.pending_question_field = field;
  current.updated_at = Date.now();
  sessions.set(sessionId, current);
  return current;
}

export function updateSessionMeta(
  sessionId: string,
  updates: Partial<
    Pick<
      SessionRecord,
      "ready_for_action" | "last_intent" | "conversation_mode" | "pending_user_message" | "pending_action_intent"
    >
  >
) {
  const current = getOrCreateSession(sessionId);
  Object.assign(current, updates);
  current.updated_at = Date.now();
  sessions.set(sessionId, current);
  return current;
}

export function setLastRecommendation(
  sessionId: string,
  lastRecommendation: LastRecommendationRecord | undefined
) {
  const current = getOrCreateSession(sessionId);
  current.last_recommendation = lastRecommendation;
  current.updated_at = Date.now();
  sessions.set(sessionId, current);
  return current;
}
