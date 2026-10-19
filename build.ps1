# ===== 剧情抽卡（Story Cards）Windows 构建脚本 =====
# 为什么需要它：某些环境（带文件沙箱的宿主、被安全软件托管的进程）会拦住 node
# 自己的写盘（EPERM），而 PowerShell 写盘正常。所以流程是：
#   node build.js --stdout  →  拿到两个产物  →  PowerShell 落盘
# 在普通环境里 node build.js 直接可用，本脚本只是多一层保险，结果完全一致。
#
# 用法（在插件目录下）：
#   powershell -ExecutionPolicy Bypass -File build.ps1
#
# 依赖：Node.js（脚本会依次尝试 PATH、DSH 运行时、常见安装路径）。
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$outIndex = Join-Path $root 'index.js'
$outCards = Join-Path $root 'js\cards-data.js'
$markCards = '<<<STORY_CARDS_FILE:js/cards-data.js>>>'
$markIndex = '<<<STORY_CARDS_FILE:index.js>>>'
$markEnd = '<<<STORY_CARDS_END>>>'

function Find-Node {
    $candidates = @()
    $cmd = Get-Command node -ErrorAction SilentlyContinue
    if ($cmd) { $candidates += $cmd.Source }
    if ($env:DSH_NODE_PATH) { $candidates += $env:DSH_NODE_PATH }
    $candidates += @(
        'C:\Users\Emma\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe',
        "$env:ProgramFiles\nodejs\node.exe",
        "${env:ProgramFiles(x86)}\nodejs\node.exe",
        "$env:LOCALAPPDATA\Programs\nodejs\node.exe"
    )
    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path $candidate)) { return $candidate }
    }
    return $null
}

$node = Find-Node
if (-not $node) {
    Write-Error '找不到 node.exe。请安装 Node.js，或用 node build.js 手动构建。'
    exit 1
}

# 让 node 的 stdout 以 UTF-8 进入 PowerShell（否则中文卡名会乱码）。
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "[build] 使用 node: $node"
$raw = & $node (Join-Path $root 'build.js') '--stdout'
if ($LASTEXITCODE -ne 0) {
    Write-Error "[build] node build.js --stdout 失败（退出码 $LASTEXITCODE）"
    exit $LASTEXITCODE
}

# $raw 可能是单行字符串或多行数组，统一拼成一个大字符串再按标记切分。
$text = ($raw -join "`n")
$pattern = '(?s)' + [regex]::Escape($markCards) + "`n(.*?)`n" + [regex]::Escape($markIndex) + "`n(.*?)`n" + [regex]::Escape($markEnd)
$match = [regex]::Match($text, $pattern)
if (-not $match.Success) {
    Write-Error '[build] 解析 node 输出失败：找不到产物标记。'
    exit 1
}

# 写盘：显式 UTF-8 无 BOM（.NET 静态方法在 FullLanguage 下可用；
# 受限语言模式下回退到 Set-Content -Encoding UTF8，带 BOM 也不影响浏览器加载）。
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
function Write-Utf8NoBom([string]$path, [string]$content) {
    $dir = Split-Path -Parent $path
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    try {
        [System.IO.File]::WriteAllText($path, $content, $utf8NoBom)
    } catch {
        Set-Content -Path $path -Value $content -Encoding UTF8
    }
}

Write-Utf8NoBom $outCards $match.Groups[1].Value
Write-Utf8NoBom $outIndex $match.Groups[2].Value

Write-Host "[build] 已写入 js/cards-data.js（$((Get-Item $outCards).Length) 字节）"
Write-Host "[build] 已写入 index.js（$((Get-Item $outIndex).Length) 字节）"
Write-Host '[build] 完成。酒馆里重载扩展或刷新页面即可生效。'
