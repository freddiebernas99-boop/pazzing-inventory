<?php
/**
 * PAZINGS INVENTORY & SALES MANAGEMENT SYSTEM
 * Periodic Financial Reports (Weekly, Monthly, Custom Range)
 * Minimal Blue & White Theme (No Emojis)
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/csrf.php';
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/functions.php';

requireRole('owner');
$pdo = getDbConnection();
$currentUser = getCurrentUser();

$pageTitle = 'Periodic Reports';

$preset = $_GET['preset'] ?? 'this_month';
$today = date('Y-m-d');

if ($preset === 'this_week') {
    $startDate = date('Y-m-d', strtotime('monday this week'));
    $endDate = date('Y-m-d', strtotime('sunday this week'));
    $reportTitle = 'This Week (' . formatDate($startDate, 'M d') . ' - ' . formatDate($endDate, 'M d, Y') . ')';
} elseif ($preset === 'last_month') {
    $startDate = date('Y-m-01', strtotime('first day of last month'));
    $endDate = date('Y-m-t', strtotime('last day of last month'));
    $reportTitle = 'Last Month (' . date('F Y', strtotime('last month')) . ')';
} elseif ($preset === 'custom' && !empty($_GET['start']) && !empty($_GET['end'])) {
    $startDate = $_GET['start'];
    $endDate = $_GET['end'];
    $reportTitle = 'Custom Range (' . formatDate($startDate, 'M d, Y') . ' - ' . formatDate($endDate, 'M d, Y') . ')';
} else {
    $preset = 'this_month';
    $startDate = date('Y-m-01');
    $endDate = date('Y-m-t');
    $reportTitle = 'This Month (' . date('F Y') . ')';
}

// 1. Overall Totals in Range
$stmt = $pdo->prepare("
    SELECT 
        COALESCE(SUM(CASE WHEN business_category = 'water' THEN total_amount ELSE 0 END), 0) AS water_sales,
        COALESCE(SUM(CASE WHEN business_category = 'laundry' THEN total_amount ELSE 0 END), 0) AS laundry_sales,
        COALESCE(SUM(total_amount), 0) AS total_sales,
        COUNT(*) AS trans_count
    FROM transactions
    WHERE transaction_date BETWEEN ? AND ?
");
$stmt->execute([$startDate, $endDate]);
$salesSummary = $stmt->fetch();

$stmt = $pdo->prepare("
    SELECT 
        COALESCE(SUM(CASE WHEN business_category = 'water' THEN total_amount ELSE 0 END), 0) AS water_exp,
        COALESCE(SUM(CASE WHEN business_category = 'laundry' THEN total_amount ELSE 0 END), 0) AS laundry_exp,
        COALESCE(SUM(CASE WHEN business_category = 'shared' THEN total_amount ELSE 0 END), 0) AS shared_exp,
        COALESCE(SUM(total_amount), 0) AS total_exp
    FROM expenses
    WHERE expense_date BETWEEN ? AND ?
");
$stmt->execute([$startDate, $endDate]);
$expSummary = $stmt->fetch();

$netIncome = (float)$salesSummary['total_sales'] - (float)$expSummary['total_exp'];

// 2. Day-by-day Breakdown Table
$dailyStmt = $pdo->prepare("
    SELECT 
        d.report_date,
        COALESCE(t.water_sales, 0) AS water_sales,
        COALESCE(t.laundry_sales, 0) AS laundry_sales,
        COALESCE(t.total_sales, 0) AS total_sales,
        COALESCE(e.water_exp, 0) AS water_exp,
        COALESCE(e.laundry_exp, 0) AS laundry_exp,
        COALESCE(e.shared_exp, 0) AS shared_exp,
        COALESCE(e.total_exp, 0) AS total_exp
    FROM (
        SELECT DISTINCT transaction_date AS report_date FROM transactions WHERE transaction_date BETWEEN ? AND ?
        UNION
        SELECT DISTINCT expense_date AS report_date FROM expenses WHERE expense_date BETWEEN ? AND ?
    ) d
    LEFT JOIN (
        SELECT 
            transaction_date,
            SUM(CASE WHEN business_category = 'water' THEN total_amount ELSE 0 END) AS water_sales,
            SUM(CASE WHEN business_category = 'laundry' THEN total_amount ELSE 0 END) AS laundry_sales,
            SUM(total_amount) AS total_sales
        FROM transactions
        WHERE transaction_date BETWEEN ? AND ?
        GROUP BY transaction_date
    ) t ON d.report_date = t.transaction_date
    LEFT JOIN (
        SELECT 
            expense_date,
            SUM(CASE WHEN business_category = 'water' THEN total_amount ELSE 0 END) AS water_exp,
            SUM(CASE WHEN business_category = 'laundry' THEN total_amount ELSE 0 END) AS laundry_exp,
            SUM(CASE WHEN business_category = 'shared' THEN total_amount ELSE 0 END) AS shared_exp,
            SUM(total_amount) AS total_exp
        FROM expenses
        WHERE expense_date BETWEEN ? AND ?
        GROUP BY expense_date
    ) e ON d.report_date = e.expense_date
    ORDER BY d.report_date DESC
");
$dailyStmt->execute([$startDate, $endDate, $startDate, $endDate, $startDate, $endDate, $startDate, $endDate]);
$dailyRows = $dailyStmt->fetchAll();

require_once __DIR__ . '/../../includes/header.php';
?>

<div class="page-header">
    <div>
        <h1 class="page-title">Financial Performance Report</h1>
        <p class="page-subtitle"><?= e($reportTitle) ?></p>
    </div>
    <div style="display: flex; gap: 8px;">
        <a href="daily.php" class="btn btn-secondary btn-sm">Daily Sheet</a>
        <button type="button" onclick="window.print()" class="btn btn-secondary btn-sm">
            Print Report
        </button>
    </div>
</div>

<!-- Print Header -->
<div class="print-header">
    <h1>PAZINGS MANAGEMENT</h1>
    <p>FINANCIAL PERFORMANCE REPORT</p>
    <p><?= e($reportTitle) ?></p>
</div>

<!-- Compact Range Filter Bar -->
<div class="filter-bar no-print">
    <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; width: 100%; gap: 8px;">
        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <a href="custom.php?preset=this_week" class="btn <?= $preset === 'this_week' ? 'btn-primary' : 'btn-secondary' ?> btn-sm">This Week</a>
            <a href="custom.php?preset=this_month" class="btn <?= $preset === 'this_month' ? 'btn-primary' : 'btn-secondary' ?> btn-sm">This Month</a>
            <a href="custom.php?preset=last_month" class="btn <?= $preset === 'last_month' ? 'btn-primary' : 'btn-secondary' ?> btn-sm">Last Month</a>
        </div>

        <form method="GET" action="custom.php" style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
            <input type="hidden" name="preset" value="custom">
            <input type="date" name="start" class="form-control" style="width: auto; padding: 4px 8px; min-height: 30px;" value="<?= e($startDate) ?>" required>
            <span>to</span>
            <input type="date" name="end" class="form-control" style="width: auto; padding: 4px 8px; min-height: 30px;" value="<?= e($endDate) ?>" required>
            <button type="submit" class="btn btn-primary btn-sm">Filter</button>
        </form>
    </div>
</div>

<!-- Financial Summary Banner -->
<div class="overview-banner">
    <div>
        <div class="overview-label">Period Gross Sales</div>
        <div class="overview-value"><?= formatCurrency($salesSummary['total_sales']) ?></div>
        <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 4px;">
            Water: <?= formatCurrency($salesSummary['water_sales']) ?> &bull; Laundry: <?= formatCurrency($salesSummary['laundry_sales']) ?>
        </div>
    </div>
    <div style="text-align: right;">
        <div class="overview-label">Net Operating Result</div>
        <div style="font-size: 1.5rem; font-weight: 700; color: <?= $netIncome >= 0 ? 'var(--navy)' : 'var(--danger)' ?>;">
            <?= formatCurrency($netIncome) ?>
        </div>
        <div style="font-size: 0.82rem; color: var(--danger); margin-top: 4px;">
            Total Expenses: <?= formatCurrency($expSummary['total_exp']) ?>
        </div>
    </div>
</div>

<!-- Daily Performance Table -->
<div class="card">
    <div class="card-header">
        <h2 class="card-title">Daily Financial Log (<?= count($dailyRows) ?> days)</h2>
    </div>

    <div class="table-responsive">
        <table class="data-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th style="text-align: right;">Water Sales</th>
                    <th style="text-align: right;">Laundry Sales</th>
                    <th style="text-align: right;">Total Sales</th>
                    <th style="text-align: right;">Expenses</th>
                    <th style="text-align: right;">Net Profit</th>
                    <th class="no-print" style="text-align: center; width: 60px;">Action</th>
                </tr>
            </thead>
            <tbody>
                <?php if (empty($dailyRows)): ?>
                    <tr>
                        <td colspan="7" style="text-align: center; padding: 24px; color: var(--text-muted);">
                            No transactions or expenses recorded in this date range.
                        </td>
                    </tr>
                <?php else: ?>
                    <?php foreach ($dailyRows as $row): 
                        $dayNet = (float)$row['total_sales'] - (float)$row['total_exp'];
                    ?>
                        <tr>
                            <td>
                                <strong><?= formatDate($row['report_date'], 'M d, Y') ?></strong>
                            </td>
                            <td style="text-align: right;"><?= formatCurrency($row['water_sales']) ?></td>
                            <td style="text-align: right;"><?= formatCurrency($row['laundry_sales']) ?></td>
                            <td style="text-align: right; font-weight: 700; color: var(--navy);">
                                <?= formatCurrency($row['total_sales']) ?>
                            </td>
                            <td style="text-align: right; color: var(--danger);">
                                <?= formatCurrency($row['total_exp']) ?>
                            </td>
                            <td style="text-align: right; font-weight: 700; color: <?= $dayNet >= 0 ? 'var(--navy)' : 'var(--danger)' ?>;">
                                <?= formatCurrency($dayNet) ?>
                            </td>
                            <td class="no-print" style="text-align: center;">
                                <a href="daily.php?date=<?= urlencode($row['report_date']) ?>" class="btn btn-secondary btn-sm">
                                    View
                                </a>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                <?php endif; ?>
            </tbody>
        </table>
    </div>
</div>

<?php require_once __DIR__ . '/../../includes/footer.php'; ?>
