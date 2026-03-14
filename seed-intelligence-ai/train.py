import json
import os
import multiprocessing as mp
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

import torch
from datasets import load_dataset
from peft import LoraConfig, PeftModel, get_peft_model, prepare_model_for_kbit_training
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    DataCollatorForLanguageModeling,
    Trainer,
    TrainingArguments,
)

from dataset_loader import build_instruction_dataset


@dataclass
class ModelTrainConfig:
    name: str
    base_model: str
    output_dir: Path
    max_length: int = 1024
    per_device_train_batch_size: int = 1
    gradient_accumulation_steps: int = 8
    learning_rate: float = 2e-4
    num_train_epochs: int = 3
    save_steps: int = 200
    logging_steps: int = 50


def build_prompt(sample: Dict[str, str]) -> str:
    return (
        "### Instruction\n"
        f"{sample['instruction']}\n\n"
        "### Response\n"
        f"{sample['response']}\n"
    )


def prepare_dataset(jsonl_path: str, tokenizer, max_length: int):
    dataset = load_dataset("json", data_files=jsonl_path)["train"]

    def tokenize_fn(example):
        text = build_prompt(example)
        tokens = tokenizer(
            text,
            max_length=max_length,
            truncation=True,
            padding="max_length",
        )
        tokens["labels"] = tokens["input_ids"].copy()
        return tokens

    return dataset.map(tokenize_fn, remove_columns=dataset.column_names)


def find_latest_checkpoint(output_dir: Path) -> Optional[str]:
    if not output_dir.exists():
        return None
    checkpoints = sorted(output_dir.glob("checkpoint-*"), key=lambda p: p.stat().st_mtime)
    if not checkpoints:
        return None
    return str(checkpoints[-1])


def train_model(config: ModelTrainConfig, dataset_path: str, quick: bool = False, quick_samples: int = 500) -> None:
    hf_token = os.environ.get("HUGGINGFACE_HUB_TOKEN") or os.environ.get("HF_TOKEN")
    tokenizer = AutoTokenizer.from_pretrained(config.base_model, use_fast=True, token=hf_token)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    use_cuda = torch.cuda.is_available()
    quant_config = None
    if use_cuda:
        quant_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_use_double_quant=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.bfloat16 if torch.cuda.is_available() else torch.float16,
        )

    model = AutoModelForCausalLM.from_pretrained(
        config.base_model,
        quantization_config=quant_config,
        device_map="auto" if use_cuda else "cpu",
        trust_remote_code=True,
        torch_dtype=torch.bfloat16 if use_cuda and torch.cuda.is_bf16_supported() else torch.float32,
        low_cpu_mem_usage=not use_cuda,
        token=hf_token,
    )

    if use_cuda:
        model = prepare_model_for_kbit_training(model)

    lora = LoraConfig(
        r=16,
        lora_alpha=32,
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
    )
    model = get_peft_model(model, lora)

    train_dataset = prepare_dataset(dataset_path, tokenizer, config.max_length)
    if quick and len(train_dataset) > quick_samples:
        train_dataset = train_dataset.select(range(quick_samples))

    bf16 = torch.cuda.is_available() and torch.cuda.is_bf16_supported()
    fp16 = torch.cuda.is_available() and not bf16

    training_args = TrainingArguments(
        output_dir=str(config.output_dir),
        per_device_train_batch_size=config.per_device_train_batch_size,
        gradient_accumulation_steps=config.gradient_accumulation_steps,
        learning_rate=config.learning_rate,
        num_train_epochs=config.num_train_epochs,
        max_steps=200 if quick else -1,
        logging_steps=config.logging_steps,
        save_steps=config.save_steps,
        save_total_limit=3,
        fp16=fp16,
        bf16=bf16,
        optim="paged_adamw_8bit" if use_cuda else "adamw_torch",
        report_to="none",
        remove_unused_columns=False,
        gradient_checkpointing=True,
    )

    data_collator = DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False)

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        data_collator=data_collator,
    )

    latest_checkpoint = find_latest_checkpoint(config.output_dir)
    trainer.train(resume_from_checkpoint=latest_checkpoint)

    model.save_pretrained(str(config.output_dir))
    tokenizer.save_pretrained(str(config.output_dir))

def train_model_worker(config_dict: Dict, dataset_path: str, cuda_devices: str, quick: bool, quick_samples: int) -> None:
    if cuda_devices:
        os.environ["CUDA_VISIBLE_DEVICES"] = cuda_devices
    config = ModelTrainConfig(**config_dict)
    train_model(config, dataset_path, quick=quick, quick_samples=quick_samples)


def main() -> None:
    base = Path(__file__).resolve().parent
    data_path = base / "data" / "dataset.csv"
    processed_path = base / "data" / "processed" / "instruction_data.jsonl"
    stats_path = base / "data" / "processed" / "normalization_stats.json"

    build_instruction_dataset(
        csv_path=str(data_path),
        output_path=str(processed_path),
        normalize=True,
        stats_path=str(stats_path),
    )

    llama_model = os.environ.get("LLAMA_BASE_MODEL", "meta-llama/Meta-Llama-3-8B")
    mistral_model = os.environ.get("MISTRAL_BASE_MODEL", "mistralai/Mistral-7B-v0.1")

    quick = os.environ.get("QUICK_TRAIN", "false").lower() == "true"
    quick_samples = int(os.environ.get("QUICK_SAMPLES", "500"))
    quick_max_length = int(os.environ.get("QUICK_MAX_LENGTH", "256"))
    quick_epochs = float(os.environ.get("QUICK_EPOCHS", "1"))

    llama_config = ModelTrainConfig(
        name="llama",
        base_model=llama_model,
        output_dir=base / "models" / "llama-agri",
        max_length=quick_max_length if quick else 1024,
        num_train_epochs=quick_epochs if quick else 3,
    )

    mistral_config = ModelTrainConfig(
        name="mistral",
        base_model=mistral_model,
        output_dir=base / "models" / "mistral-agri",
        max_length=quick_max_length if quick else 1024,
        num_train_epochs=quick_epochs if quick else 3,
    )

    parallel = os.environ.get("PARALLEL_TRAIN", "false").lower() == "true"
    if parallel:
        llama_cuda = os.environ.get("LLAMA_CUDA_DEVICES", "")
        mistral_cuda = os.environ.get("MISTRAL_CUDA_DEVICES", "")

        llama_proc = mp.Process(
            target=train_model_worker,
            args=(llama_config.__dict__, str(processed_path), llama_cuda, quick, quick_samples)
        )
        mistral_proc = mp.Process(
            target=train_model_worker,
            args=(mistral_config.__dict__, str(processed_path), mistral_cuda, quick, quick_samples)
        )

        print("Training LLaMA and Mistral in parallel...")
        llama_proc.start()
        mistral_proc.start()
        llama_proc.join()
        mistral_proc.join()
    else:
        print("Training LLaMA model...")
        train_model(llama_config, str(processed_path), quick=quick, quick_samples=quick_samples)

        print("Training Mistral model...")
        train_model(mistral_config, str(processed_path), quick=quick, quick_samples=quick_samples)

    print("Training completed for both models.")


if __name__ == "__main__":
    main()
