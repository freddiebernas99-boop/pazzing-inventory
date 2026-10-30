<?php
/**
 * PAZINGS INVENTORY & SALES MANAGEMENT SYSTEM
 * Logout Handler
 */

require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/includes/auth.php';

logoutUser();

setFlash('info', 'You have been successfully logged out.');
header("Location: " . BASE_URL . "login.php");
exit;
