<?php
/**
 * PAZINGS INVENTORY & SALES MANAGEMENT SYSTEM
 * Staff & User Account Management (Owner-Only, Minimal Style, No Emojis)
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/csrf.php';
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/functions.php';

requireRole('owner');
$pdo = getDbConnection();
$currentUser = getCurrentUser();

$pageTitle = 'Staff Accounts';

// Handle user creation
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'create_user') {
    validateCsrfOrDie();

    $username = trim($_POST['username'] ?? '');
    $fullName = trim($_POST['full_name'] ?? '');
    $role = trim($_POST['role'] ?? 'staff');
    $password = $_POST['password'] ?? '';

    if ($username === '' || $fullName === '' || $password === '') {
        setFlash('danger', 'All fields are required to create a new user account.');
    } elseif (strlen($password) < 6) {
        setFlash('danger', 'Password must be at least 6 characters long.');
    } else {
        try {
            $check = $pdo->prepare("SELECT id FROM users WHERE username = ?");
            $check->execute([$username]);
            if ($check->fetch()) {
                setFlash('danger', "Username '$username' already exists.");
            } else {
                $hash = password_hash($password, PASSWORD_BCRYPT);
                $stmt = $pdo->prepare("INSERT INTO users (username, password_hash, full_name, role, status) VALUES (?, ?, ?, ?, 'active')");
                $stmt->execute([$username, $hash, $fullName, $role]);
                $newId = (int)$pdo->lastInsertId();

                logAudit($pdo, $currentUser['id'], 'CREATE_USER', 'users', $newId, "Created user $username ($role)");
                setFlash('success', "Account for $fullName ($username) created successfully.");
            }
        } catch (Exception $e) {
            setFlash('danger', "Error creating user: " . $e->getMessage());
        }
    }
    header("Location: users.php");
    exit;
}

// Handle Status Toggle (Activate / Deactivate)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'toggle_status') {
    validateCsrfOrDie();

    $userId = (int)($_POST['user_id'] ?? 0);
    $newStatus = $_POST['new_status'] === 'active' ? 'active' : 'inactive';

    if ($userId === (int)$currentUser['id']) {
        setFlash('danger', 'You cannot deactivate your own account.');
    } else {
        $stmt = $pdo->prepare("UPDATE users SET status = ? WHERE id = ?");
        $stmt->execute([$newStatus, $userId]);

        logAudit($pdo, $currentUser['id'], 'STATUS_CHANGE', 'users', $userId, "Changed status to $newStatus");
        setFlash('success', "User account status updated to $newStatus.");
    }
    header("Location: users.php");
    exit;
}

// Handle Password Reset
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'reset_password') {
    validateCsrfOrDie();

    $userId = (int)($_POST['user_id'] ?? 0);
    $newPass = $_POST['new_password'] ?? '';

    if (strlen($newPass) < 6) {
        setFlash('danger', 'Password must be at least 6 characters long.');
    } else {
        $hash = password_hash($newPass, PASSWORD_BCRYPT);
        $stmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
        $stmt->execute([$hash, $userId]);

        logAudit($pdo, $currentUser['id'], 'RESET_PASSWORD', 'users', $userId, "Reset password for user id $userId");
        setFlash('success', "Password updated successfully.");
    }
    header("Location: users.php");
    exit;
}

$users = $pdo->query("SELECT id, username, full_name, role, status, created_at FROM users ORDER BY role ASC, full_name ASC")->fetchAll();

require_once __DIR__ . '/../../includes/header.php';
?>

<div class="page-header">
    <div>
        <h1 class="page-title">Staff Accounts</h1>
        <p class="page-subtitle">Manage user accounts and access permissions</p>
    </div>
    <div>
        <button type="button" onclick="openNewUserModal()" class="btn btn-primary btn-sm">
            Add Staff Account
        </button>
    </div>
</div>

<div class="card">
    <div class="card-header">
        <h2 class="card-title">User Accounts (<?= count($users) ?>)</h2>
    </div>

    <div class="table-responsive">
        <table class="data-table">
            <thead>
                <tr>
                    <th style="width: 35px;">No.</th>
                    <th>Full Name</th>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th style="text-align: center; width: 180px;">Actions</th>
                </tr>
            </thead>
            <tbody>
                <?php 
                $no = 1;
                foreach ($users as $u): 
                    $isSelf = ($u['id'] === (int)$currentUser['id']);
                ?>
                    <tr>
                        <td><?= $no++ ?></td>
                        <td><strong><?= e($u['full_name']) ?></strong></td>
                        <td><code><?= e($u['username']) ?></code></td>
                        <td>
                            <span class="badge badge-<?= $u['role'] === 'owner' ? 'water' : 'shared' ?>">
                                <?= strtoupper($u['role']) ?>
                            </span>
                        </td>
                        <td>
                            <span class="badge badge-<?= $u['status'] === 'active' ? 'paid' : 'unpaid' ?>">
                                <?= ucfirst($u['status']) ?>
                            </span>
                        </td>
                        <td style="font-size: 0.8rem; color: var(--text-muted);"><?= formatDate($u['created_at']) ?></td>
                        <td style="text-align: center;">
                            <button type="button" class="btn btn-secondary btn-sm" 
                                    onclick="openResetModal(<?= $u['id'] ?>, '<?= e(addslashes($u['full_name'])) ?>')">
                                Reset Password
                            </button>

                            <?php if (!$isSelf): ?>
                                <form method="POST" action="users.php" style="display: inline;" 
                                      onsubmit="return confirm('Change status of <?= e($u['full_name']) ?> to <?= $u['status'] === 'active' ? 'INACTIVE' : 'ACTIVE' ?>?');">
                                    <?= getCsrfInput() ?>
                                    <input type="hidden" name="action" value="toggle_status">
                                    <input type="hidden" name="user_id" value="<?= $u['id'] ?>">
                                    <input type="hidden" name="new_status" value="<?= $u['status'] === 'active' ? 'inactive' : 'active' ?>">
                                    <button type="submit" class="btn <?= $u['status'] === 'active' ? 'btn-danger' : 'btn-secondary' ?> btn-sm">
                                        <?= $u['status'] === 'active' ? 'Deactivate' : 'Activate' ?>
                                    </button>
                                </form>
                            <?php endif; ?>
                        </td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</div>

<!-- Modal: Add New Staff -->
<div id="newUserModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); z-index: 2000; align-items: center; justify-content: center;">
    <div style="background: #ffffff; width: 100%; max-width: 400px; margin: 16px; border-radius: var(--radius-md); padding: 20px; border: 1px solid var(--border);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
            <h3 style="color: var(--navy); font-size: 1.1rem; font-weight: 600;">Create User Account</h3>
            <button type="button" onclick="closeNewUserModal()" style="background:none; border:none; font-size: 1.1rem; cursor:pointer;">&times;</button>
        </div>

        <form method="POST" action="users.php">
            <?= getCsrfInput() ?>
            <input type="hidden" name="action" value="create_user">

            <div class="form-group">
                <label class="form-label" for="full_name">Full Name</label>
                <input type="text" id="full_name" name="full_name" class="form-control" required placeholder="Full Name">
            </div>

            <div class="form-group">
                <label class="form-label" for="new_username">Username</label>
                <input type="text" id="new_username" name="username" class="form-control" required placeholder="Username">
            </div>

            <div class="form-group">
                <label class="form-label" for="user_role">Role</label>
                <select id="user_role" name="role" class="form-select">
                    <option value="staff" selected>Staff (Sales encoding & daily records)</option>
                    <option value="owner">Owner (Full system control)</option>
                </select>
            </div>

            <div class="form-group">
                <label class="form-label" for="new_password">Password</label>
                <input type="password" id="new_password" name="password" class="form-control" required placeholder="Min 6 characters">
            </div>

            <div style="display: flex; gap: 8px; margin-top: 16px;">
                <button type="submit" class="btn btn-primary" style="flex: 1;">Create Account</button>
                <button type="button" onclick="closeNewUserModal()" class="btn btn-secondary">Cancel</button>
            </div>
        </form>
    </div>
</div>

<!-- Modal: Reset Password -->
<div id="resetModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); z-index: 2000; align-items: center; justify-content: center;">
    <div style="background: #ffffff; width: 100%; max-width: 380px; margin: 16px; border-radius: var(--radius-md); padding: 20px; border: 1px solid var(--border);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
            <h3 style="color: var(--navy); font-size: 1.1rem; font-weight: 600;">Reset Password</h3>
            <button type="button" onclick="closeResetModal()" style="background:none; border:none; font-size: 1.1rem; cursor:pointer;">&times;</button>
        </div>

        <form method="POST" action="users.php">
            <?= getCsrfInput() ?>
            <input type="hidden" name="action" value="reset_password">
            <input type="hidden" name="user_id" id="resetUserId" value="0">

            <p style="margin-bottom: 12px; font-size: 0.85rem;">Setting new password for <strong id="resetUserName"></strong>:</p>

            <div class="form-group">
                <label class="form-label" for="reset_new_password">New Password</label>
                <input type="password" id="reset_new_password" name="new_password" class="form-control" required placeholder="Min 6 characters">
            </div>

            <div style="display: flex; gap: 8px; margin-top: 16px;">
                <button type="submit" class="btn btn-primary" style="flex: 1;">Save Password</button>
                <button type="button" onclick="closeResetModal()" class="btn btn-secondary">Cancel</button>
            </div>
        </form>
    </div>
</div>

<script>
function openNewUserModal() {
    document.getElementById('newUserModal').style.display = 'flex';
}
function closeNewUserModal() {
    document.getElementById('newUserModal').style.display = 'none';
}

function openResetModal(id, name) {
    document.getElementById('resetUserId').value = id;
    document.getElementById('resetUserName').textContent = name;
    document.getElementById('resetModal').style.display = 'flex';
}
function closeResetModal() {
    document.getElementById('resetModal').style.display = 'none';
}
</script>

<?php require_once __DIR__ . '/../../includes/footer.php'; ?>

