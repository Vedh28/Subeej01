import argparse
import json
import random
import re
from pathlib import Path


AGRI_TERMS = [
    "crop",
    "seed",
    "soil",
    "season",
    "field",
    "rainfall",
    "temperature",
    "humidity",
    "moisture",
    "yield",
    "sowing",
    "agronomy",
    "irrigation",
    "farmer",
]

BANNED_TERMS = [
    "college",
    "bca",
    "12th grade",
    "student of",
    "multi-choice",
    "multiple-choice",
    "choose your answer",
    "same information",
    "question pair",
    "premise",
    "hypothesis",
    "translation",
    "mathematics",
    "physics",
    "chemistry",
    "history exam",
]


def read_jsonl(path: Path) -> list[dict]:
    rows: list[dict] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def write_jsonl(path: Path, rows: list[dict]) -> None:
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=True) + "\n")


def is_agriculture_only(row: dict) -> bool:
    text = " ".join(str(row.get(key, "")) for key in ("instruction", "input", "output")).lower()
    if any(term in text for term in BANNED_TERMS):
        return False
    return any(term in text for term in AGRI_TERMS)


def parse_context(raw_input: str) -> dict[str, str]:
    context: dict[str, str] = {}
    for line in raw_input.splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        context[key.strip().lower()] = value.strip()
    return context


def normalize_reasoning_record(row: dict) -> dict:
    context = parse_context(str(row.get("input", "")))
    location = context.get("location", "the field")
    season = context.get("season", "the current season")
    soil = context.get("soil", "the current soil")
    field_composition = context.get("field composition", "the current field condition")
    field_history = context.get("field history", "the recent crop history")
    weather = context.get("weather", "the current weather")
    current_crop = context.get("current crop", "the crop under review")

    output = str(row.get("output", ""))
    crop_match = re.search(r"prioritize\s+([A-Za-z ]+?)\s+with seed\s+([A-Za-z0-9\- ]+)", output, re.I)
    recommended_crop = crop_match.group(1).strip() if crop_match else current_crop
    recommended_seed = crop_match.group(2).strip() if crop_match else "the recommended seed"

    clean_instruction = (
        "Act as Subeej AI. Review the agriculture field context and answer in a concise, "
        "natural, business-friendly way. Stay agriculture-only and do not output unrelated tasks."
    )
    clean_input = (
        f"Field context:\n"
        f"- Location: {location}\n"
        f"- Season: {season}\n"
        f"- Soil: {soil}\n"
        f"- Field composition: {field_composition}\n"
        f"- Field history: {field_history}\n"
        f"- Weather: {weather}\n"
        f"- Crop under review: {current_crop}\n\n"
        "User: Based on my field conditions, what crop or seed looks most suitable?"
    )
    clean_output = (
        f"Based on {season} conditions in {location}, {recommended_crop} with {recommended_seed} looks like the strongest fit. "
        f"It aligns with the soil profile ({soil}), field condition ({field_composition}), and recent crop history ({field_history}). "
        "Monitor moisture and weather closely before sowing."
    )

    return {
        "instruction": clean_instruction,
        "input": clean_input,
        "output": clean_output,
    }


def dedupe_rows(rows: list[dict]) -> list[dict]:
    seen: set[tuple[str, str, str]] = set()
    deduped: list[dict] = []
    for row in rows:
        key = (
            str(row.get("instruction", "")),
            str(row.get("input", "")),
            str(row.get("output", "")),
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(row)
    return deduped


def main() -> None:
    parser = argparse.ArgumentParser(description="Build a clean agriculture-only fine-tuning dataset.")
    parser.add_argument("--reasoning-train", default="data/training/reasoning_train.jsonl")
    parser.add_argument("--reasoning-eval", default="data/training/reasoning_eval_holdout.jsonl")
    parser.add_argument("--behavior-train", default="data/training/chat_behavior_seed.jsonl")
    parser.add_argument("--out-train", default="data/training/clean_agri_train.jsonl")
    parser.add_argument("--out-eval", default="data/training/clean_agri_eval.jsonl")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--max-reasoning-train", type=int, default=4000)
    parser.add_argument("--max-reasoning-eval", type=int, default=400)
    args = parser.parse_args()

    behavior_rows = [row for row in read_jsonl(Path(args.behavior_train)) if is_agriculture_only(row)]
    reasoning_train_rows = [normalize_reasoning_record(row) for row in read_jsonl(Path(args.reasoning_train)) if is_agriculture_only(row)]
    reasoning_eval_rows = [normalize_reasoning_record(row) for row in read_jsonl(Path(args.reasoning_eval)) if is_agriculture_only(row)]

    rng = random.Random(args.seed)
    rng.shuffle(reasoning_train_rows)
    rng.shuffle(reasoning_eval_rows)

    trimmed_reasoning_train = reasoning_train_rows[: args.max_reasoning_train]
    trimmed_reasoning_eval = reasoning_eval_rows[: args.max_reasoning_eval]

    clean_train = dedupe_rows(behavior_rows + trimmed_reasoning_train)
    clean_eval = dedupe_rows(trimmed_reasoning_eval)

    write_jsonl(Path(args.out_train), clean_train)
    write_jsonl(Path(args.out_eval), clean_eval)

    summary = {
        "behavior_examples_kept": len(behavior_rows),
        "reasoning_train_examples_kept": len(trimmed_reasoning_train),
        "reasoning_eval_examples_kept": len(trimmed_reasoning_eval),
        "clean_train_examples": len(clean_train),
        "clean_eval_examples": len(clean_eval),
        "out_train": args.out_train,
        "out_eval": args.out_eval,
    }
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
