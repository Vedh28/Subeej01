import argparse
import json
from pathlib import Path


def read_jsonl(path: Path):
    rows = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    return rows


def write_jsonl(path: Path, rows: list[dict]):
    with path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=True) + "\n")


def main():
    parser = argparse.ArgumentParser(description="Combine reasoning and chat-behavior JSONL files.")
    parser.add_argument("--reasoning-train", default="data/training/reasoning_train.jsonl")
    parser.add_argument("--reasoning-eval", default="data/training/reasoning_eval_holdout.jsonl")
    parser.add_argument("--behavior-train", default="data/training/chat_behavior_seed.jsonl")
    parser.add_argument("--out-train", default="data/training/combined_train.jsonl")
    parser.add_argument("--out-eval", default="data/training/combined_eval.jsonl")
    args = parser.parse_args()

    reasoning_train = read_jsonl(Path(args.reasoning_train))
    reasoning_eval = read_jsonl(Path(args.reasoning_eval))
    behavior_train = read_jsonl(Path(args.behavior_train))

    combined_train = behavior_train + reasoning_train
    combined_eval = reasoning_eval[:]

    write_jsonl(Path(args.out_train), combined_train)
    write_jsonl(Path(args.out_eval), combined_eval)

    summary = {
        "behavior_examples": len(behavior_train),
        "reasoning_train_examples": len(reasoning_train),
        "reasoning_eval_examples": len(reasoning_eval),
        "combined_train_examples": len(combined_train),
        "combined_eval_examples": len(combined_eval),
    }
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
