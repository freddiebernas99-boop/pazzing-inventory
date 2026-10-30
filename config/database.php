<?php
/**
 * PAZINGS INVENTORY & SALES MANAGEMENT SYSTEM
 * Database Configuration (PDO)
 * Supports local XAMPP environment and production hosting (cPanel/Cloud)
 */

// Detect environment: Localhost vs Production
$isLocal = in_array($_SERVER['REMOTE_ADDR'] ?? '127.0.0.1', ['127.0.0.1', '::1']) 
           || (php_sapi_name() === 'cli') 
           || (strpos($_SERVER['HTTP_HOST'] ?? '', 'localhost') !== false);

if ($isLocal) {
    // Local XAMPP Settings
    define('DB_HOST', getenv('DB_HOST') ?: '127.0.0.1');
    define('DB_PORT', getenv('DB_PORT') ?: '3306');
    define('DB_NAME', getenv('DB_NAME') ?: 'pazings_db');
    define('DB_USER', getenv('DB_USER') ?: 'root');
    define('DB_PASS', getenv('DB_PASS') ?: ''); // Default XAMPP has no password
} else {
    // Production Settings (Replace with your cPanel MySQL details upon upload)
    define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
    define('DB_PORT', getenv('DB_PORT') ?: '3306');
    define('DB_NAME', getenv('DB_NAME') ?: 'u123456_pazings_db');
    define('DB_USER', getenv('DB_USER') ?: 'u123456_pazings_user');
    define('DB_PASS', getenv('DB_PASS') ?: 'YourStrongProductionPasswordHere');
}

define('DB_CHARSET', 'utf8mb4');

/**
 * Returns a shared PDO database connection instance.
 * @return PDO
 * @throws PDOException
 */
function getDbConnection(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false, // Genuine prepared statements
        ];
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
    }
    return $pdo;
}
