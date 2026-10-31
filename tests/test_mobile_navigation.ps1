# Verification Test: Mobile Navigation Dropdown & Accessibility
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  TESTING MOBILE NAVIGATION DROPDOWN & FUNCTIONALITY" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$root = Split-Path -Parent $PSScriptRoot
$html = Get-Content (Join-Path $root "public\index.html") -Raw
$css = Get-Content (Join-Path $root "public\assets\css\style.css") -Raw
$js = Get-Content (Join-Path $root "public\assets\js\app.js") -Raw

$allPassed = $true

function Assert-Contains($content, $pattern, $label) {
    if ($content -match $pattern) {
        Write-Host "[PASS] $label" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] $label - Pattern not found: $pattern" -ForegroundColor Red
        $global:allPassed = $false
    }
}

# 1. HTML Semantic & Accessibility Verification
Write-Host "`n--- 1. Navigation HTML & ARIA Attributes ---" -ForegroundColor Yellow
Assert-Contains $html 'id="navToggle"' "Menu toggle button present (id='navToggle')"
Assert-Contains $html 'aria-label="Toggle navigation"' "aria-label present on navToggle"
Assert-Contains $html 'aria-expanded="false"' "aria-expanded present on navToggle"
Assert-Contains $html 'aria-controls="navLinks"' "aria-controls present on navToggle"
Assert-Contains $html 'class="nav-actions"' "nav-actions positioning container present"
Assert-Contains $html 'id="navLinks"' "Navigation links container present (id='navLinks')"

# All Navigation items present with data-view
$destinations = @('dashboard', 'water', 'laundry', 'expenses', 'reports', 'rates', 'staff')
foreach ($dest in $destinations) {
    Assert-Contains $html "data-view=`"$dest`"" "Navigation button for view '$dest' present"
}
Assert-Contains $html 'id="logout-btn"' "Logout button present (id='logout-btn')"
Assert-Contains $html 'id="nav-brand"' "Brand logo present (id='nav-brand')"

# 2. CSS Dropdown Verification
Write-Host "`n--- 2. Dropdown CSS Styling & Positioning ---" -ForegroundColor Yellow
Assert-Contains $css '(?s)\.nav-actions\s*\{.*?position:\s*relative' "nav-actions positioned relatively"
Assert-Contains $css '(?s)@media\s*\(max-width:\s*768px\).*?\.nav-links\s*\{.*?position:\s*absolute' "Mobile dropdown positioned absolutely"
Assert-Contains $css '(?s)@media\s*\(max-width:\s*768px\).*?\.nav-links\s*\{.*?right:\s*0' "Mobile dropdown aligned to right edge"
Assert-Contains $css '(?s)@media\s*\(max-width:\s*768px\).*?\.nav-links\s*\{.*?width:\s*220px' "Compact dropdown width (220px) specified"
Assert-Contains $css '(?s)@media\s*\(max-width:\s*768px\).*?\.nav-links\s*\{.*?z-index:\s*1050' "High z-index (1050) applied above content"
Assert-Contains $css '(?s)\.nav-item-logout\s*button\s*\{.*?color:\s*var\(--danger\)' "Logout button styled with danger color"
Assert-Contains $css '(?s)@media\s*\(max-width:\s*768px\).*?\.form-row\s*\{.*?grid-template-columns:\s*minmax\(0,\s*1fr\)' "Mobile forms stack fields into a single non-overlapping column"
Assert-Contains $css '(?s)@media\s*\(max-width:\s*768px\).*?\.qty-grid\s*\{.*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)' "Mobile service quantity cards use a compact two-column grid"
Assert-Contains $css '(?s)@media\s*\(max-width:\s*768px\).*?\.nav-item-status,\s*\.nav-item-user\s*\{.*?display:\s*none\s*!important' "Database mode and demo user labels are hidden on mobile"
Assert-Contains $js 'min="0" step="1"\s*>' "Dynamically generated service quantities start empty"
Assert-Contains $html 'id="water-extra-qty"[^>]*>' "Water extra quantity input does not require deleting a default zero"
if ($html -match 'id="water-extra-qty"[^>]*value="0"' -or $html -match 'id="water-extra-price"[^>]*value="0"') {
    Write-Host "[FAIL] Water extra item inputs should start empty" -ForegroundColor Red
    $allPassed = $false
} else {
    Write-Host "[PASS] Water extra item inputs start empty" -ForegroundColor Green
}
$firebaseIntegration = $js -match 'firebase|firestore' -or $html -match 'firebase|firestore'
if ($firebaseIntegration -or $js -match "staff: '1111', owner: '5555'" -or $html -notmatch 'id="btn-select-staff-pin"' -or $html -notmatch 'id="btn-select-admin-pin"' -or $html -notmatch 'id="staff-pin-login-form"' -or $html -notmatch 'id="admin-pin-login-form"' -or $js -notmatch "loginWithPin" -or $html -match 'id="staff-email"' -or $html -match 'show-password-login-staff') {
    Write-Host "[FAIL] Firebase and email/password login must stay removed and separate Staff/Admin PIN authentication must be used" -ForegroundColor Red
    $allPassed = $false
} else {
    Write-Host "[PASS] Firebase and email/password login are removed and separate cross-device Staff/Admin PIN login is present" -ForegroundColor Green
}

# 3. JavaScript Dropdown Logic & Interaction
Write-Host "`n--- 3. JavaScript Dropdown Logic & Interaction ---" -ForegroundColor Yellow
Assert-Contains $js 'function closeMobileMenu\(' "closeMobileMenu function defined"
Assert-Contains $js 'function openMobileMenu\(' "openMobileMenu function defined"
Assert-Contains $js 'function toggleMobileMenu\(' "toggleMobileMenu function defined"
Assert-Contains $js '(?s)btn\.addEventListener\(''click''.*?closeMobileMenu\(\)' "nav-link click listener closes mobile menu"
Assert-Contains $js '(?s)data-nav.*?closeMobileMenu\(\)' "data-nav action shortcuts close mobile menu"
Assert-Contains $js '(?s)switchView\(viewName\)\s*\{.*?closeMobileMenu\(\)' "switchView unconditionally guarantees menu closure"
Assert-Contains $js 'toggleBtn\.setAttribute\(''aria-expanded''' "Toggle button updates aria-expanded"
Assert-Contains $js 'document\.addEventListener\(''click''' "Click-outside document listener registered"
Assert-Contains $js 'document\.addEventListener\(''keydown''' "Escape key listener registered"
Assert-Contains $js 'window\.addEventListener\(''resize''' "Window resize listener registered"

# 4. Zero Emojis Check
Write-Host "`n--- 4. Zero Emojis Policy Enforcement ---" -ForegroundColor Yellow
$emojiRegex = '[\uD83C-\uDBFF\uDC00-\uDFFF\u2600-\u26FF\u2700-\u27BF]'
if ($html -match $emojiRegex -or $css -match $emojiRegex -or $js -match $emojiRegex) {
    Write-Host "[FAIL] Found emoji in navigation files!" -ForegroundColor Red
    $allPassed = $false
} else {
    Write-Host "[PASS] Zero emojis confirmed in all navigation code" -ForegroundColor Green
}

if ($allPassed) {
    Write-Host "`n========================================================" -ForegroundColor Green
    Write-Host "  ALL MOBILE NAVIGATION TESTS PASSED SUCCESSFULLY!" -ForegroundColor Green
    Write-Host "========================================================" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n[ERROR] Some navigation checks failed." -ForegroundColor Red
    exit 1
}
