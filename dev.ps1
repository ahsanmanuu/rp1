$pbPort = 8090
$pbProc = $null

# Check if PocketBase is already running
$existing = Get-NetTCPConnection -LocalPort $pbPort -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host "PocketBase already running on port $pbPort" -ForegroundColor Green
} else {
  Write-Host "Starting PocketBase..." -ForegroundColor Green
  $pbProc = Start-Process -FilePath ".\pocketbase.exe" -ArgumentList "serve --http=127.0.0.1:$pbPort" -NoNewWindow -PassThru

  # Wait for it to be ready
  $ready = $false
  for ($i = 0; $i -lt 30; $i++) {
    try {
      $r = Invoke-WebRequest -Uri "http://127.0.0.1:$pbPort/api/health" -TimeoutSec 2 -ErrorAction Stop
      if ($r.StatusCode -eq 200) { $ready = $true; break }
    } catch {}
    Start-Sleep -Seconds 1
  }
  if (-not $ready) { Write-Host "PocketBase failed to start" -ForegroundColor Red; exit 1 }
  Write-Host "PocketBase ready at http://127.0.0.1:$pbPort" -ForegroundColor Green
}

# Run Next.js dev server
try {
  npm run dev
} finally {
  # Cleanup: kill PocketBase if we started it
  if ($pbProc -and -not $pbProc.HasExited) {
    $pbProc.Kill()
    Write-Host "PocketBase stopped" -ForegroundColor Yellow
  }
}
