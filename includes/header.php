<?php
/**
 * PAZINGS INVENTORY & SALES MANAGEMENT SYSTEM
 * Clean Header Include (No Emojis)
 */
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/csrf.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/functions.php';

$pageTitle = $pageTitle ?? APP_NAME;
$flash = getFlash();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
    <title><?= e($pageTitle) ?> | Pazings</title>
    <link rel="stylesheet" href="<?= BASE_URL ?>assets/css/style.css">
    <link rel="stylesheet" href="<?= BASE_URL ?>assets/css/print.css" media="print">
</head>
<body>

<?php require_once __DIR__ . '/navbar.php'; ?>

<main class="main-wrapper">
    <?php if ($flash): ?>
        <div class="alert alert-<?= e($flash['type']) ?>" role="alert">
            <div><?= e($flash['message']) ?></div>
            <button type="button" onclick="this.parentElement.remove()" style="background:none;border:none;cursor:pointer;font-size:1rem;color:inherit;padding:0 4px;">Close</button>
        </div>
    <?php endif; ?>
