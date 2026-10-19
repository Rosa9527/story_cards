# ASCII-only helper: ensure build.ps1 is saved as UTF-8 *with* BOM.
# Windows PowerShell 5.1 reads BOM-less .ps1 as ANSI, which garbles the Chinese
# strings in build.ps1 and breaks parsing. This helper rewrites the file once.
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File tools\fix-bom.ps1
$ErrorActionPreference = 'Stop'
$pluginRoot = Split-Path -Parent $PSScriptRoot
$target = Join-Path $pluginRoot 'build.ps1'
if (-not (Test-Path $target)) { Write-Error "not found: $target"; exit 1 }
$text = [System.IO.File]::ReadAllText($target, [System.Text.Encoding]::UTF8)
$utf8Bom = New-Object System.Text.UTF8Encoding($true)
[System.IO.File]::WriteAllText($target, $text, $utf8Bom)
$bytes = [System.IO.File]::ReadAllBytes($target)
Write-Host ("BOM bytes: {0:X2} {1:X2} {2:X2}" -f $bytes[0], $bytes[1], $bytes[2])
Write-Host "build.ps1 re-saved as UTF-8 with BOM."
