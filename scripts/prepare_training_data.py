import argparse
import csv
import json
import os
import random
from pathlib import Path


def normalize(value: str) -> str:
    return (value or "").strip()


def to_float(value: str):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def build_user_context(row: dict) -> str:
    return (
        f"Location: {normalize(row.get('district'))}, {normalize(row.get('state'))}\n"
        f"Season: {normalize(row.get('season'))}\n"
        f"Soil: {normalize(row.get('soil_type'))} (pH {normalize(row.get('soil_ph'))})\n"
        f"Field composition: {normalize(row.get('field_composition'))}\n"
        f"Field quality: {normalize(row.get('field_quality'))}\n"
        f"Field history: {normalize(row.get('field_history'))}\n"
        f"Weather: temp {normalize(row.get('temperature'))} C, humidity {normalize(row.get('humidity'))}%, rainfall {normalize(row.get('rainfall'))} mm\n"
        f"Moisture: {normalize(row.get('moisture'))}%\n"
        f"Current crop: {normalize(row.get('crop'))}\n"
        f"Seed in use: {normalize(row.get('seed_name'))}, variety {normalize(row.get('seed_variety'))}, type {normalize(row.get('seed_type'))}, quality {normalize(row.get('seed_quality'))}\n"
        f"Area: {normalize(row.get('area'))} ha, Production: {normalize(row.get('production'))}, Yield: {normalize(row.get('yield'))}"
    )


def build_fast_record(row: dict) -> dict:
    instruction = (
        "Give a quick agronomy recommendation. Keep the answer short and actionable "
        "(3 to 6 bullet points)."
    )
    user_input = build_user_context(row)
    output = (
        f"Recommended crop: {normalize(row.get('recommended_crop'))}\n"
        f"Recommended seed: {normalize(row.get('recommended_seed'))}\n"
        f"Primary season fit: {normalize(row.get('season'))}\n"
        f"Use field quality ({normalize(row.get('field_quality'))}) and moisture ({normalize(row.get('moisture'))}%) "
        "to calibrate irrigation and nutrient scheduling."
    )
    return {"instruction": instruction, "input": user_input, "output": output}


def build_reasoning_record(row: dict) -> dict:
    instruction = (
        "Perform agronomic reasoning and provide a detailed recommendation with rationale, "
        "risks, and next actions."
    )
    user_input = build_user_context(row)

    soil_ph = to_float(row.get("soil_ph"))
    ph_note = "Soil pH appears acceptable for most staple crops."
    if soil_ph is not None and (soil_ph < 6.0 or soil_ph > 7.8):
        ph_note = "Soil pH is outside the usual comfort zone; include pH correction planning."

    output = (
        f"Decision: prioritize {normalize(row.get('recommended_crop'))} with seed {normalize(row.get('recommended_seed'))}.\n"
        f"Reasoning: seasonal alignment ({normalize(row.get('season'))}), soil profile ({normalize(row.get('soil_type'))}), "
        f"field composition ({normalize(row.get('field_composition'))}), and field history ({normalize(row.get('field_history'))}) "
        "support this choice.\n"
        f"Quality/seed check: current seed quality is {normalize(row.get('seed_quality'))}; verify germination before sowing.\n"
        f"Soil note: {ph_note}\n"
        "Risk controls: monitor rainfall variability and moisture stress, and adjust irrigation/fertilizer timing weekly.\n"
        "Next actions: soil test confirmation, seed treatment, sowing-window confirmation, and 14-day follow-up based on weather."
    )
    return {"instruction": instruction, "input": user_input, "output": output}


def write_jsonl(path: Path, rows: list[dict]):
    with path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=True) + "\n")


def main():
    parser = argparse.ArgumentParser(description="Prepare fast/reasoning training JSONL from CSV.")
    parser.add_argument("--input", required=True, help="Path to source CSV")
    parser.add_argument(
        "--out-dir",
        default="data/training",
        help="Output directory (default: data/training)",
    )
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument("--holdout-ratio", type=float, default=0.1, help="Eval holdout ratio")
    args = parser.parse_args()

    in_path = Path(args.input)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    with in_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        source_rows = [r for r in reader]

    random.seed(args.seed)
    random.shuffle(source_rows)

    holdout_size = int(len(source_rows) * args.holdout_ratio)
    holdout_rows = source_rows[:holdout_size]
    train_rows = source_rows[holdout_size:]

    fast_train = [build_fast_record(r) for r in train_rows]
    reasoning_train = [build_reasoning_record(r) for r in train_rows]
    eval_set = [build_reasoning_record(r) for r in holdout_rows]

    write_jsonl(out_dir / "fast_analysis_train.jsonl", fast_train)
    write_jsonl(out_dir / "reasoning_train.jsonl", reasoning_train)
    write_jsonl(out_dir / "reasoning_eval_holdout.jsonl", eval_set)

    summary = {
        "source_rows": len(source_rows),
        "train_rows": len(train_rows),
        "holdout_rows": len(holdout_rows),
        "outputs": {
            "fast_analysis_train.jsonl": len(fast_train),
            "reasoning_train.jsonl": len(reasoning_train),
            "reasoning_eval_holdout.jsonl": len(eval_set),
        },
    }

    with (out_dir / "dataset_prep_summary.json").open("w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
