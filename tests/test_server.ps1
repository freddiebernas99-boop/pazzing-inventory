$root = Split-Path -Parent $PSScriptRoot
$testPort = 8000
Write-Host "Testing Pazings server files..."

# Test HTML syntax and presence
$html = Get-Content -Raw (Join-Path $root "public\index.html")
if ($html -match "PAZINGS" -and $html -match "Daily Overview" -and $html -match "Water Refilling") {
    Write-Host "Index HTML verification: PASSED"
} else {
    Write-Host "Index HTML verification: FAILED"
}

# Test JS syntax and modules
$js = Get-Content -Raw (Join-Path $root "public\assets\js\app.js")
if ($js -match "DataService" -and $js -match "calculateWaterTotal" -and $js -match "calculateLaundryTotal") {
    Write-Host "App JS verification: PASSED"
} else {
    Write-Host "App JS verification: FAILED"
}

# Test CSS presence
$css = Get-Content -Raw (Join-Path $root "public\assets\css\style.css")
if ($css -match "#123B66" -and $css -match "#2563EB" -and $css -match "#F5F7FA") {
    Write-Host "CSS Palette verification: PASSED"
} else {
    Write-Host "CSS Palette verification: FAILED"
}

# Test that the client runs without Firebase dependencies
$firebaseReferences = $html + $js | Select-String -Pattern "firebase|firestore" -Quiet
$firebaseFiles = @(
    (Join-Path $root "firebase.json"),
    (Join-Path $root "firestore.rules"),
    (Join-Path $root "public\assets\js\firebase-config.js")
) | Where-Object { Test-Path $_ }
if (-not $firebaseReferences -and $firebaseFiles.Count -eq 0) {
    Write-Host "Firebase removal verification: PASSED"
} else {
    Write-Host "Firebase removal verification: FAILED"
}
