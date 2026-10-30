# Verification Test: Dynamic Rates, Reports Side-by-Side Breakdown, Login Redesign & Responsiveness
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  VERIFYING DYNAMIC RATES, REPORTS & LOGIN ARCHITECTURE" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$root = Split-Path -Parent $PSScriptRoot
$html = Get-Content (Join-Path $root "public\index.html") -Raw
$css = Get-Content (Join-Path $root "public\assets\css\style.css") -Raw
$js = Get-Content (Join-Path $root "public\assets\js\app.js") -Raw
$api = Get-Content (Join-Path $root "api\index.js") -Raw

$allPassed = $true

function Assert-Contains($content, $pattern, $label) {
    if ($content -match $pattern) {
        Write-Host "[PASS] $label" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] $label - Not found: $pattern" -ForegroundColor Red
        $global:allPassed = $false
    }
}

# 1. Check Login UI Elements
Write-Host "`n--- 1. Login Redesign Verification ---" -ForegroundColor Yellow
Assert-Contains $html 'id="pin-role-select"' "Role selection screen container present"
Assert-Contains $html 'id="btn-select-staff-pin"' "Staff Portal selection button present"
Assert-Contains $html 'id="btn-select-admin-pin"' "Admin Portal selection button present"
Assert-Contains $html 'id="login-staff-pin-card"' "Staff PIN Login card present"
Assert-Contains $html 'id="login-admin-pin-card"' "Admin PIN Login card present"
Assert-Contains $html 'id="staff-pin-login-form"' "Staff PIN Login form present"
Assert-Contains $html 'id="admin-pin-login-form"' "Admin PIN Login form present"
Assert-Contains $html 'id="btn-staff-pin-back"' "Staff PIN Back button present"
Assert-Contains $html 'id="btn-admin-pin-back"' "Admin PIN Back button present"

if ($html -match 'show-password-login-staff|show-password-login-admin|login-password-setup|First time or forgot PIN') {
    Write-Host "[FAIL] Password login / setup PIN button should NOT be present in index.html" -ForegroundColor Red
    $allPassed = $false
} else {
    Write-Host "[PASS] Password login / setup PIN button and email/password forms removed from UI" -ForegroundColor Green
}

# Verify default credentials box is removed from index.html
if ($html -match 'id="demo-credentials-box"') {
    Write-Host "[FAIL] demo-credentials-box should NOT be present in index.html" -ForegroundColor Red
    $allPassed = $false
} else {
    Write-Host "[PASS] Default credentials box successfully removed from UI" -ForegroundColor Green
}

# 2. Dynamic Transaction Containers
Write-Host "`n--- 2. Dynamic Transaction Forms Verification ---" -ForegroundColor Yellow
Assert-Contains $html 'id="water-services-container"' "Water services dynamic container present"
Assert-Contains $html 'id="laundry-services-container"' "Laundry services dynamic container present"
Assert-Contains $js 'function renderWaterFormFields' "renderWaterFormFields function defined in JS"
Assert-Contains $js 'function renderLaundryFormFields' "renderLaundryFormFields function defined in JS"
Assert-Contains $js 'function calculateWaterTotal' "calculateWaterTotal function defined in JS"
Assert-Contains $js 'function calculateLaundryTotal' "calculateLaundryTotal function defined in JS"

# 3. Dynamic Service Rates Management (CRUD)
Write-Host "`n--- 3. Service Rates Management (CRUD) ---" -ForegroundColor Yellow
Assert-Contains $html 'id="btn-open-add-service"' "Add New Service button present"
Assert-Contains $html 'id="add-service-modal"' "Add Service Modal present"
Assert-Contains $html 'id="edit-service-modal"' "Edit Service Modal present"
Assert-Contains $html 'id="rates-water-tbody"' "Water rates table body present"
Assert-Contains $html 'id="rates-laundry-tbody"' "Laundry rates table body present"
Assert-Contains $js 'DEFAULT_SERVICES' "DEFAULT_SERVICES catalog defined"
Assert-Contains $js 'async getServices\(' "DataService.getServices defined"
Assert-Contains $js 'async addService\(' "DataService.addService defined"
Assert-Contains $js 'async updateService\(' "DataService.updateService defined"
Assert-Contains $js 'async deleteService\(' "DataService.deleteService defined"
Assert-Contains $js 'async toggleServiceActive\(' "DataService.toggleServiceActive defined"

# 4. Reports Side-by-Side Breakdown & Synchronized Filters
Write-Host "`n--- 4. Reports Side-by-Side Cards & Footers ---" -ForegroundColor Yellow
Assert-Contains $html 'id="rep-water-tx-card"' "Reports Water Transactions card present"
Assert-Contains $html 'id="rep-laundry-tx-card"' "Reports Laundry Transactions card present"
Assert-Contains $html 'id="rep-water-tx-tbody"' "Water transactions tbody present in Reports"
Assert-Contains $html 'id="rep-laundry-tx-tbody"' "Laundry transactions tbody present in Reports"
Assert-Contains $html 'id="rep-water-summary-count"' "Water count metric present in footer"
Assert-Contains $html 'id="rep-water-summary-gross"' "Water gross sales metric present in footer"
Assert-Contains $html 'id="rep-water-summary-paid"' "Water paid metric present in footer"
Assert-Contains $html 'id="rep-water-summary-unpaid"' "Water unpaid metric present in footer"
Assert-Contains $html 'id="rep-laundry-summary-count"' "Laundry count metric present in footer"
Assert-Contains $html 'id="rep-laundry-summary-gross"' "Laundry gross sales metric present in footer"
Assert-Contains $html 'id="rep-laundry-summary-paid"' "Laundry paid metric present in footer"
Assert-Contains $html 'id="rep-laundry-summary-unpaid"' "Laundry unpaid metric present in footer"

# 5. CSS Responsive Grid & Touch Targets
Write-Host "`n--- 5. Responsive Styling & Modals ---" -ForegroundColor Yellow
Assert-Contains $css '\.reports-tx-grid' "reports-tx-grid class styled in CSS"
Assert-Contains $css '\.modal-overlay' "modal-overlay styled in CSS"
Assert-Contains $css '\.role-select-btn' "role-select-btn styled in CSS"
Assert-Contains $css 'min-height:\s*44px' "44px minimum touch target enforced in CSS"
Assert-Contains $css '@media\s*\(max-width:\s*900px\)' "Responsive 900px breakpoint for grid stacking"

# 6. Admin Role Security Guard Check
Write-Host "`n--- 6. Admin Role Enforcement in JS ---" -ForegroundColor Yellow
Assert-Contains $api 'user\.role !== ''owner''' "Owner role enforcement is checked by the server API"

if ($allPassed) {
    Write-Host "`n========================================================" -ForegroundColor Green
    Write-Host "  ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!" -ForegroundColor Green
    Write-Host "========================================================" -ForegroundColor Green
} else {
    Write-Host "`n[ERROR] Some checks failed." -ForegroundColor Red
    exit 1
}
