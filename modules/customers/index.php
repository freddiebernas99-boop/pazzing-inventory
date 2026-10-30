<?php
/**
 * PAZINGS INVENTORY & SALES MANAGEMENT SYSTEM
 * Customer Directory (Minimal Style, No Emojis)
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/csrf.php';
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/functions.php';

requireLogin();
$pdo = getDbConnection();
$currentUser = getCurrentUser();

$pageTitle = 'Customers';
$search = trim($_GET['search'] ?? '');

// Add or edit customer
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'save_customer') {
    validateCsrfOrDie();

    $customerId = (int)($_POST['customer_id'] ?? 0);
    $name = trim($_POST['name'] ?? '');
    $contact = trim($_POST['contact_number'] ?? '');
    $address = trim($_POST['address'] ?? '');
    $notes = trim($_POST['notes'] ?? '');

    if ($name === '') {
        setFlash('danger', 'Customer name is required.');
    } else {
        try {
            if ($customerId > 0) {
                $stmt = $pdo->prepare("UPDATE customers SET name = ?, contact_number = ?, address = ?, notes = ? WHERE id = ?");
                $stmt->execute([$name, $contact, $address, $notes, $customerId]);
                logAudit($pdo, $currentUser['id'], 'UPDATE_CUSTOMER', 'customers', $customerId, "Updated customer $name");
                setFlash('success', "Customer details updated successfully.");
            } else {
                $stmt = $pdo->prepare("INSERT INTO customers (name, contact_number, address, notes) VALUES (?, ?, ?, ?)");
                $stmt->execute([$name, $contact, $address, $notes]);
                $newId = (int)$pdo->lastInsertId();
                logAudit($pdo, $currentUser['id'], 'CREATE_CUSTOMER', 'customers', $newId, "Added customer $name");
                setFlash('success', "Customer '$name' added successfully.");
            }
        } catch (Exception $e) {
            setFlash('danger', "Error saving customer: " . $e->getMessage());
        }
    }
    header("Location: index.php" . ($search ? "?search=" . urlencode($search) : ''));
    exit;
}

$query = "
    SELECT c.id, c.name, c.contact_number, c.address, c.notes, c.created_at,
           COUNT(t.id) AS total_orders,
           COALESCE(SUM(t.total_amount), 0) AS lifetime_spend,
           MAX(t.transaction_date) AS last_order_date
    FROM customers c
    LEFT JOIN transactions t ON c.id = t.customer_id
";

$params = [];
if ($search !== '') {
    $query .= " WHERE c.name LIKE ? OR c.contact_number LIKE ? OR c.address LIKE ?";
    $params[] = "%$search%";
    $params[] = "%$search%";
    $params[] = "%$search%";
}

$query .= " GROUP BY c.id ORDER BY lifetime_spend DESC, c.name ASC";

$stmt = $pdo->prepare($query);
$stmt->execute($params);
$customers = $stmt->fetchAll();

require_once __DIR__ . '/../../includes/header.php';
?>

<div class="page-header">
    <div>
        <h1 class="page-title">Customers</h1>
        <p class="page-subtitle">Directory of saved customer records and order histories</p>
    </div>
    <div>
        <button type="button" onclick="openCustomerModal()" class="btn btn-primary btn-sm">
            Add Customer
        </button>
    </div>
</div>

<!-- Compact Search Bar -->
<div class="filter-bar no-print">
    <form method="GET" action="index.php" style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
        <input type="text" id="search" name="search" class="form-control" style="width: 240px; min-height: 32px; padding: 4px 8px;" 
               placeholder="Search name, phone, address..." value="<?= e($search) ?>" autofocus>
        <button type="submit" class="btn btn-secondary btn-sm">Search</button>
        <?php if ($search): ?>
            <a href="index.php" class="btn btn-secondary btn-sm">Clear</a>
        <?php endif; ?>
    </form>
</div>

<!-- Customers Table -->
<div class="card">
    <div class="card-header">
        <h2 class="card-title">Customer Records (<?= count($customers) ?>)</h2>
    </div>

    <div class="table-responsive">
        <table class="data-table">
            <thead>
                <tr>
                    <th style="width: 35px;">No.</th>
                    <th>Name</th>
                    <th>Contact Phone</th>
                    <th>Address</th>
                    <th style="text-align: center;">Orders</th>
                    <th style="text-align: right;">Total Spend</th>
                    <th>Last Order</th>
                    <th class="no-print" style="text-align: center; width: 60px;">Action</th>
                </tr>
            </thead>
            <tbody>
                <?php if (empty($customers)): ?>
                    <tr>
                        <td colspan="8" style="text-align: center; padding: 24px; color: var(--text-muted);">
                            No customers found. Customer names entered during sales are saved automatically.
                        </td>
                    </tr>
                <?php else: ?>
                    <?php 
                    $no = 1;
                    foreach ($customers as $c): 
                    ?>
                        <tr>
                            <td><?= $no++ ?></td>
                            <td>
                                <strong><?= e($c['name']) ?></strong>
                                <?php if ($c['notes']): ?>
                                    <span style="display: block; font-size: 0.75rem; color: var(--text-muted);"><?= e($c['notes']) ?></span>
                                <?php endif; ?>
                            </td>
                            <td><?= e($c['contact_number'] ?: '-') ?></td>
                            <td><?= e($c['address'] ?: '-') ?></td>
                            <td style="text-align: center;">
                                <span class="badge badge-water"><?= (int)$c['total_orders'] ?></span>
                            </td>
                            <td style="text-align: right; font-weight: 700; color: var(--navy);">
                                <?= formatCurrency($c['lifetime_spend']) ?>
                            </td>
                            <td style="font-size: 0.8rem; color: var(--text-muted);">
                                <?= formatDate($c['last_order_date'], 'M d, Y') ?>
                            </td>
                            <td class="no-print" style="text-align: center;">
                                <button type="button" class="btn btn-secondary btn-sm" 
                                        onclick="editCustomer(<?= htmlspecialchars(json_encode($c), ENT_QUOTES, 'UTF-8') ?>)">
                                    Edit
                                </button>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                <?php endif; ?>
            </tbody>
        </table>
    </div>
</div>

<!-- Customer Modal -->
<div id="customerModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); z-index: 2000; align-items: center; justify-content: center;">
    <div style="background: #ffffff; width: 100%; max-width: 400px; margin: 16px; border-radius: var(--radius-md); padding: 20px; border: 1px solid var(--border);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
            <h3 id="modalTitle" style="color: var(--navy); font-size: 1.1rem; font-weight: 600;">Add Customer</h3>
            <button type="button" onclick="closeCustomerModal()" style="background:none; border:none; font-size: 1.1rem; cursor:pointer;">&times;</button>
        </div>

        <form method="POST" action="index.php">
            <?= getCsrfInput() ?>
            <input type="hidden" name="action" value="save_customer">
            <input type="hidden" name="customer_id" id="modalCustomerId" value="0">

            <div class="form-group">
                <label class="form-label" for="modalName">Customer Name</label>
                <input type="text" id="modalName" name="name" class="form-control" required placeholder="Full Name">
            </div>

            <div class="form-group">
                <label class="form-label" for="modalContact">Contact Phone (Optional)</label>
                <input type="text" id="modalContact" name="contact_number" class="form-control" placeholder="Phone Number">
            </div>

            <div class="form-group">
                <label class="form-label" for="modalAddress">Address (Optional)</label>
                <input type="text" id="modalAddress" name="address" class="form-control" placeholder="Address">
            </div>

            <div class="form-group">
                <label class="form-label" for="modalNotes">Notes (Optional)</label>
                <textarea id="modalNotes" name="notes" class="form-control" rows="2" placeholder="Optional notes"></textarea>
            </div>

            <div style="display: flex; gap: 8px; margin-top: 16px;">
                <button type="submit" class="btn btn-primary" style="flex: 1;">Save Customer</button>
                <button type="button" onclick="closeCustomerModal()" class="btn btn-secondary">Cancel</button>
            </div>
        </form>
    </div>
</div>

<script>
function openCustomerModal() {
    document.getElementById('modalTitle').textContent = 'Add New Customer';
    document.getElementById('modalCustomerId').value = '0';
    document.getElementById('modalName').value = '';
    document.getElementById('modalContact').value = '';
    document.getElementById('modalAddress').value = '';
    document.getElementById('modalNotes').value = '';
    document.getElementById('customerModal').style.display = 'flex';
}

function editCustomer(c) {
    document.getElementById('modalTitle').textContent = 'Edit Customer Details';
    document.getElementById('modalCustomerId').value = c.id;
    document.getElementById('modalName').value = c.name;
    document.getElementById('modalContact').value = c.contact_number || '';
    document.getElementById('modalAddress').value = c.address || '';
    document.getElementById('modalNotes').value = c.notes || '';
    document.getElementById('customerModal').style.display = 'flex';
}

function closeCustomerModal() {
    document.getElementById('customerModal').style.display = 'none';
}
</script>

<?php require_once __DIR__ . '/../../includes/footer.php'; ?>

