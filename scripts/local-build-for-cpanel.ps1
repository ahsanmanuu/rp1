#!/usr/bin/env powershell
# =============================================================================
# local-build-for-cpanel.ps1 — Build Next.js locally, package for cPanel upload
#
# Usage (Windows PowerShell 5):  powershell -File scripts/local-build-for-cpanel.ps1
# Usage (PowerShell Core 7+):    pwsh scripts/local-build-for-cpanel.ps1
# =============================================================================

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $ProjectRoot

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "[Local Build] Building Next.js for cPanel deployment" -ForegroundColor Cyan
Write-Host "[Local Build] Project: $ProjectRoot" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# Step 1: Generate Prisma client
Write-Host ""
Write-Host "[Step 1/4] Generating Prisma client..." -ForegroundColor Yellow
# Suppress telemetry child-process spawn (prevents EAGAIN on constrained hosts)
$env:CHECKPOINT_DISABLE = "1"
$env:PRISMA_TELEMETRY_DISABLE = "1"
$env:PRISMA_GENERATE_FORCE_INLINE = "1"
npx prisma generate
if ($LASTEXITCODE -ne 0) { Write-Host "[WARNING] Prisma generate had issues" -ForegroundColor DarkYellow }

# Step 2: Fix Prisma exports
Write-Host ""
Write-Host "[Step 2/4] Fixing Prisma exports..." -ForegroundColor Yellow
node scripts/fix-prisma-exports.js
if ($LASTEXITCODE -ne 0) { Write-Host "[WARNING] fix-prisma-exports had issues" -ForegroundColor DarkYellow }

# Step 3: Build Next.js with full memory (local PC has plenty)
Write-Host ""
Write-Host "[Step 3/4] Building Next.js standalone (this may take 2-5 minutes)..." -ForegroundColor Yellow
$buildStart = Get-Date
Write-Host "  Build started at: $buildStart" -ForegroundColor Gray

$env:NODE_ENV = "production"
$env:NEXT_TELEMETRY_DISABLED = "1"
$env:DISABLE_ESLINT_PLUGIN = "true"
node --max-old-space-size=8192 node_modules/next/dist/bin/next build

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[ERROR] Next.js build failed with exit code $LASTEXITCODE" -ForegroundColor Red
    exit 1
}
$buildEnd = Get-Date
Write-Host "  Build finished at: $buildEnd" -ForegroundColor Gray

# Step 4: Package standalone artifact
Write-Host ""
Write-Host "[Step 4/4] Packaging standalone artifact..." -ForegroundColor Yellow
node scripts/package-standalone.cjs

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Standalone packaging failed" -ForegroundColor Red
    exit 1
}
$sizeStr = $sizeMB.ToString() + " MB"
Write-Host ("  OK: Artifact created: " + $OutputTar + " (" + $sizeStr + ")") -ForegroundColor Green

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "[Local Build] BUILD COMPLETE!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps to deploy to cPanel:" -ForegroundColor Yellow
Write-Host "  1. Open cPanel File Manager" -ForegroundColor White
Write-Host "  2. Navigate to: /home/latexify/latexify/" -ForegroundColor White
Write-Host ("  3. Upload: latexify-next.tar.gz (" + $sizeStr + ")") -ForegroundColor White
Write-Host "  4. In cPanel Terminal, run:" -ForegroundColor White
Write-Host "       cd ~/latexify" -ForegroundColor Cyan
Write-Host "       bash scripts/cpanel-install-artifact.sh" -ForegroundColor Cyan
Write-Host "  5. Go to: cPanel -> Setup Node.js App -> Restart" -ForegroundColor White
Write-Host ""
