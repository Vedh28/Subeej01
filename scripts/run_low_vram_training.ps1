$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..")
Set-Location $ProjectRoot

$TrainFile = "data\training\clean_agri_train.jsonl"
$EvalFile = "data\training\clean_agri_eval.jsonl"
$OutputDir = "outputs\subeej-qwen-1_5b-lora-clean"
$BaseModel = "Qwen/Qwen2.5-1.5B-Instruct"

if (!(Test-Path $TrainFile)) {
  Write-Error "Train file not found: $TrainFile"
}

if (!(Test-Path $EvalFile)) {
  Write-Error "Eval file not found: $EvalFile"
}

Write-Host "Starting low-VRAM LoRA training on $BaseModel ..."
python scripts\train_mistral_lora.py `
  --base-model $BaseModel `
  --train-file $TrainFile `
  --eval-file $EvalFile `
  --output-dir $OutputDir `
  --use-4bit `
  --cpu-offload `
  --trust-remote-code `
  --gradient-checkpointing `
  --max-seq-length 1024 `
  --epochs 2 `
  --batch-size 1 `
  --grad-accum 16 `
  --lora-r 8 `
  --lora-alpha 16 `
  --max-memory-gpu 3GiB `
  --max-memory-cpu 24GiB

if ($LASTEXITCODE -ne 0) {
  Write-Error "Training failed with exit code $LASTEXITCODE"
}

Write-Host "Training complete. Adapter saved in $OutputDir"
