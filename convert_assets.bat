@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem Repository root = directory containing this batch file.
set "REPO_ROOT=%~dp0"
if "%REPO_ROOT:~-1%"=="\" set "REPO_ROOT=%REPO_ROOT:~0,-1%"

if not defined ULTIMATE_TEX_CLI (
  set "ULTIMATE_TEX_CLI=E:\research\ultimate_tex\target\release\ultimate_tex_cli.exe"
)

where bun >nul 2>&1
if errorlevel 1 (
  echo [convert_assets] ERROR: bun is not in PATH. Install Bun and retry.
  exit /b 1
)

if "%~1"=="" (
  echo Usage: Drag and drop one or more .lm / .lmb files onto this script.
  echo Optional: set ULTIMATE_TEX_CLI to your ultimate_tex_cli.exe path.
  exit /b 1
)

:argLoop
if "%~1"=="" goto argDone

set "INPUT_FILE=%~1"
set "INPUT_EXT=%~x1"

if /i not "%INPUT_EXT%"==".lm" if /i not "%INPUT_EXT%"==".lmb" (
  echo [convert_assets] SKIP not .lm/.lmb: "!INPUT_FILE!"
  shift
  goto argLoop
)

echo.
echo [convert_assets] LMB/JSON: "!INPUT_FILE!"

pushd "%REPO_ROOT%" || (
  echo [convert_assets] ERROR: cannot cd to REPO_ROOT "%REPO_ROOT%"
  shift
  goto argLoop
)

bun "%REPO_ROOT%\lmbtojson.ts" "!INPUT_FILE!"
set "JSON_EXIT=%ERRORLEVEL%"
popd

if not "!JSON_EXIT!"=="0" (
  echo [convert_assets] WARNING: lmbtojson exited with !JSON_EXIT! for "!INPUT_FILE!"
)

call :convertNutexbInTextures "!INPUT_FILE!"

shift
goto argLoop

:argDone
echo.
echo [convert_assets] Done.
exit /b 0

rem ---------------------------------------------------------------------------
rem For a given .lm/.lmb path, if a sibling "textures" folder exists and
rem ultimate_tex_cli is available, convert each .nutexb to named PNGs via *.png.
rem ---------------------------------------------------------------------------
:convertNutexbInTextures
setlocal EnableExtensions EnableDelayedExpansion
set "LMB_PATH=%~1"
set "ASSET_DIR=%~dp1"
if "%ASSET_DIR:~-1%"=="\" set "ASSET_DIR=%ASSET_DIR:~0,-1%"
set "TEX_DIR=%ASSET_DIR%\textures"

if not exist "%TEX_DIR%\" (
  echo [convert_assets] SKIP textures folder missing: "%TEX_DIR%"
  endlocal & exit /b 0
)

if not exist "%ULTIMATE_TEX_CLI%" (
  echo [convert_assets] SKIP NUTEXB: ultimate_tex_cli not found: "%ULTIMATE_TEX_CLI%"
  endlocal & exit /b 0
)

set "NUTEXB_COUNT=0"
for /f "delims=" %%N in ('dir /b "%TEX_DIR%\*.nutexb" 2^>nul') do set /a NUTEXB_COUNT+=1

if "!NUTEXB_COUNT!"=="0" (
  echo [convert_assets] SKIP no .nutexb in "%TEX_DIR%"
  endlocal & exit /b 0
)

echo [convert_assets] NUTEXB -^> PNG in "%TEX_DIR%"
for /f "delims=" %%N in ('dir /b "%TEX_DIR%\*.nutexb" 2^>nul') do (
  echo   - "%%N"
  "%ULTIMATE_TEX_CLI%" "%TEX_DIR%\%%N" "%TEX_DIR%\*.png"
  if errorlevel 1 echo   [convert_assets] WARNING: ultimate_tex_cli failed for "%%N"
)

endlocal & exit /b 0
