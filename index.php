<?php
/**
 * PAZINGS INVENTORY & SALES MANAGEMENT SYSTEM
 * Staff & Owner Dashboard: Simple Daily Overview
 * Strict Minimal Blue & White Theme (No Emojis)
 */

require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/config/csrf.php';
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/functions.php';

requireLogin();
$pdo = getDbConnection();
$currentUser = getCurrentUser();

$pageTitle = 'Daily Overview';
$today = date('Y-m-d');
$currentDateFormatted = date('l, F j, Y');

// Handle payment status toggle
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'toggle_payment') {
    verifyCsrfOrFail();
    $txId = (int)($_POST['transaction_id'] ?? 0);
    if ($txId > 0) {
        $toggleStmt = $pdo->prepare("
            UPDATE transactions
            SET payment_status = CASE WHEN payment_status = 'paid' THEN 'unpaid' ELSE 'paid' END
            WHERE id = ?
        ");
        $toggleStmt->execute([$txId]);
        setFlashMessage('success', 'Transaction payment status updated.');
    }
    header('Location: index.php');
    exit;
}

// 1. Calculate Today's Paid Sales, Unpaid Balance, and Gross Sales directly from DB
$salesStmt = $pdo->prepare("
    SELECT 
        COALESCE(SUM(CASE WHEN payment_status = 'paid' AND business_category = 'water' THEN total_amount ELSE 0 END), 0) AS water_paid,
        COALESCE(SUM(CASE WHEN payment_status = 'paid' AND business_category = 'laundry' THEN total_amount ELSE 0 END), 0) AS laundry_paid,
        COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END), 0) AS paid_sales,
        COALESCE(SUM(CASE WHEN payment_status = 'unpaid' AND business_category = 'water' THEN total_amount ELSE 0 END), 0) AS water_unpaid,
        COALESCE(SUM(CASE WHEN payment_status = 'unpaid' AND business_category = 'laundry' THEN total_amount ELSE 0 END), 0) AS laundry_unpaid,
        COALESCE(SUM(CASE WHEN payment_status = 'unpaid' THEN total_amount ELSE 0 END), 0) AS unpaid_balance,
        SUM(CASE WHEN payment_status = 'unpaid' THEN 1 ELSE 0 END) AS unpaid_count,
        COUNT(*) AS transaction_count
    FROM transactions 
    WHERE transaction_date = ?
");
$salesStmt->execute([$today]);
$sales = $salesStmt->fetch();

$todayPaidSales = (float)($sales['paid_sales'] ?? 0);
$todayWaterPaid = (float)($sales['water_paid'] ?? 0);
$todayLaundryPaid = (float)($sales['laundry_paid'] ?? 0);
$todayUnpaidBalance = (float)($sales['unpaid_balance'] ?? 0);
$todayWaterUnpaid = (float)($sales['water_unpaid'] ?? 0);
$todayLaundryUnpaid = (float)($sales['laundry_unpaid'] ?? 0);
$todayGrossSales = $todayPaidSales + $todayUnpaidBalance;
$todayWaterGross = $todayWaterPaid + $todayWaterUnpaid;
$todayLaundryGross = $todayLaundryPaid + $todayLaundryUnpaid;
$todayUnpaidCount = (int)($sales['unpaid_count'] ?? 0);
$todayTransCount = (int)($sales['transaction_count'] ?? 0);

// 2. Fetch all of today's transactions so Staff and Admin counts and lists always match
$recentStmt = $pdo->prepare("
    SELECT t.id, t.transaction_code, t.business_category, t.transaction_time,
           t.customer_name, t.total_amount, t.payment_status, t.notes,
           GROUP_CONCAT(CONCAT(ti.item_name, ' (', TRIM(TRAILING '.00' FROM CAST(ti.quantity AS CHAR)), ' x ', FORMAT(ti.unit_price, 2), ')') SEPARATOR ', ') AS items_summary
    FROM transactions t
    LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
    WHERE t.transaction_date = ?
    GROUP BY t.id
    ORDER BY t.transaction_time DESC, t.id DESC
");
$recentStmt->execute([$today]);
$recentTransactions = $recentStmt->fetchAll();

require_once __DIR__ . '/includes/header.php';
?>

<!-- Page Header -->
<div class="page-header">
    <div>
        <h1 class="page-title">Daily Overview</h1>
        <p class="page-subtitle"><?= e($currentDateFormatted) ?></p>
    </div>
    <?php if (isOwner()): ?>
        <div>
            <a href="modules/reports/daily.php" class="btn btn-secondary btn-sm">Full Business Summary</a>
        </div>
    <?php endif; ?>
</div>

<!-- Three Clear Primary Actions -->
<div class="action-grid">
    <a href="modules/water/index.php" class="action-card primary-action">
        Water Refilling
    </a>
    <a href="modules/laundry/index.php" class="action-card primary-action">
        Laundry
    </a>
    <a href="modules/expenses/index.php" class="action-card">
        Expenses
    </a>
</div>

<!-- Today's Paid Sales & Gross Sales Banner -->
<div class="overview-banner">
    <div>
        <div class="overview-label">Today's Paid Sales</div>
        <div class="overview-value"><?= formatCurrency($todayPaidSales) ?></div>
        <div style="margin-top: 6px; font-size: 0.82rem; color: var(--text-muted);">
            Gross Sales (Paid + Unpaid): <strong><?= formatCurrency($todayGrossSales) ?></strong>
            <span>(Water: <strong><?= formatCurrency($todayWaterGross) ?></strong> &bull; Laundry: <strong><?= formatCurrency($todayLaundryGross) ?></strong>)</span>
        </div>
    </div>
    <div style="font-size: 0.85rem; color: var(--text-muted); text-align: right;">
        <div>Paid Water: <strong><?= formatCurrency($todayWaterPaid) ?></strong></div>
        <div>Paid Laundry: <strong><?= formatCurrency($todayLaundryPaid) ?></strong></div>
        <div style="margin-top: 2px;"><?= $todayTransCount ?> transaction(s) recorded today</div>
    </div>
</div>

<!-- Compact Unpaid Balance Section -->
<div class="unpaid-banner <?= $todayUnpaidBalance > 0 ? 'has-unpaid' : '' ?>">
    <div>
        <div class="unpaid-label">Unpaid Balance</div>
        <div class="unpaid-value"><?= formatCurrency($todayUnpaidBalance) ?></div>
    </div>
    <div style="font-size: 0.85rem; color: var(--text-muted); text-align: right;">
        <div><?= $todayUnpaidCount ?> unpaid transaction(s)</div>
        <div style="margin-top: 2px; font-size: 0.78rem;">
            Water: <?= formatCurrency($todayWaterUnpaid) ?> &bull; Laundry: <?= formatCurrency($todayLaundryUnpaid) ?>
        </div>
    </div>
</div>

<!-- Today's Transactions -->
<div class="card">
    <div class="card-header">
        <h2 class="card-title">Today's Transactions</h2>
        <span style="font-size: 0.8rem; color: var(--text-muted);">
            <?= count($recentTransactions) ?> records
        </span>
    </div>

    <div class="table-responsive">
        <table class="data-table">
            <thead>
                <tr>
                    <th>Time</th>
                    <th>Code</th>
                    <th>Category</th>
                    <th>Customer Name</th>
                    <th style="text-align: right;">Amount</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                <?php if (empty($recentTransactions)): ?>
                    <tr>
                        <td colspan="6" style="text-align: center; padding: 24px; color: var(--text-muted);">
                            No transactions recorded yet today. Click <strong>Water Refilling</strong> or <strong>Laundry</strong> above to record a sale.
                        </td>
                    </tr>
                <?php else: ?>
                    <?php foreach ($recentTransactions as $rt): ?>
                        <tr>
                            <td style="color: var(--text-muted); font-size: 0.82rem;">
                                <?= date('h:i A', strtotime($rt['transaction_time'])) ?>
                            </td>
                            <td><code><?= e($rt['transaction_code']) ?></code></td>
                            <td>
                                <span class="badge badge-<?= e($rt['business_category']) ?>">
                                    <?= ucfirst(e($rt['business_category'])) ?>
                                </span>
                            </td>
                            <td>
                                <strong><?= e($rt['customer_name']) ?></strong>
                                <?php if (!empty($rt['items_summary'])): ?>
                                    <div style="font-size: 0.75rem; color: var(--text-muted);"><?= e($rt['items_summary']) ?></div>
                                <?php endif; ?>
                            </td>
                            <td style="text-align: right; font-weight: 700; color: var(--navy);">
                                <?= formatCurrency($rt['total_amount']) ?>
                            </td>
                            <td>
                                <form method="post" action="index.php" style="display:inline;">
                                    <?= csrfInputField() ?>
                                    <input type="hidden" name="action" value="toggle_payment">
                                    <input type="hidden" name="transaction_id" value="<?= (int)$rt['id'] ?>">
                                    <button type="submit" class="badge badge-<?= $rt['payment_status'] === 'paid' ? 'paid' : 'unpaid' ?>" style="border:none; cursor:pointer;" title="Click to toggle payment status">
                                        <?= ucfirst(e($rt['payment_status'])) ?>
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

<?php require_once __DIR__ . '/includes/footer.php'; ?>
