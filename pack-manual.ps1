# 手工组装 Windows 便携版（无需网络下载，使用本地 node_modules/electron/dist）
# 用法: powershell -ExecutionPolicy Bypass -File pack-manual.ps1 [-OutDir <dir>]
param(
  [string]$OutDir = 'release'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $MyInvocation.MyCommand.Path -Parent
$out = Join-Path $root (Join-Path $OutDir 'DSH上下文查看器-win32-x64')
if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Force -Path $out | Out-Null

# 1. 复制 Electron 运行时
Copy-Item -Recurse -Force (Join-Path $root 'node_modules\electron\dist\*') $out

# 2. 重命名主程序
Rename-Item (Join-Path $out 'electron.exe') 'DSH上下文查看器.exe'

# 3. app 目录（resources/app，不用 asar，便于修改）
$appDir = Join-Path $out 'resources\app'
New-Item -ItemType Directory -Force -Path $appDir | Out-Null
Copy-Item -Recurse -Force (Join-Path $root 'dist') (Join-Path $appDir 'dist')
Copy-Item (Join-Path $root 'package.json') $appDir

# 4. 复制运行时依赖（ws 等）
New-Item -ItemType Directory -Force -Path (Join-Path $appDir 'node_modules') | Out-Null
Copy-Item -Recurse -Force (Join-Path $root 'node_modules\ws') (Join-Path $appDir 'node_modules\ws')

# 5. 精简：移除 electron dist 里无用的东西
Remove-Item (Join-Path $out 'resources\default_app.asar') -Force -ErrorAction SilentlyContinue

# 6. 统计
$size = (Get-ChildItem $out -Recurse -File | Measure-Object -Property Length -Sum).Sum
Write-Output ('PACK_OK: ' + $out)
Write-Output ('SIZE_MB: ' + [math]::Round($size / 1MB, 1))
