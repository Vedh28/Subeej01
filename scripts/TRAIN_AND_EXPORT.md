# Run Training And Export

## 1) Install Python deps

```powershell
python -m pip install -r scripts\requirements-train.txt
```

## 2) Train LoRA adapter (Mistral)

```powershell
python scripts\train_mistral_lora.py `
  --base-model mistralai/Mistral-7B-Instruct-v0.2 `
  --train-file data\training\reasoning_train.jsonl `
  --eval-file data\training\reasoning_eval_holdout.jsonl `
  --output-dir outputs\subeej-mistral-lora `
  --use-4bit `
  --gradient-checkpointing `
  --epochs 2 `
  --batch-size 1 `
  --grad-accum 8
```

## 3) Merge + export GGUF + Modelfile for Ollama

`llama.cpp` should be built already and path known.

```powershell
python scripts\export_to_ollama.py `
  --base-model mistralai/Mistral-7B-Instruct-v0.2 `
  --adapter-dir outputs\subeej-mistral-lora `
  --merged-dir outputs\subeej-mistral-merged `
  --llama-cpp-dir C:\path\to\llama.cpp `
  --gguf-out outputs\subeej-mistral-reasoner-f16.gguf `
  --quantize `
  --quant-out outputs\subeej-mistral-reasoner-q4_k_m.gguf `
  --ollama-name subeej-mistral-reasoner
```

## 4) Create and run in Ollama

```powershell
cd outputs
ollama create subeej-mistral-reasoner -f Modelfile.reasoner
ollama run subeej-mistral-reasoner
```

## 5) Use in app

Set `.env.local`:

```env
OLLAMA_MODEL=subeej-mistral-reasoner
```
