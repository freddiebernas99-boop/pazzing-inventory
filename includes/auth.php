<?php
/**
 * PAZINGS INVENTORY & SALES MANAGEMENT SYSTEM
 * Authentication and Role-Based Access Control
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/database.php';

function isLoggedIn(): bool {
    return !empty($_SESSION['user_id']) && !empty($_SESSION['user_role']);
}

function getCurrentUser(): ?array {
    if (!isLoggedIn()) {
        return null;
    }
    return [
        'id' => $_SESSION['user_id'],
        'username' => $_SESSION['username'] ?? '',
        'full_name' => $_SESSION['full_name'] ?? '',
        'role' => $_SESSION['user_role'] ?? 'staff'
    ];
}

function isOwner(): bool {
    return isLoggedIn() && ($_SESSION['user_role'] === 'owner');
}

function requireLogin(): void {
    if (!isLoggedIn()) {
        setFlash('warning', 'Please log in to continue.');
        $loginUrl = BASE_URL . 'login.php';
        header("Location: " . $loginUrl);
        exit;
    }
}

function requireRole(string $role): void {
    requireLogin();
    if ($_SESSION['user_role'] !== $role && $_SESSION['user_role'] !== 'owner') {
        http_response_code(403);
        setFlash('danger', 'Access denied. You do not have permission to view that page.');
        header("Location: " . BASE_URL . 'index.php');
        exit;
    }
}

function loginUser(string $username, string $password): array {
    $pdo = getDbConnection();
    $cleanUser = trim($username);

    $stmt = $pdo->prepare("SELECT id, username, password_hash, full_name, role, status FROM users WHERE username = ? LIMIT 1");
    $stmt->execute([$cleanUser]);
    $user = $stmt->fetch();

    if (!$user) {
        return ['success' => false, 'message' => 'Invalid username or password.'];
    }

    if ($user['status'] !== 'active') {
        return ['success' => false, 'message' => 'This account has been deactivated. Please contact the owner.'];
    }

    if (!password_verify($password, $user['password_hash'])) {
        return ['success' => false, 'message' => 'Invalid username or password.'];
    }

    // Regenerate session ID upon successful login to prevent session fixation
    if (!headers_sent()) {
        session_regenerate_id(true);
    }

    $_SESSION['user_id'] = (int)$user['id'];
    $_SESSION['username'] = $user['username'];
    $_SESSION['full_name'] = $user['full_name'];
    $_SESSION['user_role'] = $user['role'];

    // Audit log
    require_once __DIR__ . '/functions.php';
    logAudit($pdo, (int)$user['id'], 'LOGIN', 'users', (int)$user['id'], 'User logged in successfully');

    return ['success' => true, 'user' => $user];
}

function logoutUser(): void {
    if (isLoggedIn()) {
        try {
            $pdo = getDbConnection();
            require_once __DIR__ . '/functions.php';
            logAudit($pdo, (int)$_SESSION['user_id'], 'LOGOUT', 'users', (int)$_SESSION['user_id'], 'User logged out');
        } catch (Exception $e) {}
    }

    $_SESSION = [];
    if (ini_get("session.use_cookies")) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
            $params["path"], $params["domain"],
            $params["secure"], $params["httponly"]
        );
    }
    session_destroy();
}
