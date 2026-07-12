# Start PocketBase for development
Write-Host "Starting PocketBase..." -ForegroundColor Green
Start-Process -FilePath ".\pocketbase.exe" -ArgumentList "serve --http=127.0.0.1:8090" -NoNewWindow
Write-Host "PocketBase running at http://127.0.0.1:8090" -ForegroundColor Green
Write-Host "Admin UI: http://127.0.0.1:8090/_/" -ForegroundColor Cyan
Write-Host "API: http://127.0.0.1:8090/api/" -ForegroundColor Cyan
