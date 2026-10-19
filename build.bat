@echo off
chcp 65001 >nul
rem ===== Story Cards - Windows one-click build =====
rem Double-click this file. It calls build.ps1 (node generates the artifacts,
rem PowerShell writes them to disk).
rem Run it again after adding new cards, otherwise index.js keeps the old ones.
rem NOTE: keep this file ASCII-only. cmd.exe reads .bat in the OEM codepage,
rem so non-ASCII text here would garble on non-UTF-8 locales.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build.ps1"
if errorlevel 1 (
  echo.
  echo [build] FAILED - see the error output above.
) else (
  echo.
  echo [build] Done. Reload the extension or refresh the page in SillyTavern.
)
pause
