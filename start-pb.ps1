# Start PocketBase for development
Write-Host "Starting PocketBase..." -ForegroundColor Green
$proc = Start-Process -FilePath ".\pocketbase.exe" -ArgumentList "serve --http=127.0.0.1:8090" -NoNewWindow -PassThru
Write-Host "PID: $($proc.Id)" -ForegroundColor Gray
Write-Host "Waiting for PocketBase..." -ForegroundColor Yellow
for ($i = 0; $i -lt 15; $i++) {
  try { $r = Invoke-WebRequest -Uri "http://127.0.0.1:8090/api/health" -TimeoutSec 1 -ErrorAction Stop; if ($r.StatusCode -eq 200) { break } } catch {}
  Start-Sleep -Seconds 1
}
Write-Host "PocketBase running at http://127.0.0.1:8090" -ForegroundColor Green
Write-Host "Admin UI: http://127.0.0.1:8090/_/" -ForegroundColor Cyan
Write-Host "API: http://127.0.0.1:8090/api/" -ForegroundColor Cyan
