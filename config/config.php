<?php
/**
 * PAZINGS INVENTORY & SALES MANAGEMENT SYSTEM
 * Global Configuration & Session Management
 */

// Philippine Standard Time (PST / UTC+8)
date_default_timezone_set('Asia/Manila');

// Start secure session if not already active
if (session_status() === PHP_SESSION_NONE) {
    // Configure session security
    ini_set('session.cookie_httponly', 1);
    ini_set('session.use_only_cookies', 1);
    
    // Enable secure cookies if on HTTPS
    $isSecure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || ($_SERVER['SERVER_PORT'] ?? 80) == 443;
    if ($isSecure) {
        ini_set('session.cookie_secure', 1);
    }
    
    session_start();
}

// Application Constants
define('APP_NAME', 'Pazings Laundry Shop & Water Station');
define('APP_SHORT_NAME', 'Pazings');
define('APP_CURRENCY', '₱');

// Dynamic Base URL detection
$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https://' : 'http://';
$host = $_SERVER['HTTP_HOST'] ?? 'localhost';
$scriptDir = dirname($_SERVER['SCRIPT_NAME'] ?? '');

// Normalize BASE_URL
// If running inside subdirectory like /PAZINGS-INVENTORY, compute relative path
$requestUri = $_SERVER['REQUEST_URI'] ?? '/';
$projectFolder = 'PAZINGS-INVENTORY';
$pos = strpos($requestUri, '/' . $projectFolder);
if ($pos !== false) {
    define('BASE_URL', $protocol . $host . substr($requestUri, 0, $pos + strlen($projectFolder) + 1));
} else {
    define('BASE_URL', $protocol . $host . '/');
}

/**
 * Flash message helper for alerts across page redirects
 */
function setFlash($type, $message) {
    $_SESSION['flash'] = [
        'type' => $type, // 'success', 'danger', 'info', 'warning'
        'message' => $message
    ];
}

function getFlash() {
    if (isset($_SESSION['flash'])) {
        $flash = $_SESSION['flash'];
        unset($_SESSION['flash']);
        return $flash;
    }
    return null;
}
