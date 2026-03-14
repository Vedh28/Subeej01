import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path


def resolve_model_source(model_name: str) -> str:
    try:
        from huggingface_hub import snapshot_download
    except ModuleNotFoundError:
        return model_name

    token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_HUB_TOKEN")

    try:
        return snapshot_download(
            repo_id=model_name,
            local_files_only=True,
        )
    except Exception:
        return snapshot_download(
            repo_id=model_name,
            token=token,
        )

def find_convert_script(llama_cpp_dir: Path) -> Path:
    candidates = [
        llama_cpp_dir / "convert_hf_to_gguf.py",
        llama_cpp_dir / "scripts" / "convert_hf_to_gguf.py",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    raise FileNotFoundError("convert_hf_to_gguf.py not found in llama.cpp directory.")


def find_quantize_binary(llama_cpp_dir: Path) -> Path | None:
    candidates = [
        llama_cpp_dir / "build" / "bin" / "llama-quantize.exe",
        llama_cpp_dir / "build" / "bin" / "llama-quantize",
        llama_cpp_dir / "llama-quantize.exe",
        llama_cpp_dir / "llama-quantize",
        llama_cpp_dir / "quantize.exe",
        llama_cpp_dir / "quantize",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None


def run(cmd: list[str]) -> None:
    print("Running:", " ".join(cmd))
    subprocess.run(cmd, check=True)


def write_modelfile(modelfile_path: Path, gguf_path: Path, system_prompt: str) -> None:
    content = (
        f"FROM {gguf_path.name}\n"
        f"SYSTEM {system_prompt}\n"
        "PARAMETER temperature 0.2\n"
        "PARAMETER num_ctx 4096\n"
    )
    modelfile_path.write_text(content, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Merge LoRA adapter, export GGUF, and create Ollama Modelfile."
    )
    parser.add_argument(
        "--base-model",
        default="Qwen/Qwen2.5-1.5B-Instruct",
        help="Base HF model used during training",
    )
    parser.add_argument("--adapter-dir", required=True, help="Directory with trained LoRA adapter")
    parser.add_argument("--merged-dir", default="outputs/subeej-qwen-1_5b-merged")
    parser.add_argument("--llama-cpp-dir", required=True, help="Path to local llama.cpp")
    parser.add_argument("--gguf-out", default="outputs/subeej-qwen-1_5b-reasoner-f16.gguf")
    parser.add_argument(
        "--quantize",
        action="store_true",
        help="Quantize to Q4_K_M when llama-quantize exists",
    )
    parser.add_argument("--quant-out", default="outputs/subeej-qwen-1_5b-reasoner-q4_k_m.gguf")
    parser.add_argument("--ollama-name", default="subeej-reasoner")
    parser.add_argument(
        "--system-prompt",
        default=(
            "You are Subeej Reasoning AI. Give practical agronomy decisions grounded in field inputs."
        ),
    )
    args = parser.parse_args()

    adapter_dir = Path(args.adapter_dir).resolve()
    merged_dir = Path(args.merged_dir).resolve()
    llama_cpp_dir = Path(args.llama_cpp_dir).resolve()
    gguf_out = Path(args.gguf_out).resolve()
    quant_out = Path(args.quant_out).resolve()

    merged_dir.mkdir(parents=True, exist_ok=True)
    gguf_out.parent.mkdir(parents=True, exist_ok=True)
    quant_out.parent.mkdir(parents=True, exist_ok=True)

    try:
        import torch
        from peft import PeftModel
        from transformers import AutoModelForCausalLM, AutoTokenizer
    except ModuleNotFoundError as exc:
        missing = str(exc).split("'")[1] if "'" in str(exc) else str(exc)
        raise SystemExit(
            f"Missing dependency: {missing}. Install with: "
            "python -m pip install -r scripts\\requirements-train.txt"
        ) from exc

    dtype = torch.float16 if torch.cuda.is_available() else torch.float32

    model_source = resolve_model_source(args.base_model)

    print("Loading base model...")
    base_model = AutoModelForCausalLM.from_pretrained(
        model_source,
        torch_dtype=dtype,
        device_map="auto",
        trust_remote_code=True,
    )
    tokenizer = AutoTokenizer.from_pretrained(model_source, use_fast=True, trust_remote_code=True)

    print("Loading adapter...")
    peft_model = PeftModel.from_pretrained(base_model, str(adapter_dir))

    print("Merging adapter into base model...")
    merged_model = peft_model.merge_and_unload()
    merged_model.save_pretrained(str(merged_dir), safe_serialization=True, max_shard_size="2GB")
    tokenizer.save_pretrained(str(merged_dir))

    convert_script = find_convert_script(llama_cpp_dir)
    run(
        [
            sys.executable,
            str(convert_script),
            str(merged_dir),
            "--outfile",
            str(gguf_out),
            "--outtype",
            "f16",
        ]
    )

    final_gguf = gguf_out
    if args.quantize:
        quant_bin = find_quantize_binary(llama_cpp_dir)
        if quant_bin is None:
            raise FileNotFoundError("Quantize binary not found in llama.cpp build outputs.")
        run([str(quant_bin), str(gguf_out), str(quant_out), "Q4_K_M"])
        final_gguf = quant_out

    modelfile_dir = final_gguf.parent
    modelfile_path = modelfile_dir / "Modelfile.reasoner"
    write_modelfile(modelfile_path, final_gguf, args.system_prompt)

    # Keep GGUF in same directory as Modelfile for simple ollama create command.
    colocated_gguf = modelfile_dir / final_gguf.name
    if final_gguf != colocated_gguf:
        shutil.copy2(final_gguf, colocated_gguf)

    print("\nExport complete.")
    print(f"Merged model: {merged_dir}")
    print(f"GGUF model: {final_gguf}")
    print(f"Modelfile: {modelfile_path}")
    print("\nRun these commands:")
    print(f"cd {modelfile_dir}")
    print(f"ollama create {args.ollama_name} -f {modelfile_path.name}")
    print(f"ollama run {args.ollama_name}")


if __name__ == "__main__":
    main()
