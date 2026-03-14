import { readFile } from "node:fs/promises";
import path from "node:path";
import { DatasetRow } from "./types";

let cachedRows: DatasetRow[] | null = null;
let cachedPath = "";

function norm(value: unknown) {
  return String(value ?? "").trim();
}

function normNum(value: unknown) {
  const parsed = Number.parseFloat(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      cell = "";
      if (row.some((part) => part.length > 0)) rows.push(row);
      row = [];
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some((part) => part.length > 0)) rows.push(row);
  }

  return rows;
}

function resolveDatasetPath() {
  const configured = process.env.DATASET_CSV_PATH;
  const candidates = [
    configured,
    path.join(process.cwd(), "data", "source", "agriculture_seed_land_dataset_10000_rows_with_field_composition.csv"),
    "C:\\Users\\vedhp\\Downloads\\agriculture_seed_land_dataset_10000_rows_with_field_composition.csv"
  ].filter(Boolean) as string[];

  return candidates[0] ? candidates : [];
}

async function readFirstAvailable(paths: string[]) {
  for (const p of paths) {
    try {
      const content = await readFile(p, "utf-8");
      return { content, path: p };
    } catch {
      // Try next path
    }
  }
  return null;
}

export async function loadDatasetRows() {
  const candidates = resolveDatasetPath();
  const file = await readFirstAvailable(candidates);

  if (!file) {
    throw new Error(
      "Dataset CSV not found. Set DATASET_CSV_PATH or place CSV in data/source/ directory."
    );
  }

  if (cachedRows && cachedPath === file.path) {
    return cachedRows;
  }

  const matrix = parseCsv(file.content);
  if (!matrix.length) {
    throw new Error(`Dataset CSV at ${file.path} is empty.`);
  }

  const header = matrix[0].map((h) => h.trim());
  const rows = matrix.slice(1);

  const index = (name: string) => header.findIndex((h) => h === name);

  const parsed: DatasetRow[] = rows.map((line, idx) => ({
    row_id: idx + 1,
    seed_name: norm(line[index("seed_name")]),
    seed_variety: norm(line[index("seed_variety")]),
    seed_type: norm(line[index("seed_type")]),
    seed_quality: norm(line[index("seed_quality")]),
    crop: norm(line[index("crop")]),
    season: norm(line[index("season")]),
    soil_type: norm(line[index("soil_type")]),
    field_composition: norm(line[index("field_composition")]),
    soil_ph: normNum(line[index("soil_ph")]),
    temperature: normNum(line[index("temperature")]),
    humidity: normNum(line[index("humidity")]),
    rainfall: normNum(line[index("rainfall")]),
    moisture: normNum(line[index("moisture")]),
    field_quality: norm(line[index("field_quality")]),
    field_history: norm(line[index("field_history")]),
    state: norm(line[index("state")]),
    district: norm(line[index("district")]),
    recommended_crop: norm(line[index("recommended_crop")]),
    recommended_seed: norm(line[index("recommended_seed")]),
    area: normNum(line[index("area")]),
    production: normNum(line[index("production")]),
    yield: normNum(line[index("yield")])
  }));

  cachedRows = parsed;
  cachedPath = file.path;
  return parsed;
}
