import argparse
import json
import os
from typing import Any

def format_example(example: dict[str, Any]) -> str:
    instruction = (example.get("instruction") or "").strip()
    user_input = (example.get("input") or "").strip()
    output = (example.get("output") or "").strip()

    return (
        "### Instruction\n"
        f"{instruction}\n\n"
        "### Input\n"
        f"{user_input}\n\n"
        "### Response\n"
        f"{output}"
    )


def detect_dtype(torch_module):
    if torch_module.cuda.is_available():
        if torch_module.cuda.is_bf16_supported():
            return torch_module.bfloat16
        return torch_module.float16
    return torch_module.float32


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


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Train Mistral LoRA on JSONL data.")
    parser.add_argument(
        "--base-model",
        default="mistralai/Mistral-7B-Instruct-v0.2",
        help="HF model id to fine-tune",
    )
    parser.add_argument("--train-file", required=True, help="Path to train JSONL")
    parser.add_argument("--eval-file", default="", help="Path to eval JSONL")
    parser.add_argument("--output-dir", default="outputs/subeej-mistral-lora")
    parser.add_argument("--max-seq-length", type=int, default=1024)
    parser.add_argument("--epochs", type=float, default=2.0)
    parser.add_argument("--learning-rate", type=float, default=2e-4)
    parser.add_argument("--batch-size", type=int, default=1)
    parser.add_argument("--grad-accum", type=int, default=8)
    parser.add_argument("--warmup-ratio", type=float, default=0.03)
    parser.add_argument("--weight-decay", type=float, default=0.01)
    parser.add_argument("--logging-steps", type=int, default=10)
    parser.add_argument("--save-steps", type=int, default=200)
    parser.add_argument("--eval-steps", type=int, default=200)
    parser.add_argument("--lora-r", type=int, default=16)
    parser.add_argument("--lora-alpha", type=int, default=32)
    parser.add_argument("--lora-dropout", type=float, default=0.05)
    parser.add_argument(
        "--use-4bit",
        action="store_true",
        help="Enable QLoRA-style 4-bit loading (GPU recommended)",
    )
    parser.add_argument(
        "--gradient-checkpointing",
        action="store_true",
        help="Enable gradient checkpointing to reduce memory use",
    )
    parser.add_argument(
        "--cpu-offload",
        action="store_true",
        help="Allow quantized modules to offload to CPU when VRAM is limited",
    )
    parser.add_argument(
        "--max-memory-gpu",
        default="3GiB",
        help="Per-GPU memory cap passed to transformers device_map logic",
    )
    parser.add_argument(
        "--max-memory-cpu",
        default="24GiB",
        help="CPU RAM cap passed to transformers device_map logic",
    )
    parser.add_argument(
        "--trust-remote-code",
        action="store_true",
        help="Enable trust_remote_code for models that require custom modeling code",
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()
    os.makedirs(args.output_dir, exist_ok=True)

    try:
        import torch
        from datasets import load_dataset
        from peft import LoraConfig
        from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
        from trl import SFTConfig, SFTTrainer
    except ModuleNotFoundError as exc:
        missing = str(exc).split("'")[1] if "'" in str(exc) else str(exc)
        raise SystemExit(
            f"Missing dependency: {missing}. Install with: "
            "python -m pip install -r scripts\\requirements-train.txt"
        ) from exc

    dtype = detect_dtype(torch)

    model_source = resolve_model_source(args.base_model)

    tokenizer = AutoTokenizer.from_pretrained(
        model_source,
        use_fast=True,
        trust_remote_code=args.trust_remote_code,
    )
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    quantization_config = None
    if args.use_4bit:
        quantization_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_use_double_quant=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=dtype if dtype != torch.float32 else torch.float16,
            llm_int8_enable_fp32_cpu_offload=args.cpu_offload,
        )

    max_memory = None
    if torch.cuda.is_available():
        max_memory = {0: args.max_memory_gpu, "cpu": args.max_memory_cpu}

    model = AutoModelForCausalLM.from_pretrained(
        model_source,
        torch_dtype=dtype if not args.use_4bit else None,
        quantization_config=quantization_config,
        device_map="auto",
        max_memory=max_memory,
        trust_remote_code=args.trust_remote_code,
    )
    model.config.use_cache = False

    train_ds = load_dataset("json", data_files=args.train_file, split="train")
    train_ds = train_ds.map(lambda e: {"text": format_example(e)})

    eval_ds = None
    if args.eval_file:
        eval_ds = load_dataset("json", data_files=args.eval_file, split="train")
        eval_ds = eval_ds.map(lambda e: {"text": format_example(e)})

    peft_config = LoraConfig(
        r=args.lora_r,
        lora_alpha=args.lora_alpha,
        lora_dropout=args.lora_dropout,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=[
            "q_proj",
            "k_proj",
            "v_proj",
            "o_proj",
            "gate_proj",
            "up_proj",
            "down_proj",
        ],
    )

    train_args = SFTConfig(
        **{
            "output_dir": args.output_dir,
            "num_train_epochs": args.epochs,
            "per_device_train_batch_size": args.batch_size,
            "gradient_accumulation_steps": args.grad_accum,
            "learning_rate": args.learning_rate,
            "warmup_ratio": args.warmup_ratio,
            "weight_decay": args.weight_decay,
            "logging_steps": args.logging_steps,
            "save_steps": args.save_steps,
            "eval_steps": args.eval_steps if eval_ds is not None else None,
            "save_strategy": "steps",
            "lr_scheduler_type": "cosine",
            "bf16": (dtype == torch.bfloat16),
            "fp16": (dtype == torch.float16),
            "gradient_checkpointing": args.gradient_checkpointing,
            "report_to": "none",
            "optim": "paged_adamw_32bit" if args.use_4bit else "adamw_torch",
            "eval_strategy": "steps" if eval_ds is not None else "no",
            "dataset_text_field": "text",
            "max_length": args.max_seq_length,
            "packing": False,
        }
    )

    trainer = SFTTrainer(
        model=model,
        args=train_args,
        train_dataset=train_ds,
        eval_dataset=eval_ds,
        peft_config=peft_config,
        processing_class=tokenizer,
    )

    trainer.train()
    trainer.model.save_pretrained(args.output_dir)
    tokenizer.save_pretrained(args.output_dir)

    metadata = {
        "base_model": args.base_model,
        "resolved_model_source": model_source,
        "train_file": args.train_file,
        "eval_file": args.eval_file,
        "output_dir": args.output_dir,
        "dtype": str(dtype),
        "use_4bit": args.use_4bit,
    }
    with open(os.path.join(args.output_dir, "training_run_config.json"), "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    print("Training completed.")
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
