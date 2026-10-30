<?php
/**
 * PAZINGS INVENTORY & SALES MANAGEMENT SYSTEM
 * Service Rates Configuration (Owner-Only, Minimal Style, No Emojis)
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/csrf.php';
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/functions.php';

requireRole('owner');
$pdo = getDbConnection();
$currentUser = getCurrentUser();

$pageTitle = 'Service Rates';

// Handle updating existing rates
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'update_rates') {
    validateCsrfOrDie();

    $rates = $_POST['rates'] ?? [];
    $names = $_POST['names'] ?? [];
    $statuses = $_POST['statuses'] ?? [];

    $updatedCount = 0;
    foreach ($rates as $id => $rateVal) {
        $sid = (int)$id;
        $rate = (float)$rateVal;
        $name = trim($names[$sid] ?? '');
        $isActive = isset($statuses[$sid]) ? 1 : 0;

        if ($sid > 0 && $name !== '' && $rate >= 0) {
            $stmt = $pdo->prepare("UPDATE services SET service_name = ?, default_rate = ?, is_active = ? WHERE id = ?");
            $stmt->execute([$name, $rate, $isActive, $sid]);
            $updatedCount++;
        }
    }

    logAudit($pdo, $currentUser['id'], 'UPDATE_RATES', 'services', null, "Updated $updatedCount service rate(s)");
    setFlash('success', "Service rates updated. Existing transactions retain their original rates.");
    header("Location: rates.php");
    exit;
}

// Handle adding a new service
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'add_service') {
    validateCsrfOrDie();

    $category = trim($_POST['category'] ?? '');
    $code = trim($_POST['service_code'] ?? '');
    $name = trim($_POST['service_name'] ?? '');
    $rate = (float)($_POST['default_rate'] ?? 0);
    $unit = trim($_POST['unit_label'] ?? 'qty');

    if (!in_array($category, ['water', 'laundry']) || $code === '' || $name === '') {
        setFlash('danger', 'Please provide a valid category, code, and service name.');
    } else {
        try {
            $stmt = $pdo->prepare("
                INSERT INTO services (category, service_code, service_name, default_rate, unit_label)
                VALUES (?, ?, ?, ?, ?)
            ");
            $stmt->execute([$category, $code, $name, $rate, $unit]);
            $newId = (int)$pdo->lastInsertId();

            logAudit($pdo, $currentUser['id'], 'CREATE_SERVICE', 'services', $newId, "Added new service $name ($category) at ₱$rate");
            setFlash('success', "Service '$name' added successfully.");
        } catch (Exception $e) {
            setFlash('danger', "Error adding service: " . $e->getMessage());
        }
    }
    header("Location: rates.php");
    exit;
}

$waterServices = $pdo->query("SELECT * FROM services WHERE category = 'water' ORDER BY display_order ASC, id ASC")->fetchAll();
$laundryServices = $pdo->query("SELECT * FROM services WHERE category = 'laundry' ORDER BY display_order ASC, id ASC")->fetchAll();

require_once __DIR__ . '/../../includes/header.php';
?>

<div class="page-header">
    <div>
        <h1 class="page-title">Service Rates</h1>
        <p class="page-subtitle">Configure pricing for Water Refilling and Laundry services</p>
    </div>
    <div>
        <button type="button" onclick="openNewServiceModal()" class="btn btn-secondary btn-sm">
            Add New Service
        </button>
    </div>
</div>

<div class="alert alert-info">
    <div>Rate Protection: Updating a rate applies to future sales only. Past transactions retain their recorded prices.</div>
</div>

<form method="POST" action="rates.php">
    <?= getCsrfInput() ?>
    <input type="hidden" name="action" value="update_rates">

    <!-- Water Refilling Rates Card -->
    <div class="card">
        <div class="card-header">
            <h2 class="card-title">Water Refilling Rates</h2>
            <span class="badge badge-water">Water</span>
        </div>

        <div class="table-responsive">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Service Name</th>
                        <th>Code</th>
                        <th style="max-width: 140px;">Default Rate (₱)</th>
                        <th>Unit</th>
                        <th style="text-align: center; width: 60px;">Active</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($waterServices as $ws): ?>
                        <tr>
                            <td>
                                <input type="text" name="names[<?= $ws['id'] ?>]" class="form-control" 
                                       value="<?= e($ws['service_name']) ?>" required style="max-width: 240px; min-height: 32px; padding: 4px 8px;">
                            </td>
                            <td><code><?= e($ws['service_code']) ?></code></td>
                            <td>
                                <input type="number" name="rates[<?= $ws['id'] ?>]" class="form-control" 
                                       value="<?= (float)$ws['default_rate'] ?>" step="0.50" min="0" required style="max-width: 110px; min-height: 32px; padding: 4px 8px; font-weight: 700;">
                            </td>
                            <td style="color: var(--text-muted); font-size: 0.82rem;">per <?= e($ws['unit_label']) ?></td>
                            <td style="text-align: center;">
                                <input type="checkbox" name="statuses[<?= $ws['id'] ?>]" value="1" 
                                       <?= $ws['is_active'] ? 'checked' : '' ?> style="width: 18px; height: 18px; cursor: pointer;">
                            </td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    </div>

    <!-- Laundry Rates Card -->
    <div class="card">
        <div class="card-header">
            <h2 class="card-title">Laundry Rates & Supplies</h2>
            <span class="badge badge-laundry">Laundry</span>
        </div>

        <div class="table-responsive">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Service Name</th>
                        <th>Code</th>
                        <th style="max-width: 140px;">Default Rate (₱)</th>
                        <th>Unit</th>
                        <th style="text-align: center; width: 60px;">Active</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($laundryServices as $ls): ?>
                        <tr>
                            <td>
                                <input type="text" name="names[<?= $ls['id'] ?>]" class="form-control" 
                                       value="<?= e($ls['service_name']) ?>" required style="max-width: 240px; min-height: 32px; padding: 4px 8px;">
                            </td>
                            <td><code><?= e($ls['service_code']) ?></code></td>
                            <td>
                                <input type="number" name="rates[<?= $ls['id'] ?>]" class="form-control" 
                                       value="<?= (float)$ls['default_rate'] ?>" step="0.50" min="0" required style="max-width: 110px; min-height: 32px; padding: 4px 8px; font-weight: 700;">
                            </td>
                            <td style="color: var(--text-muted); font-size: 0.82rem;">per <?= e($ls['unit_label']) ?></td>
                            <td style="text-align: center;">
                                <input type="checkbox" name="statuses[<?= $ls['id'] ?>]" value="1" 
                                       <?= $ls['is_active'] ? 'checked' : '' ?> style="width: 18px; height: 18px; cursor: pointer;">
                            </td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>

        <div style="margin-top: 14px;">
            <button type="submit" class="btn btn-primary">
                Save Rate Changes
            </button>
        </div>
    </div>
</form>

<!-- Modal to Add New Service -->
<div id="newServiceModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); z-index: 2000; align-items: center; justify-content: center;">
    <div style="background: #ffffff; width: 100%; max-width: 420px; margin: 16px; border-radius: var(--radius-md); padding: 20px; border: 1px solid var(--border);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
            <h3 style="color: var(--navy); font-size: 1.1rem; font-weight: 600;">Add Service Type</h3>
            <button type="button" onclick="closeNewServiceModal()" style="background:none; border:none; font-size: 1.1rem; cursor:pointer;">&times;</button>
        </div>

        <form method="POST" action="rates.php">
            <?= getCsrfInput() ?>
            <input type="hidden" name="action" value="add_service">

            <div class="form-group">
                <label class="form-label" for="category">Category</label>
                <select id="category" name="category" class="form-select" required>
                    <option value="water">Water Refilling</option>
                    <option value="laundry">Laundry</option>
                </select>
            </div>

            <div class="form-group">
                <label class="form-label" for="service_name">Service Name</label>
                <input type="text" id="service_name" name="service_name" class="form-control" required placeholder="e.g. Dry Clean, Cap">
            </div>

            <div class="form-group">
                <label class="form-label" for="service_code">Unique Code (no spaces)</label>
                <input type="text" id="service_code" name="service_code" class="form-control" required placeholder="e.g. dry_clean">
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label class="form-label" for="default_rate">Default Rate (₱)</label>
                    <input type="number" id="default_rate" name="default_rate" class="form-control" step="0.50" min="0" required placeholder="0.00">
                </div>
                <div class="form-group">
                    <label class="form-label" for="unit_label">Unit</label>
                    <input type="text" id="unit_label" name="unit_label" class="form-control" value="pcs">
                </div>
            </div>

            <div style="display: flex; gap: 8px; margin-top: 16px;">
                <button type="submit" class="btn btn-primary" style="flex: 1;">Create Service</button>
                <button type="button" onclick="closeNewServiceModal()" class="btn btn-secondary">Cancel</button>
            </div>
        </form>
    </div>
</div>

<script>
function openNewServiceModal() {
    document.getElementById('newServiceModal').style.display = 'flex';
}
function closeNewServiceModal() {
    document.getElementById('newServiceModal').style.display = 'none';
}
</script>

<?php require_once __DIR__ . '/../../includes/footer.php'; ?>

