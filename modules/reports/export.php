<?php
/**
 * PAZINGS INVENTORY & SALES MANAGEMENT SYSTEM
 * Export Reports to Excel-Compatible CSV Format (with UTF-8 BOM for Microsoft Excel)
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/functions.php';

requireLogin();
$pdo = getDbConnection();

$type = $_GET['type'] ?? 'daily_summary';
$date = $_GET['date'] ?? date('Y-m-d');
$startDate = $_GET['start'] ?? $date;
$endDate = $_GET['end'] ?? $date;

// Clean output buffer to ensure clean file download
if (ob_get_level()) {
    ob_end_clean();
}

$filename = "PAZINGS_" . strtoupper($type) . "_" . date('Ymd_His') . ".csv";

header('Content-Type: text/csv; charset=UTF-8');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Pragma: no-cache');
header('Expires: 0');

$output = fopen('php://output', 'w');

// Output UTF-8 BOM for Microsoft Excel compatibility
fprintf($output, chr(0xEF) . chr(0xBB) . chr(0xBF));

if ($type === 'water') {
    // Water Daily Export
    fputcsv($output, [APP_NAME]);
    fputcsv($output, ['WATER REFILLING STATION - DAILY TRANSACTIONS']);
    fputcsv($output, ['Date:', $date]);
    fputcsv($output, []); // empty row

    $services = getServicesByCategory($pdo, 'water');
    $headerRow = ['No.', 'Code', 'Time', 'Customer Name'];
    foreach ($services as $srv) {
        $headerRow[] = $srv['service_name'] . ' (Qty)';
    }
    $headerRow[] = 'Other Items';
    $headerRow[] = 'Amount (PHP)';
    $headerRow[] = 'Payment Method';
    $headerRow[] = 'Payment Status';
    $headerRow[] = 'Notes';
    fputcsv($output, $headerRow);

    $stmt = $pdo->prepare("
        SELECT id, transaction_code, transaction_time, customer_name, total_amount, payment_method, payment_status, notes 
        FROM transactions 
        WHERE business_category = 'water' AND transaction_date = ?
        ORDER BY transaction_time ASC
    ");
    $stmt->execute([$date]);
    $rows = $stmt->fetchAll();

    $totalSales = 0;
    $no = 1;
    foreach ($rows as $r) {
        // Fetch items
        $iStmt = $pdo->prepare("SELECT service_id, item_name, quantity FROM transaction_items WHERE transaction_id = ?");
        $iStmt->execute([$r['id']]);
        $items = $iStmt->fetchAll();

        $map = [];
        $others = [];
        foreach ($items as $it) {
            if ($it['service_id']) {
                $map[$it['service_id']] = (float)$it['quantity'];
            } else {
                $others[] = $it['item_name'] . " (" . (float)$it['quantity'] . ")";
            }
        }

        $line = [
            $no++,
            $r['transaction_code'],
            $r['transaction_time'],
            $r['customer_name']
        ];
        foreach ($services as $srv) {
            $line[] = $map[$srv['id']] ?? 0;
        }
        $line[] = implode(', ', $others);
        $line[] = number_format((float)$r['total_amount'], 2, '.', '');
        $line[] = $r['payment_method'];
        $line[] = $r['payment_status'];
        $line[] = $r['notes'];
        fputcsv($output, $line);

        $totalSales += (float)$r['total_amount'];
    }

    fputcsv($output, []);
    $sumRow = ['TOTAL WATER SALES:', '', '', ''];
    foreach ($services as $srv) {
        $sumRow[] = '';
    }
    $sumRow[] = '';
    $sumRow[] = number_format($totalSales, 2, '.', '');
    fputcsv($output, $sumRow);

} elseif ($type === 'laundry') {
    // Laundry Daily Export
    fputcsv($output, [APP_NAME]);
    fputcsv($output, ['LAUNDRY SHOP - DAILY TRANSACTIONS']);
    fputcsv($output, ['Date:', $date]);
    fputcsv($output, []);

    $services = getServicesByCategory($pdo, 'laundry');
    $headerRow = ['No.', 'Code', 'Time', 'Customer Name'];
    foreach ($services as $srv) {
        $headerRow[] = $srv['service_name'] . ' (Qty)';
    }
    $headerRow[] = 'Other Items';
    $headerRow[] = 'Amount (PHP)';
    $headerRow[] = 'Payment Method';
    $headerRow[] = 'Payment Status';
    $headerRow[] = 'Notes';
    fputcsv($output, $headerRow);

    $stmt = $pdo->prepare("
        SELECT id, transaction_code, transaction_time, customer_name, total_amount, payment_method, payment_status, notes 
        FROM transactions 
        WHERE business_category = 'laundry' AND transaction_date = ?
        ORDER BY transaction_time ASC
    ");
    $stmt->execute([$date]);
    $rows = $stmt->fetchAll();

    $totalSales = 0;
    $no = 1;
    foreach ($rows as $r) {
        $iStmt = $pdo->prepare("SELECT service_id, item_name, quantity FROM transaction_items WHERE transaction_id = ?");
        $iStmt->execute([$r['id']]);
        $items = $iStmt->fetchAll();

        $map = [];
        $others = [];
        foreach ($items as $it) {
            if ($it['service_id']) {
                $map[$it['service_id']] = (float)$it['quantity'];
            } else {
                $others[] = $it['item_name'] . " (" . (float)$it['quantity'] . ")";
            }
        }

        $line = [
            $no++,
            $r['transaction_code'],
            $r['transaction_time'],
            $r['customer_name']
        ];
        foreach ($services as $srv) {
            $line[] = $map[$srv['id']] ?? 0;
        }
        $line[] = implode(', ', $others);
        $line[] = number_format((float)$r['total_amount'], 2, '.', '');
        $line[] = $r['payment_method'];
        $line[] = $r['payment_status'];
        $line[] = $r['notes'];
        fputcsv($output, $line);

        $totalSales += (float)$r['total_amount'];
    }

    fputcsv($output, []);
    $sumRow = ['TOTAL LAUNDRY SALES:', '', '', ''];
    foreach ($services as $srv) {
        $sumRow[] = '';
    }
    $sumRow[] = '';
    $sumRow[] = number_format($totalSales, 2, '.', '');
    fputcsv($output, $sumRow);

} elseif ($type === 'expenses') {
    // Expenses Export
    fputcsv($output, [APP_NAME]);
    fputcsv($output, ['BUSINESS EXPENSES REPORT']);
    fputcsv($output, ['Date:', $date]);
    fputcsv($output, []);

    fputcsv($output, ['No.', 'Category', 'Particular', 'Qty', 'Unit Price (PHP)', 'Total Amount (PHP)', 'Notes']);

    $stmt = $pdo->prepare("
        SELECT business_category, particular, quantity, unit_price, total_amount, notes 
        FROM expenses 
        WHERE expense_date = ?
        ORDER BY business_category ASC, id ASC
    ");
    $stmt->execute([$date]);
    $rows = $stmt->fetchAll();

    $tot = 0;
    $no = 1;
    foreach ($rows as $r) {
        fputcsv($output, [
            $no++,
            ucfirst($r['business_category']),
            $r['particular'],
            $r['quantity'] !== null ? $r['quantity'] : '',
            $r['unit_price'] !== null ? number_format((float)$r['unit_price'], 2, '.', '') : '',
            number_format((float)$r['total_amount'], 2, '.', ''),
            $r['notes']
        ]);
        $tot += (float)$r['total_amount'];
    }

    fputcsv($output, []);
    fputcsv($output, ['TOTAL EXPENSES:', '', '', '', '', number_format($tot, 2, '.', '')]);

} else {
    // Overall Daily Business Summary Export
    fputcsv($output, [APP_NAME]);
    fputcsv($output, ['OVERALL DAILY BUSINESS SUMMARY']);
    fputcsv($output, ['Date:', $date]);
    fputcsv($output, []);

    // Query Totals
    $wSales = (float)$pdo->query("SELECT COALESCE(SUM(total_amount), 0) FROM transactions WHERE business_category = 'water' AND transaction_date = '$date'")->fetchColumn();
    $lSales = (float)$pdo->query("SELECT COALESCE(SUM(total_amount), 0) FROM transactions WHERE business_category = 'laundry' AND transaction_date = '$date'")->fetchColumn();
    $totSales = $wSales + $lSales;

    $wPaid = (float)$pdo->query("SELECT COALESCE(SUM(total_amount), 0) FROM transactions WHERE business_category = 'water' AND payment_status = 'paid' AND transaction_date = '$date'")->fetchColumn();
    $lPaid = (float)$pdo->query("SELECT COALESCE(SUM(total_amount), 0) FROM transactions WHERE business_category = 'laundry' AND payment_status = 'paid' AND transaction_date = '$date'")->fetchColumn();
    $totPaid = $wPaid + $lPaid;
    $totUnpaid = (float)$pdo->query("SELECT COALESCE(SUM(total_amount), 0) FROM transactions WHERE payment_status = 'unpaid' AND transaction_date = '$date'")->fetchColumn();

    $wExp = (float)$pdo->query("SELECT COALESCE(SUM(total_amount), 0) FROM expenses WHERE business_category = 'water' AND expense_date = '$date'")->fetchColumn();
    $lExp = (float)$pdo->query("SELECT COALESCE(SUM(total_amount), 0) FROM expenses WHERE business_category = 'laundry' AND expense_date = '$date'")->fetchColumn();
    $sExp = (float)$pdo->query("SELECT COALESCE(SUM(total_amount), 0) FROM expenses WHERE business_category = 'shared' AND expense_date = '$date'")->fetchColumn();
    $totExp = $wExp + $lExp + $sExp;
    $netCashFlow = $totPaid - $totExp;
    $netProfit = $totSales - $totExp;

    fputcsv($output, ['ACCOUNT / PARTICULAR', 'AMOUNT (PHP)']);
    fputcsv($output, ['Water Refilling Gross Sales', number_format($wSales, 2, '.', '')]);
    fputcsv($output, ['Laundry Shop Gross Sales', number_format($lSales, 2, '.', '')]);
    fputcsv($output, ['TOTAL GROSS SALES (Services Sold)', number_format($totSales, 2, '.', '')]);
    fputcsv($output, []);
    fputcsv($output, ['Paid Sales / Collections (Actual Cash)', number_format($totPaid, 2, '.', '')]);
    fputcsv($output, ['Unpaid Balance (Receivables Owed)', number_format($totUnpaid, 2, '.', '')]);
    fputcsv($output, []);
    fputcsv($output, ['Water Refilling Expenses', number_format($wExp, 2, '.', '')]);
    fputcsv($output, ['Laundry Expenses', number_format($lExp, 2, '.', '')]);
    fputcsv($output, ['Overall Shared Expenses', number_format($sExp, 2, '.', '')]);
    fputcsv($output, ['GRAND TOTAL EXPENSES', number_format($totExp, 2, '.', '')]);
    fputcsv($output, []);
    fputcsv($output, ['NET CASH FLOW (Collections - Expenses)', number_format($netCashFlow, 2, '.', '')]);
    fputcsv($output, ['ESTIMATED NET PROFIT (Accrual)', number_format($netProfit, 2, '.', '')]);
}

fclose($output);
exit;
