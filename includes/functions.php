<?php
/**
 * PAZINGS INVENTORY & SALES MANAGEMENT SYSTEM
 * Helper and Formatting Functions
 */

/**
 * Escape HTML output for XSS prevention
 */
function e(?string $str): string {
    return htmlspecialchars($str ?? '', ENT_QUOTES, 'UTF-8');
}

/**
 * Format currency with Peso sign
 */
function formatCurrency($amount): string {
    $num = is_numeric($amount) ? (float)$amount : 0.0;
    return '₱' . number_format($num, 2);
}

/**
 * Format date for display
 */
function formatDate(?string $date, string $format = 'M d, Y'): string {
    if (!$date) return '-';
    $time = strtotime($date);
    return $time ? date($format, $time) : $date;
}

/**
 * Log audit events
 */
function logAudit(PDO $pdo, ?int $userId, string $action, string $table, ?int $recordId = null, ?string $details = null): void {
    try {
        $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
        $stmt = $pdo->prepare("
            INSERT INTO audit_logs (user_id, action, table_name, record_id, details, ip_address)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$userId, $action, $table, $recordId, $details, $ip]);
    } catch (Exception $e) {
        // Fail silently for audit logs to not block business transactions
        error_log("Audit log error: " . $e->getMessage());
    }
}

/**
 * Generate a unique sequential-style transaction code
 */
function generateTransactionCode(PDO $pdo, string $prefix, string $date): string {
    $datePart = date('Ymd', strtotime($date));
    $search = $prefix . '-' . $datePart . '-%';
    
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM transactions WHERE transaction_code LIKE ?");
    $stmt->execute([$search]);
    $count = (int)$stmt->fetchColumn() + 1;
    
    return sprintf("%s-%s-%03d", $prefix, $datePart, $count);
}

/**
 * Find or create a customer by name, avoiding duplicates
 */
function findOrCreateCustomer(PDO $pdo, string $name, ?string $phone = null, ?string $address = null): ?int {
    $cleanName = trim($name);
    if ($cleanName === '') {
        return null;
    }

    // Lookup existing case-insensitive
    $stmt = $pdo->prepare("SELECT id FROM customers WHERE LOWER(name) = LOWER(?) LIMIT 1");
    $stmt->execute([$cleanName]);
    $id = $stmt->fetchColumn();

    if ($id) {
        return (int)$id;
    }

    // Insert new customer
    $insert = $pdo->prepare("INSERT INTO customers (name, contact_number, address) VALUES (?, ?, ?)");
    $insert->execute([$cleanName, $phone, $address]);
    return (int)$pdo->lastInsertId();
}

/**
 * Get active services for a category (water or laundry)
 */
function getServicesByCategory(PDO $pdo, string $category): array {
    $stmt = $pdo->prepare("
        SELECT id, service_code, service_name, default_rate, unit_label 
        FROM services 
        WHERE category = ? AND is_active = 1 
        ORDER BY display_order ASC, id ASC
    ");
    $stmt->execute([$category]);
    return $stmt->fetchAll();
}
