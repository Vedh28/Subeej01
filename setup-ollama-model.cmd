@echo off
setlocal
cd /d "%~dp0"

set "OLLAMA_MODEL_NAME=subeej-qwen-1_5b-reasoner"
set "MODEL_DIR=%~dp0outputs"
set "MODEL_FILE=%MODEL_DIR%\subeej-qwen-1_5b-reasoner-f16.gguf"
set "MODELFILE=%MODEL_DIR%\Modelfile.reasoner"

echo Checking Ollama installation...
where ollama >nul 2>nul
if errorlevel 1 (
  echo.
  echo Ollama is not installed or not on PATH.
  echo Install Ollama first, then run this file again.
  pause
  exit /b 1
)

if not exist "%MODEL_FILE%" (
  echo.
  echo Missing bundled GGUF model:
  echo %MODEL_FILE%
  pause
  exit /b 1
)

if not exist "%MODELFILE%" (
  echo.
  echo Missing Modelfile:
  echo %MODELFILE%
  pause
  exit /b 1
)

echo Creating Ollama model "%OLLAMA_MODEL_NAME%"...
pushd "%MODEL_DIR%"
ollama create %OLLAMA_MODEL_NAME% -f "%MODELFILE%"
set "EXIT_CODE=%ERRORLEVEL%"
popd

if not "%EXIT_CODE%"=="0" (
  echo.
  echo Ollama model creation failed.
  pause
  exit /b %EXIT_CODE%
)

echo.
echo Ollama model "%OLLAMA_MODEL_NAME%" is ready.
echo You can now run launch-subeej.cmd
pause
exit /b 0
