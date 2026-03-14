$ErrorActionPreference = "Stop"

$TrainFile = "data\training\reasoning_train.jsonl"
$EvalFile = "data\training\reasoning_eval_holdout.jsonl"
$OutputDir = "outputs\subeej-mistral-lora"
$BaseModel = "mistralai/Mistral-7B-Instruct-v0.2"

Write-Host "Checking Python + Torch CUDA availability..."
$cuda = python -c "import torch; print('1' if torch.cuda.is_available() else '0')"
if ($cuda.Trim() -ne "1") {
  Write-Error "CUDA GPU not available. Mistral LoRA training requires a CUDA-enabled GPU."
}

if (!(Test-Path $TrainFile)) {
  Write-Error "Train file not found: $TrainFile"
}
if (!(Test-Path $EvalFile)) {
  Write-Error "Eval file not found: $EvalFile"
}

Write-Host "Starting Mistral LoRA training..."
python scripts\train_mistral_lora.py `
  --base-model $BaseModel `
  --train-file $TrainFile `
  --eval-file $EvalFile `
  --output-dir $OutputDir `
  --use-4bit `
  --gradient-checkpointing `
  --epochs 2 `
  --batch-size 1 `
  --grad-accum 8

Write-Host "Training complete. Adapter saved in $OutputDir"
Write-Host "Next: run export_to_ollama.py with your llama.cpp path."
