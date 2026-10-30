<?php
/**
 * PAZINGS INVENTORY & SALES MANAGEMENT SYSTEM
 * Clean, Minimal Top Navigation (Navy & Blue Theme, No Emojis)
 */
require_once __DIR__ . '/auth.php';

$currentUser = getCurrentUser();
$role = $currentUser['role'] ?? 'staff';
$currentScript = basename($_SERVER['PHP_SELF']);
$currentDir = basename(dirname($_SERVER['PHP_SELF']));
?>
<header class="app-header">
    <div class="nav-container">
        <a href="<?= BASE_URL ?>index.php" class="brand-logo">
            <span>PAZINGS</span>
            <span class="brand-badge"><?= strtoupper($role) ?></span>
        </a>

        <button type="button" class="nav-toggle-btn" id="navToggle" aria-label="Toggle navigation">
            Menu
        </button>

        <ul class="nav-links" id="navLinks">
            <li>
                <a href="<?= BASE_URL ?>index.php" class="<?= $currentScript === 'index.php' && $currentDir !== 'water' && $currentDir !== 'laundry' && $currentDir !== 'expenses' && $currentDir !== 'reports' && $currentDir !== 'settings' && $currentDir !== 'customers' ? 'active' : '' ?>">
                    Dashboard
                </a>
            </li>
            <li>
                <a href="<?= BASE_URL ?>modules/water/index.php" class="<?= $currentDir === 'water' ? 'active' : '' ?>">
                    Water Refilling
                </a>
            </li>
            <li>
                <a href="<?= BASE_URL ?>modules/laundry/index.php" class="<?= $currentDir === 'laundry' ? 'active' : '' ?>">
                    Laundry
                </a>
            </li>
            <li>
                <a href="<?= BASE_URL ?>modules/expenses/index.php" class="<?= $currentDir === 'expenses' ? 'active' : '' ?>">
                    Expenses
                </a>
            </li>
            <li>
                <a href="<?= BASE_URL ?>modules/reports/daily.php" class="<?= $currentDir === 'reports' ? 'active' : '' ?>">
                    Reports
                </a>
            </li>

            <?php if (isOwner()): ?>
                <li>
                    <a href="<?= BASE_URL ?>modules/customers/index.php" class="<?= $currentDir === 'customers' ? 'active' : '' ?>">
                        Customers
                    </a>
                </li>
                <li>
                    <a href="<?= BASE_URL ?>modules/settings/rates.php" class="<?= $currentScript === 'rates.php' ? 'active' : '' ?>">
                        Rates
                    </a>
                </li>
                <li>
                    <a href="<?= BASE_URL ?>modules/settings/users.php" class="<?= $currentScript === 'users.php' ? 'active' : '' ?>">
                        Staff
                    </a>
                </li>
            <?php endif; ?>

            <li style="margin-left: 6px;">
                <span class="user-badge"><?= e($currentUser['full_name'] ?? 'User') ?></span>
            </li>
            <li>
                <a href="<?= BASE_URL ?>logout.php" style="color: var(--danger);">Logout</a>
            </li>
        </ul>
    </div>
</header>
