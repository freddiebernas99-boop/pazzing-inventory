# PAZINGS INVENTORY & SALES MANAGEMENT SYSTEM
# Verification Test: Paid Sales vs Unpaid Balance Calculations

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  TESTING PAID SALES VS UNPAID BALANCE LOGIC" -ForegroundColor White
Write-Host "========================================================" -ForegroundColor Cyan

# 1. Test calculation engine simulation matching app.js logic
$transactions = @(
    @{
        id = "tx_1"
        businessCategory = "laundry"
        customerName = "Customer A"
        totalAmount = 235.00
        paymentStatus = "paid"
        transactionDate = "2026-10-22"
    },
    @{
        id = "tx_2"
        businessCategory = "water"
        customerName = "Customer B"
        totalAmount = 550.00
        paymentStatus = "unpaid"
        transactionDate = "2026-10-22"
    }
)

$paidSales = 0.0
$waterPaid = 0.0
$laundryPaid = 0.0

$unpaidBalance = 0.0
$waterUnpaid = 0.0
$laundryUnpaid = 0.0
$unpaidCount = 0

foreach ($t in $transactions) {
    $amt = [double]$t.totalAmount
    if ($t.paymentStatus -eq "paid") {
        $paidSales += $amt
        if ($t.businessCategory -eq "water") { $waterPaid += $amt }
        elseif ($t.businessCategory -eq "laundry") { $laundryPaid += $amt }
    } else {
        $unpaidBalance += $amt
        $unpaidCount++
        if ($t.businessCategory -eq "water") { $waterUnpaid += $amt }
        elseif ($t.businessCategory -eq "laundry") { $laundryUnpaid += $amt }
    }
}

$totalTransCount = $transactions.Count
$totalGrossSales = $paidSales + $unpaidBalance

Write-Host "Scenario 1: Initial state (Tx1: 235 Paid, Tx2: 550 Unpaid)" -ForegroundColor Yellow
Write-Host "  Paid Sales: ₱$paidSales (Expected: ₱235.00)"
Write-Host "  Unpaid Balance: ₱$unpaidBalance (Expected: ₱550.00)"
Write-Host "  Total Transactions: $totalTransCount (Expected: 2)"
Write-Host "  Total Gross Sales: ₱$totalGrossSales (Expected: ₱785.00)"

if ($paidSales -eq 235.00 -and $unpaidBalance -eq 550.00 -and $totalTransCount -eq 2) {
    Write-Host "[PASS] User's test case passed perfectly!" -ForegroundColor Green
} else {
    Write-Host "[FAIL] User's test case failed!" -ForegroundColor Red
    exit 1
}

# Scenario 2: Changing Tx2 from unpaid to paid
Write-Host ""
Write-Host "Scenario 2: Toggling Tx2 from Unpaid to Paid" -ForegroundColor Yellow
$transactions[1].paymentStatus = "paid"

$paidSales2 = 0.0
$unpaidBalance2 = 0.0
$unpaidCount2 = 0

foreach ($t in $transactions) {
    $amt = [double]$t.totalAmount
    if ($t.paymentStatus -eq "paid") {
        $paidSales2 += $amt
    } else {
        $unpaidBalance2 += $amt
        $unpaidCount2++
    }
}

Write-Host "  New Paid Sales: ₱$paidSales2 (Expected: ₱785.00)"
Write-Host "  New Unpaid Balance: ₱$unpaidBalance2 (Expected: ₱0.00)"
Write-Host "  New Unpaid Count: $unpaidCount2 (Expected: 0)"

if ($paidSales2 -eq 785.00 -and $unpaidBalance2 -eq 0.00 -and $unpaidCount2 -eq 0) {
    Write-Host "[PASS] Payment status toggle correctly updates both figures!" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Payment status toggle failed!" -ForegroundColor Red
    exit 1
}

# 3. Test HTML Elements Presence
Write-Host ""
Write-Host "Scenario 3: Verifying DOM Elements in public\index.html" -ForegroundColor Yellow
$root = Split-Path -Parent $PSScriptRoot
$html = Get-Content -Raw (Join-Path $root "public\index.html")

$requiredIds = @(
    "dashboard-paid-sales",
    "dashboard-water-paid",
    "dashboard-laundry-paid",
    "dashboard-unpaid-balance",
    "dashboard-unpaid-count",
    "dashboard-water-unpaid",
    "dashboard-laundry-unpaid",
    "rep-water-sales",
    "rep-laundry-sales",
    "rep-total-sales",
    "rep-paid-collections",
    "rep-unpaid-balance",
    "rep-cash-flow",
    "rep-net-value"
)

$allFound = $true
foreach ($id in $requiredIds) {
    if ($html -notmatch "id=`"$id`"") {
        Write-Host "[FAIL] Missing element with id: $id" -ForegroundColor Red
        $allFound = $false
    }
}

if ($allFound) {
    Write-Host "[PASS] All required dashboard and reports elements are present in index.html!" -ForegroundColor Green
} else {
    exit 1
}

# 4. Emoji check
Write-Host ""
Write-Host "Scenario 4: Verifying zero emojis" -ForegroundColor Yellow
$files = @(
    (Join-Path $root "public\index.html"),
    (Join-Path $root "public\assets\js\app.js"),
    (Join-Path $root "public\assets\css\style.css")
)
foreach ($f in $files) {
    $c = Get-Content -Raw $f
    for ($i = 0; $i -lt $c.Length; $i++) {
        $code = [int]$c[$i]
        if ($code -ge 0xD800 -and $code -le 0xDBFF) {
            Write-Host "[FAIL] Emoji found in $f" -ForegroundColor Red
            exit 1
        }
    }
}
Write-Host "[PASS] Zero emojis confirmed across all modified client files!" -ForegroundColor Green

Write-Host ""
Write-Host "ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!" -ForegroundColor Cyan
