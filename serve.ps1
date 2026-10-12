# Brand Guide Studio — Prime Kreatives
# Zero-dependency, browser-only branding pipeline.
# Runs from the filesystem or any static host.

$root = $PSScriptRoot

Write-Host ""
Write-Host "  PRIME KREATIVES - BRAND GUIDE STUDIO" -ForegroundColor Yellow
Write-Host "  Serving: $root" -ForegroundColor DarkGray
Write-Host ""

if (Get-Command py -ErrorAction SilentlyContinue) {
    Write-Host "  Open: http://localhost:8080/" -ForegroundColor Green
    Push-Location $root
    try { py -m http.server 8080 } finally { Pop-Location }
}
elseif (Get-Command node -ErrorAction SilentlyContinue) {
    Write-Host "  Open: http://localhost:8080/" -ForegroundColor Green
    npx --yes serve -l 8080 $root
}
else {
    Write-Host "  No local server on this machine — opening the file directly:" -ForegroundColor Cyan
    Write-Host "  $root\index.html" -ForegroundColor White
    Write-Host "  (PPTX export needs internet; everything else works from file://)" -ForegroundColor DarkGray
    Start-Process "$root\index.html"
}
