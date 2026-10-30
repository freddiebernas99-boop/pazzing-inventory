<?php
/**
 * PAZINGS INVENTORY & SALES MANAGEMENT SYSTEM
 * Overall Daily Business Summary (Exact Reproduction of Excel Sheet)
 * Minimal Blue & White Theme (No Emojis)
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/csrf.php';
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/functions.php';

requireLogin();
$pdo = getDbConnection();
$currentUser = getCurrentUser();

$pageTitle = 'Daily Summary';
$today = date('Y-m-d');
$filterDate = $_GET['date'] ?? $today;

// Handle payment status toggle
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'toggle_payment') {
    validateCsrfOrDie();
    $transId = (int)($_POST['transaction_id'] ?? 0);
    if ($transId > 0) {
        $pdo->prepare("
            UPDATE transactions
            SET payment_status = CASE WHEN payment_status = 'paid' THEN 'unpaid' ELSE 'paid' END
            WHERE id = ?
        ")->execute([$transId]);
        setFlash('success', 'Transaction payment status updated.');
    }
    header("Location: daily.php?date=" . urlencode($filterDate));
    exit;
}

// Fetch all transactions for selected date with item summaries
$txStmt = $pdo->prepare("
    SELECT t.id, t.transaction_code, t.business_category, t.transaction_time,
           t.customer_name, t.total_amount, t.payment_status, t.notes,
           GROUP_CONCAT(CONCAT(ti.item_name, ' (', TRIM(TRAILING '.00' FROM CAST(ti.quantity AS CHAR)), ' x ', FORMAT(ti.unit_price, 2), ')') SEPARATOR ', ') AS items_summary
    FROM transactions t
    LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
    WHERE t.transaction_date = ?
    GROUP BY t.id
    ORDER BY t.transaction_time DESC, t.id DESC
");
$txStmt->execute([$filterDate]);
$allTransactions = $txStmt->fetchAll();

$waterTransactions = [];
$laundryTransactions = [];
$waterSales = 0.0;
$laundrySales = 0.0;
$waterPaid = 0.0;
$laundryPaid = 0.0;
$waterUnpaid = 0.0;
$laundryUnpaid = 0.0;

foreach ($allTransactions as $tx) {
    $amt = (float)$tx['total_amount'];
    $isPaid = ($tx['payment_status'] === 'paid');
    if ($tx['business_category'] === 'water') {
        $waterTransactions[] = $tx;
        $waterSales += $amt;
        if ($isPaid) $waterPaid += $amt;
        else $waterUnpaid += $amt;
    } elseif ($tx['business_category'] === 'laundry') {
        $laundryTransactions[] = $tx;
        $laundrySales += $amt;
        if ($isPaid) $laundryPaid += $amt;
        else $laundryUnpaid += $amt;
    }
}

$totalSales = $waterSales + $laundrySales;
$paidCollections = $waterPaid + $laundryPaid;
$unpaidBalance = $waterUnpaid + $laundryUnpaid;

// 3. Water Expenses
$waterExpStmt = $pdo->prepare("
    SELECT COALESCE(SUM(total_amount), 0) FROM expenses 
    WHERE business_category = 'water' AND expense_date = ?
");
$waterExpStmt->execute([$filterDate]);
$waterExpenses = (float)$waterExpStmt->fetchColumn();

// 4. Laundry Expenses
$laundryExpStmt = $pdo->prepare("
    SELECT COALESCE(SUM(total_amount), 0) FROM expenses 
    WHERE business_category = 'laundry' AND expense_date = ?
");
$laundryExpStmt->execute([$filterDate]);
$laundryExpenses = (float)$laundryExpStmt->fetchColumn();

// 5. Overall Shared Business Expenses
$sharedExpStmt = $pdo->prepare("
    SELECT COALESCE(SUM(total_amount), 0) FROM expenses 
    WHERE business_category = 'shared' AND expense_date = ?
");
$sharedExpStmt->execute([$filterDate]);
$sharedExpenses = (float)$sharedExpStmt->fetchColumn();

$grandTotalExpenses = $waterExpenses + $laundryExpenses + $sharedExpenses;
$netCashFlow = $paidCollections - $grandTotalExpenses;
$netProfit = $totalSales - $grandTotalExpenses;

// Shared expense line items
$sharedItemsStmt = $pdo->prepare("
    SELECT particular, quantity, unit_price, total_amount, notes 
    FROM expenses 
    WHERE business_category = 'shared' AND expense_date = ?
    ORDER BY id ASC
");
$sharedItemsStmt->execute([$filterDate]);
$sharedItems = $sharedItemsStmt->fetchAll();

require_once __DIR__ . '/../../includes/header.php';
?>

<div class="page-header">
    <div>
        <h1 class="page-title">Daily Business Summary</h1>
        <p class="page-subtitle"><?= formatDate($filterDate, 'l, F j, Y') ?></p>
    </div>
    <div style="display: flex; gap: 8px;">
        <a href="export.php?type=daily_summary&date=<?= urlencode($filterDate) ?>&format=csv" class="btn btn-secondary btn-sm">
            Export CSV
        </a>
        <button type="button" onclick="window.print()" class="btn btn-secondary btn-sm">
            Print / PDF
        </button>
        <?php if (isOwner()): ?>
            <a href="custom.php" class="btn btn-navy btn-sm">Periodic Reports</a>
        <?php endif; ?>
    </div>
</div>

<!-- Print Header -->
<div class="print-header">
    <h1>PAZINGS MANAGEMENT</h1>
    <p>OVERALL DAILY BUSINESS SUMMARY</p>
    <p>Report Date: <?= formatDate($filterDate, 'F j, Y') ?></p>
</div>

<!-- Compact Date Filter -->
<div class="filter-bar no-print">
    <form method="GET" action="daily.php" style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
        <label style="font-size: 0.85rem; font-weight: 600;">Date:</label>
        <input type="date" name="date" class="form-control" style="width: auto; min-height: 32px; padding: 4px 8px;" value="<?= e($filterDate) ?>">
        <button type="submit" class="btn btn-primary btn-sm">Load</button>
        <?php if ($filterDate !== $today): ?>
            <a href="daily.php" class="btn btn-secondary btn-sm">Today</a>
        <?php endif; ?>
        
        <?php 
        $prevDate = date('Y-m-d', strtotime($filterDate . ' -1 day'));
        $nextDate = date('Y-m-d', strtotime($filterDate . ' +1 day'));
        ?>
        <a href="daily.php?date=<?= $prevDate ?>" class="btn btn-secondary btn-sm">Previous Day</a>
        <a href="daily.php?date=<?= $nextDate ?>" class="btn btn-secondary btn-sm">Next Day</a>
    </form>
</div>

<!-- Split Statement Layout -->
<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px;">
    
    <!-- Left Column: Financial Statement -->
    <div class="card">
        <div class="card-header">
            <h2 class="card-title">Daily Financial Statement</h2>
            <span style="font-size: 0.8rem; color: var(--navy); font-weight: 600;"><?= formatDate($filterDate, 'M d, Y') ?></span>
        </div>

        <table class="data-table" style="font-size: 0.9rem;">
            <thead>
                <tr>
                    <th>Account / Particular</th>
                    <th style="text-align: right;">Amount</th>
                </tr>
            </thead>
            <tbody>
                <tr style="background: var(--bg-page); font-weight: 600; font-size: 0.78rem; color: var(--navy); text-transform: uppercase;">
                    <td colspan="2">Gross Sales (Services Sold)</td>
                </tr>
                <tr>
                    <td>Water Refilling Gross Sales</td>
                    <td style="text-align: right; font-weight: 600;"><?= formatCurrency($waterSales) ?></td>
                </tr>
                <tr>
                    <td>Laundry Shop Gross Sales</td>
                    <td style="text-align: right; font-weight: 600;"><?= formatCurrency($laundrySales) ?></td>
                </tr>
                <tr style="background: var(--blue-light); font-weight: 700;">
                    <td>TOTAL GROSS SALES</td>
                    <td style="text-align: right; color: var(--navy); font-size: 1rem;">
                        <?= formatCurrency($totalSales) ?>
                    </td>
                </tr>

                <!-- Collections & Receivables Breakdown -->
                <tr style="background: var(--bg-page); font-weight: 600; font-size: 0.78rem; color: var(--navy); text-transform: uppercase;">
                    <td colspan="2" style="padding-top: 12px;">Payment Status Breakdown</td>
                </tr>
                <tr>
                    <td style="color: var(--success); font-weight: 500;">
                        Paid Sales / Collections (Actual Cash)
                        <div style="font-size: 0.76rem; color: var(--text-muted); font-weight: 400;">
                            Water: <strong><?= formatCurrency($waterPaid) ?></strong> &bull; Laundry: <strong><?= formatCurrency($laundryPaid) ?></strong>
                        </div>
                    </td>
                    <td style="text-align: right; font-weight: 600; color: var(--success);"><?= formatCurrency($paidCollections) ?></td>
                </tr>
                <tr>
                    <td style="color: #974F0C; font-weight: 500;">
                        Unpaid Balance (Receivables Owed)
                        <div style="font-size: 0.76rem; color: var(--text-muted); font-weight: 400;">
                            Water: <strong><?= formatCurrency($waterUnpaid) ?></strong> &bull; Laundry: <strong><?= formatCurrency($laundryUnpaid) ?></strong>
                        </div>
                    </td>
                    <td style="text-align: right; font-weight: 600; color: #974F0C;"><?= formatCurrency($unpaidBalance) ?></td>
                </tr>

                <!-- Business Expenses -->
                <tr style="background: var(--bg-page); font-weight: 600; font-size: 0.78rem; color: var(--navy); text-transform: uppercase;">
                    <td colspan="2" style="padding-top: 14px;">Business Expenses</td>
                </tr>
                <tr>
                    <td>Water Refilling Expenses</td>
                    <td style="text-align: right; color: var(--danger);"><?= formatCurrency($waterExpenses) ?></td>
                </tr>
                <tr>
                    <td>Laundry Shop Expenses</td>
                    <td style="text-align: right; color: var(--danger);"><?= formatCurrency($laundryExpenses) ?></td>
                </tr>
                <tr>
                    <td>Overall Shared Expenses</td>
                    <td style="text-align: right; color: var(--danger);"><?= formatCurrency($sharedExpenses) ?></td>
                </tr>
                <tr style="background: var(--danger-bg); font-weight: 700;">
                    <td>GRAND TOTAL EXPENSES</td>
                    <td style="text-align: right; color: var(--danger); font-size: 1rem;">
                        <?= formatCurrency($grandTotalExpenses) ?>
                    </td>
                </tr>

                <!-- Summary Performance & Cash Flow -->
                <tr style="background: var(--bg-page); font-weight: 600; font-size: 0.78rem; color: var(--navy); text-transform: uppercase;">
                    <td colspan="2" style="padding-top: 14px;">Summary Performance</td>
                </tr>
                <tr style="border-top: 1px solid var(--border);">
                    <td style="font-weight: 600;">Net Cash Flow (Collections &minus; Expenses)</td>
                    <td style="text-align: right; font-weight: 700; font-size: 1rem; color: <?= $netCashFlow >= 0 ? 'var(--navy)' : 'var(--danger)' ?>;">
                        <?= formatCurrency($netCashFlow) ?>
                    </td>
                </tr>
                <tr style="border-top: 2px solid var(--border-dark); background: <?= $netProfit >= 0 ? 'var(--success-bg)' : 'var(--danger-bg)' ?>;">
                    <td style="padding: 12px 10px; font-weight: 700; color: <?= $netProfit >= 0 ? 'var(--success)' : 'var(--danger)' ?>;">
                        <?= $netProfit >= 0 ? 'ESTIMATED NET PROFIT (Accrual)' : 'NET OPERATING LOSS' ?>
                    </td>
                    <td style="padding: 12px 10px; text-align: right; font-size: 1.25rem; font-weight: 700; color: <?= $netProfit >= 0 ? 'var(--success)' : 'var(--danger)' ?>;">
                        <?= formatCurrency($netProfit) ?>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>

    <!-- Right Column: Shared Business Expenses Breakdown -->
    <div class="card">
        <div class="card-header">
            <h2 class="card-title">Shared Business Expenses Breakdown</h2>
            <span style="font-size: 0.8rem; color: var(--text-muted);"><?= count($sharedItems) ?> item(s)</span>
        </div>

        <div class="table-responsive">
            <table class="data-table">
                <thead>
                    <tr>
                        <th style="width: 35px;">No.</th>
                        <th>Particular</th>
                        <th style="text-align: center;">Qty</th>
                        <th style="text-align: right;">Price</th>
                        <th style="text-align: right;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (empty($sharedItems)): ?>
                        <tr>
                            <td colspan="5" style="text-align: center; padding: 24px; color: var(--text-muted);">
                                No shared business expenses recorded for this date.
                            </td>
                        </tr>
                    <?php else: ?>
                        <?php 
                        $no = 1;
                        foreach ($sharedItems as $si): 
                        ?>
                            <tr>
                                <td><?= $no++ ?></td>
                                <td><strong><?= e($si['particular']) ?></strong></td>
                                <td style="text-align: center;"><?= $si['quantity'] !== null ? (float)$si['quantity'] : '-' ?></td>
                                <td style="text-align: right;"><?= $si['unit_price'] !== null ? formatCurrency($si['unit_price']) : '-' ?></td>
                                <td style="text-align: right; font-weight: 600; color: var(--danger);">
                                    <?= formatCurrency($si['total_amount']) ?>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                        <tr class="table-total-row">
                            <td colspan="4" style="text-align: right;">TOTAL:</td>
                            <td style="text-align: right; color: var(--danger); font-size: 0.95rem;">
                                <?= formatCurrency($sharedExpenses) ?>
                            </td>
                        </tr>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>
    </div>
</div>

<!-- Side-by-Side Daily Transactions Breakdown: Water Refilling & Laundry -->
<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; margin-top: 16px;">
    <!-- Left Card: Water Refilling Daily Transactions -->
    <div class="card">
        <div class="card-header">
            <h2 class="card-title">Water Refilling Daily Transactions</h2>
            <span style="font-size: 0.8rem; color: var(--text-muted);"><?= count($waterTransactions) ?> records</span>
        </div>
        <div class="table-responsive">
            <table class="data-table">
                <thead>
                    <tr>
                        <th style="width: 35px;">No.</th>
                        <th>Time</th>
                        <th>Customer</th>
                        <th>Items</th>
                        <th style="text-align: right;">Amount</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (empty($waterTransactions)): ?>
                        <tr>
                            <td colspan="6" style="text-align: center; padding: 24px; color: var(--text-muted);">
                                No water transactions recorded for this date.
                            </td>
                        </tr>
                    <?php else: ?>
                        <?php $wNo = 1; foreach ($waterTransactions as $wt): ?>
                            <tr>
                                <td><?= $wNo++ ?></td>
                                <td style="color: var(--text-muted); font-size: 0.8rem;"><?= date('h:i A', strtotime($wt['transaction_time'])) ?></td>
                                <td>
                                    <strong><?= e($wt['customer_name']) ?></strong>
                                    <div style="font-size: 0.72rem; color: var(--text-muted);"><?= e($wt['transaction_code']) ?><?= !empty($wt['notes']) ? ' — ' . e($wt['notes']) : '' ?></div>
                                </td>
                                <td style="font-size: 0.82rem; color: var(--text-muted);"><?= e($wt['items_summary'] ?: 'Refill') ?></td>
                                <td style="text-align: right; font-weight: 700; color: var(--navy);"><?= formatCurrency($wt['total_amount']) ?></td>
                                <td>
                                    <form method="POST" action="daily.php?date=<?= urlencode($filterDate) ?>" style="display:inline;">
                                        <?= getCsrfInput() ?>
                                        <input type="hidden" name="action" value="toggle_payment">
                                        <input type="hidden" name="transaction_id" value="<?= (int)$wt['id'] ?>">
                                        <button type="submit" class="badge badge-<?= $wt['payment_status'] === 'paid' ? 'paid' : 'unpaid' ?>" style="border:none; cursor:pointer;" title="Click to toggle payment status">
                                            <?= ucfirst(e($wt['payment_status'])) ?>
                                        </button>
                                    </form>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>
    </div>

    <!-- Right Card: Laundry Daily Transactions -->
    <div class="card">
        <div class="card-header">
            <h2 class="card-title">Laundry Daily Transactions</h2>
            <span style="font-size: 0.8rem; color: var(--text-muted);"><?= count($laundryTransactions) ?> records</span>
        </div>
        <div class="table-responsive">
            <table class="data-table">
                <thead>
                    <tr>
                        <th style="width: 35px;">No.</th>
                        <th>Time</th>
                        <th>Customer</th>
                        <th>Services / Items</th>
                        <th style="text-align: right;">Amount</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (empty($laundryTransactions)): ?>
                        <tr>
                            <td colspan="6" style="text-align: center; padding: 24px; color: var(--text-muted);">
                                No laundry transactions recorded for this date.
                            </td>
                        </tr>
                    <?php else: ?>
                        <?php $lNo = 1; foreach ($laundryTransactions as $lt): ?>
                            <tr>
                                <td><?= $lNo++ ?></td>
                                <td style="color: var(--text-muted); font-size: 0.8rem;"><?= date('h:i A', strtotime($lt['transaction_time'])) ?></td>
                                <td>
                                    <strong><?= e($lt['customer_name']) ?></strong>
                                    <div style="font-size: 0.72rem; color: var(--text-muted);"><?= e($lt['transaction_code']) ?><?= !empty($lt['notes']) ? ' — ' . e($lt['notes']) : '' ?></div>
                                </td>
                                <td style="font-size: 0.82rem; color: var(--text-muted);"><?= e($lt['items_summary'] ?: 'Laundry') ?></td>
                                <td style="text-align: right; font-weight: 700; color: var(--navy);"><?= formatCurrency($lt['total_amount']) ?></td>
                                <td>
                                    <form method="POST" action="daily.php?date=<?= urlencode($filterDate) ?>" style="display:inline;">
                                        <?= getCsrfInput() ?>
                                        <input type="hidden" name="action" value="toggle_payment">
                                        <input type="hidden" name="transaction_id" value="<?= (int)$lt['id'] ?>">
                                        <button type="submit" class="badge badge-<?= $lt['payment_status'] === 'paid' ? 'paid' : 'unpaid' ?>" style="border:none; cursor:pointer;" title="Click to toggle payment status">
                                            <?= ucfirst(e($lt['payment_status'])) ?>
                                        </button>
                                    </form>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>
    </div>
</div>

<?php require_once __DIR__ . '/../../includes/footer.php'; ?>
