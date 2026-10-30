<?php
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../config/database.php';

try {
    $pdo = getDbConnection();
    $userCount = (int)$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
    if ($userCount > 0) {
        fwrite(STDERR, "Owner bootstrap stopped: a user account already exists.\n");
        exit(1);
    }

    $password = bin2hex(random_bytes(32));
    $passwordHash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare(
        "INSERT INTO users (username, password_hash, full_name, role, status) VALUES (?, ?, ?, 'owner', 'active')"
    );
    $stmt->execute(['owner', $passwordHash, 'Business Owner']);

    fwrite(STDOUT, "Owner account created. Save this password; it is shown only once.\n");
    fwrite(STDOUT, "Username: owner\n");
    fwrite(STDOUT, "Password: " . $password . "\n");
} catch (Throwable $error) {
    fwrite(STDERR, "Owner bootstrap failed: " . $error->getMessage() . "\n");
    exit(1);
}
