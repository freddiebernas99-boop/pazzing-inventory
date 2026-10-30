<?php
/**
 * PAZINGS INVENTORY & SALES MANAGEMENT SYSTEM
 * Database Auto-Installer / Migration Runner
 * Run via browser: http://localhost/PAZINGS-INVENTORY/database/db_setup.php
 * Or CLI: php database/db_setup.php
 */

require_once __DIR__ . '/../config/database.php';

$isCli = (php_sapi_name() === 'cli');

function outputMsg($msg, $isSuccess = true, $isCli = false) {
    if ($isCli) {
        echo ($isSuccess ? "[SUCCESS] " : "[ERROR] ") . $msg . PHP_EOL;
    } else {
        $color = $isSuccess ? '#0d6efd' : '#dc3545';
        $bg = $isSuccess ? '#f0f7ff' : '#fff5f5';
        echo "<div style='padding: 12px 16px; margin: 8px 0; border-radius: 6px; font-family: sans-serif; background: $bg; color: $color; border: 1px solid $color;'>$msg</div>";
    }
}

if (!$isCli) {
    echo "<!DOCTYPE html><html><head><title>Database Setup - Pazings</title><style>body{max-width:700px;margin:40px auto;font-family:Segoe UI,sans-serif;padding:0 20px;color:#1e293b;}</style></head><body>";
    echo "<h2>Pazings Database Initialization</h2>";
}

try {
    // 1. Connect to MySQL Server (without db selected) to ensure DB exists
    $dsnNoDb = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";charset=" . DB_CHARSET;
    $pdoRoot = new PDO($dsnNoDb, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

    // Create DB if not exists
    $pdoRoot->exec("CREATE DATABASE IF NOT EXISTS `" . DB_NAME . "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;");
    outputMsg("Database '" . DB_NAME . "' verified/created.", true, $isCli);

    // 2. Connect to the Pazings database
    $pdo = getDbConnection();

    // 3. Run schema.sql
    $schemaSql = file_get_contents(__DIR__ . '/schema.sql');
    if ($schemaSql === false) {
        throw new Exception("Unable to read schema.sql");
    }
    $pdo->exec($schemaSql);
    outputMsg("Database tables initialized successfully from schema.sql.", true, $isCli);

    // 4. Run seed.sql
    $seedSql = file_get_contents(__DIR__ . '/seed.sql');
    if ($seedSql === false) {
        throw new Exception("Unable to read seed.sql");
    }
    $pdo->exec($seedSql);
    outputMsg("Default service rates seeded successfully. No user accounts or passwords were created.", true, $isCli);

    if (!$isCli) {
        echo "<hr><p><strong>Setup Complete!</strong> Create the first owner account from a trusted command line with <code>php database/create_owner.php</code>.</p>";
        echo "<p><a href='../login.php' style='display:inline-block;padding:10px 20px;background:#0d6efd;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>Go to Login Page</a></p>";
        echo "</body></html>";
    }
} catch (Exception $e) {
    outputMsg("Database setup failed: " . $e->getMessage(), false, $isCli);
    if (!$isCli) {
        echo "<p>Please ensure MySQL is running in XAMPP and your credentials in <code>config/database.php</code> are correct.</p></body></html>";
    }
}
