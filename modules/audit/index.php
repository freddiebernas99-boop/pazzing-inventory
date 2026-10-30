<?php
/**
 * PAZINGS INVENTORY & SALES MANAGEMENT SYSTEM
 * Audit Trail & Security Activity Log (Owner-Only, Minimal Style, No Emojis)
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/functions.php';

requireRole('owner');
$pdo = getDbConnection();

$pageTitle = 'Audit Trail';

$limit = 50;
$stmt = $pdo->prepare("
    SELECT a.id, a.action, a.table_name, a.record_id, a.details, a.ip_address, a.created_at,
           u.full_name AS user_name, u.role AS user_role
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT ?
");
$stmt->bindValue(1, $limit, PDO::PARAM_INT);
$stmt->execute();
$logs = $stmt->fetchAll();

require_once __DIR__ . '/../../includes/header.php';
?>

<div class="page-header">
    <div>
        <h1 class="page-title">Audit Trail</h1>
        <p class="page-subtitle">Security log of all financial creations, deletions, and rate changes</p>
    </div>
</div>

<div class="card">
    <div class="card-header">
        <h2 class="card-title">Activity Log (Latest <?= count($logs) ?> entries)</h2>
    </div>

    <div class="table-responsive">
        <table class="data-table">
            <thead>
                <tr>
                    <th style="width: 35px;">No.</th>
                    <th>Timestamp</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Table</th>
                    <th>Details</th>
                    <th>IP Address</th>
                </tr>
            </thead>
            <tbody>
                <?php if (empty($logs)): ?>
                    <tr>
                        <td colspan="7" style="text-align: center; padding: 24px; color: var(--text-muted);">
                            No audit events logged yet.
                        </td>
                    </tr>
                <?php else: ?>
                    <?php 
                    $no = 1;
                    foreach ($logs as $l): 
                    ?>
                        <tr>
                            <td><?= $no++ ?></td>
                            <td style="font-size: 0.8rem; color: var(--text-muted);">
                                <?= formatDate($l['created_at'], 'M d, Y h:i A') ?>
                            </td>
                            <td>
                                <strong><?= e($l['user_name'] ?? 'System') ?></strong>
                                <?php if ($l['user_role']): ?>
                                    <span style="font-size: 0.72rem; color: var(--text-muted);">(<?= e($l['user_role']) ?>)</span>
                                <?php endif; ?>
                            </td>
                            <td>
                                <span class="badge badge-water"><?= e($l['action']) ?></span>
                            </td>
                            <td><code><?= e($l['table_name']) ?></code></td>
                            <td><?= e($l['details']) ?></td>
                            <td style="font-size: 0.8rem; color: var(--text-muted);"><?= e($l['ip_address']) ?></td>
                        </tr>
                    <?php endforeach; ?>
                <?php endif; ?>
            </tbody>
        </table>
    </div>
</div>

<?php require_once __DIR__ . '/../../includes/footer.php'; ?>
