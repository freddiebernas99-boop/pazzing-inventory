<?php
/**
 * PAZINGS INVENTORY & SALES MANAGEMENT SYSTEM
 * Redirect to unified Water Refilling page
 */
require_once __DIR__ . '/../../config/config.php';
$date = $_GET['date'] ?? date('Y-m-d');
header("Location: index.php?date=" . urlencode($date));
exit;
