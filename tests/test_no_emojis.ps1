$root = Split-Path -Parent $PSScriptRoot
$files = @(
    (Join-Path $root "public\index.html"),
    (Join-Path $root "public\assets\js\app.js"),
    (Join-Path $root "public\assets\css\style.css")
)

$hasErrors = $false
foreach ($filePath in $files) {
    $content = Get-Content -Raw $filePath
    # Check for unicode surrogate pairs (common emojis)
    for ($i = 0; $i -lt $content.Length; $i++) {
        $code = [int]$content[$i]
        if ($code -ge 0xD800 -and $code -le 0xDBFF) {
            Write-Host "EMOJI DETECTED in $filePath at position $i"
            $hasErrors = $true
            break
        }
    }
}

if (-not $hasErrors) {
    Write-Host "ZERO EMOJIS CONFIRMED across all client files!"
} else {
    exit 1
}
