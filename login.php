<?php
/**
 * PAZINGS INVENTORY & SALES MANAGEMENT SYSTEM
 * User Login Page
 * Minimal Blue & White Theme (No Emojis)
 */

require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/config/csrf.php';
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/functions.php';

// Redirect if already logged in
if (isLoggedIn()) {
    header("Location: " . BASE_URL . "index.php");
    exit;
}

$error = '';
$username = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    validateCsrfOrDie();
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';

    if ($username === '' || $password === '') {
        $error = 'Please enter both username and password.';
    } else {
        $result = loginUser($username, $password);
        if ($result['success']) {
            setFlash('success', 'Signed in as ' . $result['user']['full_name'] . '.');
            header("Location: " . BASE_URL . "index.php");
            exit;
        } else {
            $error = $result['message'];
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login | Pazings Management</title>
    <link rel="stylesheet" href="<?= BASE_URL ?>assets/css/style.css">
    <style>
        body {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background-color: var(--bg-page);
            padding: 16px;
        }
        .login-card {
            width: 100%;
            max-width: 380px;
            background: #ffffff;
            border-radius: var(--radius-md);
            padding: 28px 24px;
            border: 1px solid var(--border);
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .brand-header {
            text-align: center;
            margin-bottom: 22px;
        }
        .brand-header h1 {
            font-size: 1.35rem;
            color: var(--navy);
            font-weight: 700;
            letter-spacing: -0.01em;
        }
        .brand-header p {
            color: var(--text-muted);
            font-size: 0.85rem;
            margin-top: 2px;
        }
    </style>
</head>
<body>

<div class="login-card">
    <div class="brand-header">
        <h1>PAZINGS</h1>
        <p>Inventory & Sales Management</p>
    </div>

    <?php if ($error): ?>
        <div class="alert alert-danger" style="margin-bottom: 14px;">
            <div><?= e($error) ?></div>
        </div>
    <?php endif; ?>

    <form method="POST" action="login.php">
        <?= getCsrfInput() ?>

        <div class="form-group">
            <label class="form-label" for="username">Username</label>
            <input type="text" id="username" name="username" class="form-control" 
                   value="<?= e($username) ?>" required autofocus autocomplete="username" placeholder="Enter username">
        </div>

        <div class="form-group">
            <label class="form-label" for="password">Password</label>
            <input type="password" id="password" name="password" class="form-control" 
                   required autocomplete="current-password" placeholder="Enter password">
        </div>

        <button type="submit" class="btn btn-primary btn-lg" style="width: 100%; margin-top: 8px;">
            Sign In
        </button>
    </form>
</div>

</body>
</html>
