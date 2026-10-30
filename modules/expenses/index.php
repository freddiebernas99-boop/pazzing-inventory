<?php
/**
 * PAZINGS INVENTORY & SALES MANAGEMENT SYSTEM
 * Expenses Page: Direct Entry Form & Today's Expenses Table
 * Minimal Blue & White Theme (No Emojis)
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/csrf.php';
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/functions.php';

requireLogin();
$pdo = getDbConnection();
$currentUser = getCurrentUser();

$pageTitle = 'Expenses';
$today = date('Y-m-d');
$filterDate = $_GET['date'] ?? $today;
$filterCat = $_GET['cat'] ?? 'all';

$errors = [];

// Handle New Expense Submission
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'save_expense') {
    validateCsrfOrDie();

    $expenseDate = trim($_POST['expense_date'] ?? $today);
    $category = trim($_POST['business_category'] ?? 'shared');
    $particular = trim($_POST['particular'] ?? '');
    $qty = trim($_POST['quantity'] ?? '');
    $unitPrice = trim($_POST['unit_price'] ?? '');
    $totalAmount = (float)($_POST['total_amount'] ?? 0);
    $notes = trim($_POST['notes'] ?? '');

    if (!in_array($category, ['water', 'laundry', 'shared'])) {
        $errors[] = 'Invalid expense category selected.';
    }

    if ($particular === '') {
        $errors[] = 'Please specify the expense description.';
    }

    $numQty = ($qty !== '' && is_numeric($qty)) ? (float)$qty : null;
    $numPrice = ($unitPrice !== '' && is_numeric($unitPrice)) ? (float)$unitPrice : null;

    if ($numQty !== null && $numPrice !== null && $totalAmount <= 0) {
        $totalAmount = $numQty * $numPrice;
    }

    if ($totalAmount <= 0) {
        $errors[] = 'Please enter a valid expense amount greater than 0.';
    }

    if (empty($errors)) {
        try {
            $stmt = $pdo->prepare("
                INSERT INTO expenses (expense_date, business_category, particular, quantity, unit_price, total_amount, notes, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $expenseDate,
                $category,
                $particular,
                $numQty,
                $numPrice,
                $totalAmount,
                $notes,
                $currentUser['id']
            ]);
            $expenseId = (int)$pdo->lastInsertId();

            logAudit($pdo, $currentUser['id'], 'CREATE_EXPENSE', 'expenses', $expenseId, "Recorded $category expense '$particular' for " . formatCurrency($totalAmount));
            setFlash('success', "Expense '$particular' saved successfully (" . formatCurrency($totalAmount) . ").");
            header("Location: index.php?date=" . urlencode($expenseDate));
            exit;

        } catch (Exception $e) {
            $errors[] = 'Failed to save expense: ' . $e->getMessage();
        }
    }
}

// Handle Deletion (Owner only)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'delete') {
    validateCsrfOrDie();
    requireRole('owner');

    $expenseId = (int)($_POST['expense_id'] ?? 0);
    if ($expenseId > 0) {
        $target = $pdo->query("SELECT particular, total_amount, business_category FROM expenses WHERE id = $expenseId")->fetch();
        if ($target) {
            $pdo->prepare("DELETE FROM expenses WHERE id = ?")->execute([$expenseId]);
            logAudit($pdo, $currentUser['id'], 'DELETE_EXPENSE', 'expenses', $expenseId, "Deleted {$target['business_category']} expense '{$target['particular']}'");
            setFlash('success', "Expense deleted successfully.");
        }
    }
    header("Location: index.php?date=" . urlencode($filterDate));
    exit;
}

// Fetch expenses for date
$query = "
    SELECT e.id, e.business_category, e.particular, e.quantity, e.unit_price, e.total_amount, e.notes
    FROM expenses e
    WHERE e.expense_date = ?
";
$params = [$filterDate];

if ($filterCat !== 'all') {
    $query .= " AND e.business_category = ?";
    $params[] = $filterCat;
}

$query .= " ORDER BY e.business_category ASC, e.id ASC";

$stmt = $pdo->prepare($query);
$stmt->execute($params);
$expenses = $stmt->fetchAll();

$dayTotalExpenses = array_sum(array_column($expenses, 'total_amount'));

require_once __DIR__ . '/../../includes/header.php';
?>

<div class="page-header">
    <div>
        <h1 class="page-title">Expenses</h1>
        <p class="page-subtitle">Track daily water, laundry, and shared operational costs</p>
    </div>
</div>

<?php if (!empty($errors)): ?>
    <div class="alert alert-danger">
        <ul style="margin-left: 18px;">
            <?php foreach ($errors as $err): ?>
                <li><?= e($err) ?></li>
            <?php endforeach; ?>
        </ul>
    </div>
<?php endif; ?>

<!-- 1. Straightforward Expense Entry Form -->
<div class="card">
    <div class="card-header">
        <h2 class="card-title">New Expense Record</h2>
        <span style="font-size: 0.8rem; color: var(--text-muted);">Enter expense particulars</span>
    </div>

    <form method="POST" action="index.php" id="expenseForm">
        <?= getCsrfInput() ?>
        <input type="hidden" name="action" value="save_expense">

        <div class="form-row">
            <div class="form-group">
                <label class="form-label" for="expense_date">Date</label>
                <input type="date" id="expense_date" name="expense_date" class="form-control" 
                       value="<?= e($filterDate) ?>" required>
            </div>

            <div class="form-group">
                <label class="form-label" for="business_category">Business Category</label>
                <select id="business_category" name="business_category" class="form-select" required>
                    <option value="water">Water Refilling</option>
                    <option value="laundry">Laundry</option>
                    <option value="shared" selected>Shared Business Expense</option>
                </select>
            </div>

            <div class="form-group">
                <label class="form-label" for="particular">Expense Description</label>
                <input type="text" id="particular" name="particular" class="form-control" 
                       placeholder="e.g. Fuel, Surf Powder, Ulam" required autofocus>
            </div>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label class="form-label" for="quantity">Quantity (Optional)</label>
                <input type="number" id="quantity" name="quantity" class="form-control" 
                       placeholder="e.g. 1 or 288" step="any" min="0">
            </div>

            <div class="form-group">
                <label class="form-label" for="unit_price">Unit Price (Optional)</label>
                <input type="number" id="unit_price" name="unit_price" class="form-control" 
                       placeholder="₱ 0.00" step="0.01" min="0">
            </div>

            <div class="form-group">
                <label class="form-label" for="total_amount">Total Amount (₱)</label>
                <input type="number" id="total_amount" name="total_amount" class="form-control" 
                       placeholder="0.00" step="0.01" min="0.01" required style="font-weight: 700; color: var(--navy);">
            </div>

            <div class="form-group">
                <label class="form-label" for="notes">Notes / OR # (Optional)</label>
                <input type="text" id="notes" name="notes" class="form-control" placeholder="Optional notes">
            </div>
        </div>

        <div style="margin-top: 10px; display: flex; justify-content: flex-end;">
            <button type="submit" class="btn btn-primary btn-lg">
                Save Expense
            </button>
        </div>
    </form>
</div>

<!-- 2. Compact Table of Today's Recorded Expenses -->
<div class="card">
    <div class="card-header">
        <h2 class="card-title">Today's Recorded Expenses (<?= formatDate($filterDate, 'M d, Y') ?>)</h2>
        <div style="font-weight: 700; color: var(--danger); font-size: 1.05rem;">
            Total: <?= formatCurrency($dayTotalExpenses) ?>
        </div>
    </div>

    <!-- Compact Filter Bar -->
    <div class="no-print" style="margin-bottom: 12px;">
        <form method="GET" action="index.php" style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <label style="font-size: 0.85rem; font-weight: 600;">Date:</label>
            <input type="date" name="date" class="form-control" style="width: auto; min-height: 32px; padding: 4px 8px;" value="<?= e($filterDate) ?>">

            <label style="font-size: 0.85rem; font-weight: 600;">Category:</label>
            <select name="cat" class="form-select" style="width: auto; min-height: 32px; padding: 4px 8px;">
                <option value="all" <?= $filterCat === 'all' ? 'selected' : '' ?>>All Categories</option>
                <option value="water" <?= $filterCat === 'water' ? 'selected' : '' ?>>Water Refilling</option>
                <option value="laundry" <?= $filterCat === 'laundry' ? 'selected' : '' ?>>Laundry</option>
                <option value="shared" <?= $filterCat === 'shared' ? 'selected' : '' ?>>Shared Business</option>
            </select>

            <button type="submit" class="btn btn-secondary btn-sm">Filter</button>
            <?php if ($filterDate !== $today): ?>
                <a href="index.php" class="btn btn-secondary btn-sm">Today</a>
            <?php endif; ?>
        </form>
    </div>

    <div class="table-responsive">
        <table class="data-table">
            <thead>
                <tr>
                    <th style="width: 35px;">No.</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th style="text-align: center;">Qty</th>
                    <th style="text-align: right;">Unit Price</th>
                    <th style="text-align: right;">Amount</th>
                    <th>Notes</th>
                    <?php if (isOwner()): ?>
                        <th class="no-print" style="text-align: center; width: 60px;">Action</th>
                    <?php endif; ?>
                </tr>
            </thead>
            <tbody>
                <?php if (empty($expenses)): ?>
                    <tr>
                        <td colspan="<?= isOwner() ? 8 : 7 ?>" style="text-align: center; padding: 24px; color: var(--text-muted);">
                            No expenses recorded for this date.
                        </td>
                    </tr>
                <?php else: ?>
                    <?php 
                    $no = 1;
                    foreach ($expenses as $exp): 
                    ?>
                        <tr>
                            <td><?= $no++ ?></td>
                            <td>
                                <span class="badge badge-<?= e($exp['business_category']) ?>">
                                    <?= ucfirst(e($exp['business_category'])) ?>
                                </span>
                            </td>
                            <td><strong><?= e($exp['particular']) ?></strong></td>
                            <td style="text-align: center;"><?= $exp['quantity'] !== null ? (float)$exp['quantity'] : '-' ?></td>
                            <td style="text-align: right;"><?= $exp['unit_price'] !== null ? formatCurrency($exp['unit_price']) : '-' ?></td>
                            <td style="text-align: right; font-weight: 700; color: var(--danger);">
                                <?= formatCurrency($exp['total_amount']) ?>
                            </td>
                            <td style="color: var(--text-muted); font-size: 0.8rem;"><?= e($exp['notes'] ?: '-') ?></td>
                            <?php if (isOwner()): ?>
                                <td class="no-print" style="text-align: center;">
                                    <form method="POST" style="display: inline;" onsubmit="return confirm('Delete expense \'<?= e($exp['particular']) ?>\'?');">
                                        <?= getCsrfInput() ?>
                                        <input type="hidden" name="action" value="delete">
                                        <input type="hidden" name="expense_id" value="<?= $exp['id'] ?>">
                                        <button type="submit" class="btn btn-danger btn-sm">Delete</button>
                                    </form>
                                </td>
                            <?php endif; ?>
                        </tr>
                    <?php endforeach; ?>
                    <tr class="table-total-row">
                        <td colspan="5" style="text-align: right;">TOTAL EXPENSES:</td>
                        <td style="text-align: right; color: var(--danger); font-size: 0.95rem;">
                            <?= formatCurrency($dayTotalExpenses) ?>
                        </td>
                        <td colspan="<?= isOwner() ? 2 : 1 ?>"></td>
                    </tr>
                <?php endif; ?>
            </tbody>
        </table>
    </div>
</div>

<script>
// Auto-calculate Total Amount when Qty and Unit Price are entered
document.addEventListener('DOMContentLoaded', function () {
    const qtyInput = document.getElementById('quantity');
    const priceInput = document.getElementById('unit_price');
    const totalInput = document.getElementById('total_amount');

    function updateCalculatedTotal() {
        const q = parseFloat(qtyInput.value) || 0;
        const p = parseFloat(priceInput.value) || 0;
        if (q > 0 && p > 0) {
            totalInput.value = (q * p).toFixed(2);
        }
    }

    if (qtyInput && priceInput) {
        qtyInput.addEventListener('input', updateCalculatedTotal);
        priceInput.addEventListener('input', updateCalculatedTotal);
    }
});
</script>

<?php require_once __DIR__ . '/../../includes/footer.php'; ?>
