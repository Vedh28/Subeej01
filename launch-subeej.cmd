@echo off
setlocal
cd /d "%~dp0"

title Subeej Launcher
if exist ".next\BUILD_ID" goto :start

if exist "next-build\BUILD_ID" (
  echo Restoring packaged Next build...
  if exist .next rmdir /s /q .next
  xcopy /e /i /q /y "next-build" ".next" >nul
  if errorlevel 1 (
    echo.
    echo Failed to restore the packaged build from next-build.
    pause
    exit /b 1
  )
  goto :start
)

:build
if not exist "pages" (
  echo.
  echo No production build was found, and source files are not available to rebuild it.
  echo Run this package using launch-subeej.cmd from the full share ZIP.
  pause
  exit /b 1
)

echo Building Subeej...
call npm.cmd run build
if errorlevel 1 (
  echo.
  echo Build failed. Keep this window open and review the error above.
  pause
  exit /b 1
)

:start
echo Starting Subeej on http://localhost:5173/chat
start "Subeej Server" cmd /k "cd /d %~dp0 && npm.cmd run start -- -p 5173"

echo Waiting for server...
set READY=
for /l %%i in (1,1,20) do (
  powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing http://127.0.0.1:5173/chat -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
  if not errorlevel 1 (
    set READY=1
    goto :open
  )
  timeout /t 1 /nobreak >nul
)

:open
start "" http://localhost:5173/chat

if not defined READY (
  echo.
  echo The browser was opened, but the server may still be starting.
  echo If the page is blank, wait a few seconds and refresh once.
)

exit /b 0
