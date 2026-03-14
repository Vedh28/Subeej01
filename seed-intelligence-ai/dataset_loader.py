import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple

import pandas as pd

NUMERIC_COLUMNS = [
    "soil_ph",
    "temperature",
    "humidity",
    "rainfall",
    "moisture",
    "area",
    "production",
    "yield",
]

@dataclass
class NormalizationStats:
    min_values: Dict[str, float]
    max_values: Dict[str, float]


def load_dataset(csv_path: str) -> pd.DataFrame:
    df = pd.read_csv(csv_path)
    return df


def clean_dataset(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    # Normalize column names
    df.columns = [c.strip() for c in df.columns]

    # Ensure expected columns exist
    for col in NUMERIC_COLUMNS:
        if col not in df.columns:
            df[col] = pd.NA

    # Coerce numeric columns
    for col in NUMERIC_COLUMNS:
        df[col] = pd.to_numeric(df[col], errors="coerce")
        if df[col].isna().all():
            df[col] = 0.0
        else:
            df[col] = df[col].fillna(df[col].median())

    # Fill missing categorical/text fields
    for col in df.columns:
        if col in NUMERIC_COLUMNS:
            continue
        df[col] = df[col].fillna("Unknown").astype(str).str.strip()

    return df


def normalize_numeric_fields(df: pd.DataFrame) -> Tuple[pd.DataFrame, NormalizationStats]:
    df = df.copy()
    min_values: Dict[str, float] = {}
    max_values: Dict[str, float] = {}

    for col in NUMERIC_COLUMNS:
        min_val = float(df[col].min())
        max_val = float(df[col].max())
        min_values[col] = min_val
        max_values[col] = max_val

        if max_val == min_val:
            df[col] = 0.0
        else:
            df[col] = (df[col] - min_val) / (max_val - min_val)

    return df, NormalizationStats(min_values=min_values, max_values=max_values)


def row_to_instruction_response(row: pd.Series) -> Dict[str, str]:
    instruction = (
        "You are an expert agricultural advisor.\n\n"
        "Analyze the following seed and field information.\n\n"
        f"Seed Name: {row['seed_name']}\n"
        f"Seed Variety: {row['seed_variety']}\n"
        f"Seed Type: {row['seed_type']}\n"
        f"Seed Quality: {row['seed_quality']}\n\n"
        f"Crop: {row['crop']}\n"
        f"Season: {row['season']}\n\n"
        f"Soil Type: {row['soil_type']}\n"
        f"Field Composition: {row['field_composition']}\n"
        f"Soil pH: {row['soil_ph']}\n\n"
        f"Temperature: {row['temperature']}\n"
        f"Humidity: {row['humidity']}\n"
        f"Rainfall: {row['rainfall']}\n"
        f"Moisture: {row['moisture']}\n\n"
        f"Field Quality: {row['field_quality']}\n"
        f"Field History: {row['field_history']}\n\n"
        f"Location: {row['district']}, {row['state']}\n\n"
        "Question:\n\n"
        "Is this seed suitable for this field?"
    )

    decision = "Suitable" if str(row.get("recommended_seed", "")).strip() else "Not Suitable"

    response = (
        f"Recommended Crop: {row['recommended_crop']}\n"
        f"Recommended Seed: {row['recommended_seed']}\n"
        f"Expected Yield: {row['yield']}\n"
        f"Production Estimate: {row['production']}\n"
        f"Area: {row['area']}\n\n"
        f"Decision: {decision}\n\n"
        "Reason: Explain based on soil type, weather, season, and field history."
    )

    return {"instruction": instruction, "response": response}


def build_instruction_dataset(
    csv_path: str,
    output_path: str,
    normalize: bool = True,
    stats_path: str = "",
) -> List[Dict[str, str]]:
    df = load_dataset(csv_path)
    df = clean_dataset(df)

    if normalize:
        df, stats = normalize_numeric_fields(df)
        if stats_path:
            Path(stats_path).write_text(json.dumps({
                "min": stats.min_values,
                "max": stats.max_values
            }, indent=2))

    records = [row_to_instruction_response(row) for _, row in df.iterrows()]

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8") as f:
        for record in records:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

    return records


if __name__ == "__main__":
    base = Path(__file__).resolve().parent
    csv_path = base / "data" / "dataset.csv"
    output_path = base / "data" / "processed" / "instruction_data.jsonl"
    stats_path = base / "data" / "processed" / "normalization_stats.json"
    build_instruction_dataset(str(csv_path), str(output_path), normalize=True, stats_path=str(stats_path))
    print(f"Saved instruction data to {output_path}")
