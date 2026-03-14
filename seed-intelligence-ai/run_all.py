import subprocess
import sys
from pathlib import Path


def run_step(label: str, args: list) -> None:
    print(f"\n=== {label} ===")
    result = subprocess.run(args, check=False)
    if result.returncode != 0:
        raise SystemExit(f"Step failed: {label} (exit {result.returncode})")


def main() -> None:
    base = Path(__file__).resolve().parent
    python = sys.executable

    run_step("Build instruction dataset", [python, str(base / "dataset_loader.py")])
    run_step("Build knowledge graph", [python, str(base / "knowledge_graph.py")])
    run_step("Build vector store", [python, str(base / "vector_store.py")])
    run_step("Train LLaMA + Mistral", [python, str(base / "train.py")])

    print("\nAll steps completed. You can now run the chatbot with:")
    print(f"{python} {base / 'agri_chat.py'}")


if __name__ == "__main__":
    main()
