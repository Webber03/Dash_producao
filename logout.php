<?php
/**
 * logout.php — Endpoint para deslogar e limpar a sessão.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

// Configura pasta de sessão local para garantir persistência no Windows/IIS
$sessionPath = __DIR__ . '/sessions';
if (!file_exists($sessionPath)) {
    @mkdir($sessionPath, 0700, true);
}
if (is_writable($sessionPath)) {
    session_save_path($sessionPath);
}

if (session_status() === PHP_SESSION_NONE) {
    session_start();
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

echo json_encode(['success' => true]);
exit;
