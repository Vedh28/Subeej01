import argparse
from pathlib import Path
from typing import Dict, Tuple

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

from knowledge_graph import load_graph, query_graph_for_seeds
from prompts import COMBINE_PROMPT, STRUCTURED_RESPONSE_FORMAT, SYSTEM_PROMPT
from rag_pipeline import build_context_text, retrieve_context


def infer_context_hints(question: str) -> Tuple[str, str, str]:
    lower = question.lower()
    season = ""
    for cand in ["kharif", "rabi", "zaid"]:
        if cand in lower:
            season = cand.title()
            break

    soil_type = ""
    for soil in ["black soil", "loamy", "sandy", "clayey", "alluvial", "red soil", "sandy loam"]:
        if soil in lower:
            soil_type = soil.title()
            break

    state = ""
    for cand in [
        "andhra pradesh", "arunachal pradesh", "assam", "bihar", "chhattisgarh", "goa",
        "gujarat", "haryana", "himachal pradesh", "jharkhand", "karnataka", "kerala",
        "madhya pradesh", "maharashtra", "manipur", "meghalaya", "mizoram", "nagaland",
        "odisha", "punjab", "rajasthan", "sikkim", "tamil nadu", "telangana", "tripura",
        "uttar pradesh", "uttarakhand", "west bengal"
    ]:
        if cand in lower:
            state = cand.title()
            break

    return soil_type or "Unknown", season or "Unknown", state or "Unknown"


def load_model(model_path: str):
    tokenizer = AutoTokenizer.from_pretrained(model_path, use_fast=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    model = AutoModelForCausalLM.from_pretrained(
        model_path,
        device_map="auto",
        torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
    )
    return model, tokenizer


def generate(model, tokenizer, prompt: str, max_new_tokens: int = 256) -> str:
    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
    with torch.no_grad():
        output = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            do_sample=False,
            temperature=0.2,
        )
    text = tokenizer.decode(output[0], skip_special_tokens=True)
    return text


def build_prompt(question: str, context: str) -> str:
    return (
        f"{SYSTEM_PROMPT}\n\n"
        f"Context:\n{context}\n\n"
        f"Question: {question}\n\n"
        f"{STRUCTURED_RESPONSE_FORMAT}\n"
    )


def combine_outputs(question: str, context: str, mistral_output: str, llama_output: str, model, tokenizer) -> str:
    prompt = (
        f"{COMBINE_PROMPT}\n\n"
        f"Context:\n{context}\n\n"
        f"Question: {question}\n\n"
        f"Mistral Analysis:\n{mistral_output}\n\n"
        f"LLaMA Analysis:\n{llama_output}\n\n"
        f"{STRUCTURED_RESPONSE_FORMAT}\n"
    )
    return generate(model, tokenizer, prompt, max_new_tokens=256)


def chat_loop(args):
    base = Path(__file__).resolve().parent
    llama_path = args.llama_model or str(base / "models" / "llama-agri")
    mistral_path = args.mistral_model or str(base / "models" / "mistral-agri")

    llama_model, llama_tokenizer = load_model(llama_path)
    mistral_model, mistral_tokenizer = load_model(mistral_path)

    print("Subeej Intelligence chat ready. Type 'exit' to quit.")

    while True:
        question = input("\nUser: ").strip()
        if not question:
            continue
        if question.lower() in {"exit", "quit"}:
            break

        soil_type, season, state = infer_context_hints(question)
        context = retrieve_context(question, soil_type, season, state)
        context_text = build_context_text(context)

        mistral_prompt = build_prompt(question, context_text)
        mistral_output = generate(mistral_model, mistral_tokenizer, mistral_prompt, max_new_tokens=200)

        llama_prompt = build_prompt(question, context_text)
        llama_output = generate(llama_model, llama_tokenizer, llama_prompt, max_new_tokens=300)

        final_output = combine_outputs(
            question,
            context_text,
            mistral_output,
            llama_output,
            llama_model,
            llama_tokenizer
        )

        print(f"\nAssistant:\n{final_output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--llama-model", default="")
    parser.add_argument("--mistral-model", default="")
    args = parser.parse_args()

    chat_loop(args)
