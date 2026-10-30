</main>

<footer class="no-print" style="text-align: center; padding: 20px 16px; color: var(--text-muted); font-size: 0.8rem; border-top: 1px solid var(--border); margin-top: 40px; background: #ffffff;">
    <p><strong>Pazings Management System</strong> &bull; User: <?= e($_SESSION['username'] ?? 'User') ?> (<?= ucfirst(e($_SESSION['user_role'] ?? 'staff')) ?>) &bull; <?= date('Y') ?></p>
</footer>

<script src="<?= BASE_URL ?>assets/js/main.js"></script>
</body>
</html>
