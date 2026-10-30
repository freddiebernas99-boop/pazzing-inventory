<?php
/**
 * PAZINGS INVENTORY & SALES MANAGEMENT SYSTEM
 * Water Refilling Page: Direct Transaction Form & Today's Transactions Table
 * Minimal Blue & White Theme (No Emojis)
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/csrf.php';
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/functions.php';

requireLogin();
$pdo = getDbConnection();
$currentUser = getCurrentUser();

$pageTitle = 'Water Refilling';
$today = date('Y-m-d');
$filterDate = $_GET['date'] ?? $today;

// Fetch verified active water services
$services = getServicesByCategory($pdo, 'water');
$serviceMap = [];
$servicesById = [];
foreach ($services as $s) {
    $serviceMap[$s['service_code']] = $s;
    $servicesById[(int)$s['id']] = $s;
}

// Customer names list for autocomplete
$customers = $pdo->query("SELECT name FROM customers ORDER BY name ASC")->fetchAll(PDO::FETCH_COLUMN);

$errors = [];

// Handle payment status toggle
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'toggle_payment') {
    validateCsrfOrDie();
    $transId = (int)($_POST['transaction_id'] ?? 0);
    if ($transId > 0) {
        $pdo->prepare("
            UPDATE transactions
            SET payment_status = CASE WHEN payment_status = 'paid' THEN 'unpaid' ELSE 'paid' END
            WHERE id = ? AND business_category = 'water'
        ")->execute([$transId]);
        setFlash('success', 'Payment status updated.');
    }
    header("Location: index.php?date=" . urlencode($filterDate));
    exit;
}

// Handle New Transaction Submission
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'save_transaction') {
    validateCsrfOrDie();

    $transDate = trim($_POST['transaction_date'] ?? $today);
    $customerName = trim($_POST['customer_name'] ?? '');
    $paymentMethod = trim($_POST['payment_method'] ?? 'Cash');
    $paymentStatus = trim($_POST['payment_status'] ?? 'paid');
    $notes = trim($_POST['notes'] ?? '');

    if ($customerName === '') {
        $customerName = 'Walk-in Customer';
    }

    $lineItems = [];
    $totalAmount = 0.0;

    $postedQuantities = $_POST['qty'] ?? [];
    if (is_array($postedQuantities)) {
        foreach ($postedQuantities as $srvId => $rawQty) {
            $qty = (float)$rawQty;
            $srvIdInt = (int)$srvId;
            if ($qty > 0 && isset($servicesById[$srvIdInt])) {
                $srv = $servicesById[$srvIdInt];
                $rate = (float)$srv['default_rate'];
                $sub = $qty * $rate;
                $lineItems[] = [
                    'service_id' => $srvIdInt,
                    'item_name' => $srv['service_name'],
                    'quantity' => $qty,
                    'unit_price' => $rate,
                    'subtotal' => $sub
                ];
                $totalAmount += $sub;
            }
        }
    }

    // Fallback for legacy field names if posted
    $legacyMap = [
        'qty_refill' => 'refill',
        'qty_delivered' => 'delivered',
        'qty_gallon' => 'gallon_refill'
    ];
    foreach ($legacyMap as $postField => $srvCode) {
        $qty = (float)($_POST[$postField] ?? 0);
        if ($qty > 0 && isset($serviceMap[$srvCode])) {
            $srv = $serviceMap[$srvCode];
            $rate = (float)$srv['default_rate'];
            $sub = $qty * $rate;
            $lineItems[] = [
                'service_id' => (int)$srv['id'],
                'item_name' => $srv['service_name'],
                'quantity' => $qty,
                'unit_price' => $rate,
                'subtotal' => $sub
            ];
            $totalAmount += $sub;
        }
    }

    // Optional custom extra
    $extraName = trim($_POST['extra_name'] ?? '');
    $extraQty = (float)($_POST['extra_qty'] ?? 0);
    $extraPrice = (float)($_POST['extra_price'] ?? 0);

    if ($extraName !== '' && $extraQty > 0 && $extraPrice >= 0) {
        $extraSub = $extraQty * $extraPrice;
        $lineItems[] = [
            'service_id' => null,
            'item_name' => $extraName,
            'quantity' => $extraQty,
            'unit_price' => $extraPrice,
            'subtotal' => $extraSub
        ];
        $totalAmount += $extraSub;
    }

    if (empty($lineItems)) {
        $errors[] = 'Please enter a quantity for at least one water service.';
    }

    if (empty($errors)) {
        try {
            $pdo->beginTransaction();

            $customerId = findOrCreateCustomer($pdo, $customerName);
            $transCode = generateTransactionCode($pdo, 'WTR', $transDate);

            $insTrans = $pdo->prepare("
                INSERT INTO transactions (
                    transaction_code, business_category, transaction_date, transaction_time,
                    customer_id, customer_name, total_amount, payment_method, payment_status,
                    notes, created_by
                ) VALUES (?, 'water', ?, CURRENT_TIME(), ?, ?, ?, ?, ?, ?, ?)
            ");
            $insTrans->execute([
                $transCode,
                $transDate,
                $customerId,
                $customerName,
                $totalAmount,
                $paymentMethod,
                $paymentStatus,
                $notes,
                $currentUser['id']
            ]);
            $transId = (int)$pdo->lastInsertId();

            $insItem = $pdo->prepare("
                INSERT INTO transaction_items (transaction_id, service_id, item_name, quantity, unit_price, subtotal)
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            foreach ($lineItems as $item) {
                $insItem->execute([
                    $transId,
                    $item['service_id'],
                    $item['item_name'],
                    $item['quantity'],
                    $item['unit_price'],
                    $item['subtotal']
                ]);
            }

            $pdo->commit();

            logAudit($pdo, $currentUser['id'], 'CREATE_TRANSACTION', 'transactions', $transId, "Recorded Water sale $transCode for " . formatCurrency($totalAmount));
            setFlash('success', "Transaction $transCode saved successfully (" . formatCurrency($totalAmount) . ").");
            header("Location: index.php?date=" . urlencode($transDate));
            exit;

        } catch (Exception $e) {
            $pdo->rollBack();
            $errors[] = 'Failed to save transaction: ' . $e->getMessage();
        }
    }
}

// Handle protected deletion (Owner only)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'delete') {
    validateCsrfOrDie();
    requireRole('owner');

    $transId = (int)($_POST['transaction_id'] ?? 0);
    if ($transId > 0) {
        $target = $pdo->query("SELECT transaction_code, total_amount FROM transactions WHERE id = $transId AND business_category = 'water'")->fetch();
        if ($target) {
            $pdo->prepare("DELETE FROM transactions WHERE id = ?")->execute([$transId]);
            logAudit($pdo, $currentUser['id'], 'DELETE_TRANSACTION', 'transactions', $transId, "Deleted Water sale {$target['transaction_code']}");
            setFlash('success', "Transaction {$target['transaction_code']} deleted.");
        }
    }
    header("Location: index.php?date=" . urlencode($filterDate));
    exit;
}

// Fetch transactions for selected date
$query = "
    SELECT t.id, t.transaction_code, t.transaction_time, t.customer_name, 
           t.total_amount, t.payment_method, t.payment_status, t.notes
    FROM transactions t
    WHERE t.business_category = 'water' AND t.transaction_date = ?
    ORDER BY t.transaction_time DESC, t.id DESC
";
$stmt = $pdo->prepare($query);
$stmt->execute([$filterDate]);
$transactions = $stmt->fetchAll();

// Fetch line items for item breakdown in table
$itemsByTrans = [];
if (!empty($transactions)) {
    $ids = array_column($transactions, 'id');
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $itemStmt = $pdo->prepare("
        SELECT transaction_id, item_name, quantity, subtotal
        FROM transaction_items
        WHERE transaction_id IN ($placeholders)
    ");
    $itemStmt->execute($ids);
    foreach ($itemStmt->fetchAll() as $it) {
        $itemsByTrans[$it['transaction_id']][] = $it;
    }
}

$dayTotal = 0.0;
$dayPaid = 0.0;
$dayUnpaid = 0.0;
foreach ($transactions as $t) {
    $amt = (float)$t['total_amount'];
    $dayTotal += $amt;
    if ($t['payment_status'] === 'paid') {
        $dayPaid += $amt;
    } else {
        $dayUnpaid += $amt;
    }
}

require_once __DIR__ . '/../../includes/header.php';
?>

<div class="page-header">
    <div>
        <h1 class="page-title">Water Refilling</h1>
        <p class="page-subtitle">Record daily refill and delivery transactions</p>
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

<!-- 1. Straightforward Transaction Form -->
<div class="card">
    <div class="card-header">
        <h2 class="card-title">New Water Transaction</h2>
        <span style="font-size: 0.8rem; color: var(--text-muted);">Enter quantities to compute total</span>
    </div>

    <form method="POST" action="index.php" id="waterForm">
        <?= getCsrfInput() ?>
        <input type="hidden" name="action" value="save_transaction">

        <div class="form-row">
            <div class="form-group">
                <label class="form-label" for="transaction_date">Date</label>
                <input type="date" id="transaction_date" name="transaction_date" class="form-control" 
                       value="<?= e($filterDate) ?>" required>
            </div>

            <div class="form-group">
                <label class="form-label" for="customer_name">Customer Name (Optional)</label>
                <input type="text" id="customer_name" name="customer_name" class="form-control" 
                       list="customerDatalist" placeholder="Walk-in or Client Name" autocomplete="off">
                <datalist id="customerDatalist">
                    <?php foreach ($customers as $c): ?>
                        <option value="<?= e($c) ?>">
                    <?php endforeach; ?>
                </datalist>
            </div>

            <div class="form-group">
                <label class="form-label" for="payment_status">Payment Status</label>
                <select id="payment_status" name="payment_status" class="form-select">
                    <option value="paid" selected>Paid</option>
                    <option value="unpaid">Unpaid / Balance</option>
                </select>
            </div>
        </div>

        <!-- Compact Quantity Grid (All Active Water Services) -->
        <div class="qty-grid">
            <?php foreach ($services as $srv): ?>
                <div class="qty-field">
                    <label for="qty_srv_<?= (int)$srv['id'] ?>"><?= e($srv['service_name']) ?></label>
                    <span class="rate-hint"><?= formatCurrency($srv['default_rate']) ?> per <?= e($srv['unit_label'] ?? 'bottle') ?></span>
                    <input type="number" id="qty_srv_<?= (int)$srv['id'] ?>" name="qty[<?= (int)$srv['id'] ?>]" class="water-qty" 
                           data-rate="<?= (float)$srv['default_rate'] ?>" min="0" step="1" value="0">
                </div>
            <?php endforeach; ?>
        </div>

        <!-- Optional Extra (Collapsed/Inline for Cleanliness) -->
        <div style="margin-bottom: 12px;">
            <details style="font-size: 0.85rem; color: var(--navy); cursor: pointer;">
                <summary style="font-weight: 600; padding: 4px 0;">+ Add Extra Item (e.g. Cap, Gallon Cover)</summary>
                <div class="form-row" style="margin-top: 8px;">
                    <div class="form-group">
                        <input type="text" name="extra_name" class="form-control" placeholder="Item Name (e.g. Round Cover)">
                    </div>
                    <div class="form-group">
                        <input type="number" name="extra_qty" id="extra_qty" class="form-control" placeholder="Quantity" min="0" step="1" value="0">
                    </div>
                    <div class="form-group">
                        <input type="number" name="extra_price" id="extra_price" class="form-control" placeholder="Price (₱)" min="0" step="0.50" value="0">
                    </div>
                </div>
            </details>
        </div>

        <div class="form-group">
            <input type="text" name="notes" class="form-control" placeholder="Optional notes (e.g. delivery time, location)">
        </div>

        <!-- Total immediately above Save Transaction Button -->
        <div class="total-save-box">
            <div>
                <div class="total-label">Transaction Total</div>
                <div class="total-value" id="waterTotalDisplay">₱0.00</div>
            </div>

            <button type="submit" class="btn btn-primary btn-lg">
                Save Transaction
            </button>
        </div>
    </form>
</div>

<!-- 2. Compact Table of Today's Transactions -->
<div class="card">
    <div class="card-header">
        <h2 class="card-title">Today's Water Transactions (<?= formatDate($filterDate, 'M d, Y') ?>)</h2>
        <div style="font-weight: 700; color: var(--navy); font-size: 0.95rem; text-align: right;">
            Gross: <?= formatCurrency($dayTotal) ?>
            <span style="font-weight: 600; color: var(--success); margin-left: 8px;">Paid: <?= formatCurrency($dayPaid) ?></span>
            <span style="font-weight: 600; color: var(--danger); margin-left: 8px;">Unpaid: <?= formatCurrency($dayUnpaid) ?></span>
        </div>
    </div>

    <!-- Compact Date Filter -->
    <div class="no-print" style="margin-bottom: 12px;">
        <form method="GET" action="index.php" style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <label style="font-size: 0.85rem; font-weight: 600;">Date:</label>
            <input type="date" name="date" class="form-control" style="width: auto; min-height: 32px; padding: 4px 8px;" value="<?= e($filterDate) ?>">
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
                    <th>Time</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th style="text-align: right;">Total</th>
                    <th>Status</th>
                    <?php if (isOwner()): ?>
                        <th class="no-print" style="text-align: center; width: 60px;">Action</th>
                    <?php endif; ?>
                </tr>
            </thead>
            <tbody>
                <?php if (empty($transactions)): ?>
                    <tr>
                        <td colspan="<?= isOwner() ? 7 : 6 ?>" style="text-align: center; padding: 24px; color: var(--text-muted);">
                            No water transactions recorded for this date.
                        </td>
                    </tr>
                <?php else: ?>
                    <?php 
                    $no = 1;
                    foreach ($transactions as $t): 
                        $items = $itemsByTrans[$t['id']] ?? [];
                        $itemSummary = [];
                        foreach ($items as $it) {
                            $itemSummary[] = e($it['item_name']) . ' &times; ' . (float)$it['quantity'];
                        }
                    ?>
                        <tr>
                            <td><?= $no++ ?></td>
                            <td style="color: var(--text-muted); font-size: 0.8rem;">
                                <?= date('h:i A', strtotime($t['transaction_time'])) ?>
                            </td>
                            <td>
                                <strong><?= e($t['customer_name']) ?></strong>
                                <?php if ($t['notes']): ?>
                                    <span style="display: block; font-size: 0.75rem; color: var(--text-muted);"><?= e($t['notes']) ?></span>
                                <?php endif; ?>
                            </td>
                            <td style="font-size: 0.85rem;">
                                <?= !empty($itemSummary) ? implode(', ', $itemSummary) : '-' ?>
                            </td>
                            <td style="text-align: right; font-weight: 700; color: var(--navy);">
                                <?= formatCurrency($t['total_amount']) ?>
                            </td>
                            <td>
                                <form method="POST" action="index.php?date=<?= urlencode($filterDate) ?>" style="display: inline;">
                                    <?= getCsrfInput() ?>
                                    <input type="hidden" name="action" value="toggle_payment">
                                    <input type="hidden" name="transaction_id" value="<?= (int)$t['id'] ?>">
                                    <button type="submit" class="badge badge-<?= $t['payment_status'] === 'paid' ? 'paid' : 'unpaid' ?>" style="border:none; cursor:pointer;" title="Click to toggle payment status">
                                        <?= ucfirst(e($t['payment_status'])) ?>
                                    </button>
                                </form>
                            </td>
                            <?php if (isOwner()): ?>
                                <td class="no-print" style="text-align: center;">
                                    <form method="POST" style="display: inline;" onsubmit="return confirm('Delete transaction <?= e($t['transaction_code']) ?>?');">
                                        <?= getCsrfInput() ?>
                                        <input type="hidden" name="action" value="delete">
                                        <input type="hidden" name="transaction_id" value="<?= $t['id'] ?>">
                                        <button type="submit" class="btn btn-danger btn-sm">Delete</button>
                                    </form>
                                </td>
                            <?php endif; ?>
                        </tr>
                    <?php endforeach; ?>
                <?php endif; ?>
            </tbody>
        </table>
    </div>
</div>

<script>
// Real-time Water Total Calculation
document.addEventListener('DOMContentLoaded', function () {
    const qtyInputs = document.querySelectorAll('.water-qty');
    const extraQty = document.getElementById('extra_qty');
    const extraPrice = document.getElementById('extra_price');
    const totalDisplay = document.getElementById('waterTotalDisplay');

    function calculateWaterTotal() {
        let total = 0;
        qtyInputs.forEach(function (input) {
            const qty = parseFloat(input.value) || 0;
            const rate = parseFloat(input.getAttribute('data-rate')) || 0;
            total += qty * rate;
        });

        if (extraQty && extraPrice) {
            const eq = parseFloat(extraQty.value) || 0;
            const ep = parseFloat(extraPrice.value) || 0;
            total += eq * ep;
        }

        totalDisplay.textContent = '₱' + total.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    qtyInputs.forEach(function (input) {
        input.addEventListener('input', calculateWaterTotal);
    });
    if (extraQty) extraQty.addEventListener('input', calculateWaterTotal);
    if (extraPrice) extraPrice.addEventListener('input', calculateWaterTotal);
});
</script>

<?php require_once __DIR__ . '/../../includes/footer.php'; ?>
