<?php
/**
 * PAZINGS INVENTORY & SALES MANAGEMENT SYSTEM
 * Cross-Site Request Forgery (CSRF) Protection
 */

function generateCsrfToken(): string {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function getCsrfInput(): string {
    $token = htmlspecialchars(generateCsrfToken(), ENT_QUOTES, 'UTF-8');
    return '<input type="hidden" name="csrf_token" value="' . $token . '">';
}

function verifyCsrfToken(?string $token): bool {
    if (empty($_SESSION['csrf_token']) || empty($token)) {
        return false;
    }
    return hash_equals($_SESSION['csrf_token'], $token);
}

function validateCsrfOrDie(): void {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $submitted = $_POST['csrf_token'] ?? '';
        if (!verifyCsrfToken($submitted)) {
            http_response_code(403);
            die("Security error: Invalid or expired CSRF token. Please refresh the page and try again.");
        }
    }
}
