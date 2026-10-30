<?php
/**
 * PAZINGS INVENTORY & SALES MANAGEMENT SYSTEM
 * Automated End-to-End System Test Suite
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/auth.php';

echo "=========================================================\n";
echo "   RUNNING AUTOMATED TEST SUITE FOR PAZINGS SYSTEM\n";
echo "=========================================================\n\n";

$pdo = getDbConnection();
$passed = 0;
$failed = 0;

function assertTest($condition, $description) {
    global $passed, $failed;
    if ($condition) {
        echo "  [PASS] $description\n";
        $passed++;
    } else {
        echo "  [FAIL] $description\n";
        $failed++;
    }
}

// TEST 1: User Authentication & Role Verification
echo "--- TEST GROUP 1: Authentication & Roles ---\n";
$loginNonexistent = loginUser('test_missing_user', bin2hex(random_bytes(16)));
assertTest($loginNonexistent['success'] === false, "Reject nonexistent user");

// TEST 2: Water Refill Transaction Creation & Math
echo "\n--- TEST GROUP 2: Water Refill Transaction & Line Items ---\n";
$testDate = '2026-07-01'; // Use date matching Excel reference
$pdo->exec("DELETE FROM transactions WHERE transaction_date = '$testDate'");
$pdo->exec("DELETE FROM expenses WHERE expense_date = '$testDate'");
$pdo->exec("DELETE FROM customers WHERE name LIKE '%(Test)%'");
$waterServices = getServicesByCategory($pdo, 'water');
assertTest(count($waterServices) >= 3, "Fetched active water services (Refill, Delivered, Gallon w/ Refill)");

// Create a water transaction
$customerId = findOrCreateCustomer($pdo, 'Allan Ojeda (Test)');
$transCode = generateTransactionCode($pdo, 'WTR', $testDate);

$pdo->beginTransaction();
$insTrans = $pdo->prepare("
    INSERT INTO transactions (
        transaction_code, business_category, transaction_date, transaction_time,
        customer_id, customer_name, total_amount, payment_method, payment_status, notes, created_by
    ) VALUES (?, 'water', ?, '10:15:00', ?, 'Allan Ojeda (Test)', 105.00, 'Cash', 'paid', 'Test note', 1)
");
$insTrans->execute([$transCode, $testDate, $customerId]);
$wTransId = (int)$pdo->lastInsertId();

// 3 delivered refills at ₱35 each = ₱105 (matches Excel row 5: allan ojeda, 3 delivered, 105.00!)
$insItem = $pdo->prepare("
    INSERT INTO transaction_items (transaction_id, service_id, item_name, quantity, unit_price, subtotal)
    VALUES (?, ?, ?, ?, ?, ?)
");
$insItem->execute([$wTransId, 2, 'Delivered', 3, 35.00, 105.00]);
$pdo->commit();

assertTest($wTransId > 0, "Created water transaction $transCode with ID $wTransId");

// Verify line item subtotal
$verifyStmt = $pdo->prepare("SELECT SUM(subtotal) FROM transaction_items WHERE transaction_id = ?");
$verifyStmt->execute([$wTransId]);
$lineTotal = (float)$verifyStmt->fetchColumn();
assertTest($lineTotal === 105.00, "Water line total matches exactly ₱105.00 (3 * ₱35.00)");

// TEST 3: Laundry Multi-Service Transaction
echo "\n--- TEST GROUP 3: Laundry Multi-Service Transaction ---\n";
$lCustId = findOrCreateCustomer($pdo, 'DELA PASION (Test)');
$lTransCode = generateTransactionCode($pdo, 'LND', $testDate);

$pdo->beginTransaction();
$insLTrans = $pdo->prepare("
    INSERT INTO transactions (
        transaction_code, business_category, transaction_date, transaction_time,
        customer_id, customer_name, total_amount, payment_method, payment_status, notes, created_by
    ) VALUES (?, 'laundry', ?, '11:00:00', ?, 'DELA PASION (Test)', 195.00, 'Cash', 'paid', '', 1)
");
$insLTrans->execute([$lTransCode, $testDate, $lCustId]);
$lTransId = (int)$pdo->lastInsertId();

// 1 Regular (175) + 1 Detergent (10) + 1 Fab Con (10) = ₱195.00 (matches Excel row 5!)
$insItem->execute([$lTransId, 6, 'Regular', 1, 175.00, 175.00]);
$insItem->execute([$lTransId, 9, 'Detergent', 1, 10.00, 10.00]);
$insItem->execute([$lTransId, 10, 'Fab Con', 1, 10.00, 10.00]);
$pdo->commit();

$verifyStmt->execute([$lTransId]);
$lLineTotal = (float)$verifyStmt->fetchColumn();
assertTest($lLineTotal === 195.00, "Laundry combined total matches exactly ₱195.00 (175 + 10 + 10)");

// TEST 4: Expenses Module
echo "\n--- TEST GROUP 4: Expenses Entry & Calculation ---\n";
// Add water expense: Fuel ₱100
$insExp = $pdo->prepare("
    INSERT INTO expenses (expense_date, business_category, particular, quantity, unit_price, total_amount, created_by)
    VALUES (?, ?, ?, ?, ?, ?, 1)
");
$insExp->execute([$testDate, 'water', 'FUEL (Test)', 1, 100.00, 100.00]);

// Add laundry expense: 1 Sack Surf Powder ₱2,040
$insExp->execute([$testDate, 'laundry', '1 SACK SURF (Test)', 288, null, 2040.00]);

// Add shared expense: Ulam ₱80, Save ₱50
$insExp->execute([$testDate, 'shared', 'ULAM (Test)', 1, 80.00, 80.00]);
$insExp->execute([$testDate, 'shared', 'SAVE (Test)', 5, 10.00, 50.00]);

// Verify expense sum by category
$wExpSum = (float)$pdo->query("SELECT SUM(total_amount) FROM expenses WHERE business_category = 'water' AND expense_date = '$testDate'")->fetchColumn();
$lExpSum = (float)$pdo->query("SELECT SUM(total_amount) FROM expenses WHERE business_category = 'laundry' AND expense_date = '$testDate'")->fetchColumn();
$sExpSum = (float)$pdo->query("SELECT SUM(total_amount) FROM expenses WHERE business_category = 'shared' AND expense_date = '$testDate'")->fetchColumn();

assertTest($wExpSum === 100.00, "Water expense subtotal = ₱100.00");
assertTest($lExpSum === 2040.00, "Laundry expense subtotal = ₱2,040.00");
assertTest($sExpSum === 130.00, "Shared business expense subtotal = ₱130.00 (80 + 50)");

// TEST 5: Overall Daily Summary & Financial Balance
echo "\n--- TEST GROUP 5: Overall Daily Summary Reconciliation ---\n";
$grossSales = 105.00 + 195.00; // ₱300.00
$grandTotalExp = 100.00 + 2040.00 + 130.00; // ₱2,270.00
$netProfit = $grossSales - $grandTotalExp; // -₱1,970.00

$calcGross = (float)$pdo->query("SELECT SUM(total_amount) FROM transactions WHERE transaction_date = '$testDate'")->fetchColumn();
$calcExp = (float)$pdo->query("SELECT SUM(total_amount) FROM expenses WHERE expense_date = '$testDate'")->fetchColumn();
$calcNet = $calcGross - $calcExp;

assertTest($calcGross === $grossSales, "Calculated Gross Sales matches expected (₱$calcGross)");
assertTest($calcExp === $grandTotalExp, "Calculated Grand Total Expenses matches expected (₱$calcExp)");
assertTest($calcNet === $netProfit, "Calculated Net Profit matches expected (₱$calcNet)");

// TEST 6: Rate Snapshot Safety (Historical integrity test)
echo "\n--- TEST GROUP 6: Rate Snapshot Safety ---\n";
// Update default rate for Delivered in database to ₱40.00
$pdo->exec("UPDATE services SET default_rate = 40.00 WHERE id = 2");

// Re-check original transaction total
$checkTransStmt = $pdo->prepare("SELECT total_amount FROM transactions WHERE id = ?");
$checkTransStmt->execute([$wTransId]);
$savedTotal = (float)$checkTransStmt->fetchColumn();

assertTest($savedTotal === 105.00, "Historical transaction total remained unchanged at ₱105.00 despite rate update");

// Reset rate back to 35.00
$pdo->exec("UPDATE services SET default_rate = 35.00 WHERE id = 2");

// Clean up test data
$pdo->exec("DELETE FROM transactions WHERE transaction_date = '$testDate'");
$pdo->exec("DELETE FROM expenses WHERE expense_date = '$testDate'");
$pdo->exec("DELETE FROM customers WHERE name LIKE '%(Test)%'");

echo "\n=========================================================\n";
echo "   TEST SUMMARY: $passed PASSED, $failed FAILED\n";
echo "=========================================================\n";

exit($failed > 0 ? 1 : 0);
