<?php
/**
 * login.php — Endpoint para autenticar usuários contra o users.json e iniciar sessão.
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

$input = json_decode(file_get_contents('php://input'), true);
$username = isset($input['username']) ? trim($input['username']) : '';
$password = isset($input['password']) ? trim($input['password']) : '';

if (empty($username) || empty($password)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Preencha usuário e senha.']);
    exit;
}

$dbFile = __DIR__ . '/users.json';
if (!file_exists($dbFile)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Banco de dados de usuários não encontrado.']);
    exit;
}

$users = json_decode(file_get_contents($dbFile), true);
if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Erro ao carregar banco de dados de usuários.']);
    exit;
}

$foundUser = null;
$foundUsernameKey = null;
foreach ($users as $uKey => $uData) {
    if (strtolower($uKey) === strtolower($username)) {
        $foundUser = $uData;
        $foundUsernameKey = $uKey;
        break;
    }
}

$authOk = false;
if ($foundUser) {
    $hash = $foundUser['password_hash'];
    $isBcrypt = (substr($hash, 0, 4) === '$2y$');
    if ($isBcrypt) {
        $authOk = password_verify($password, $hash);
    } else {
        $authOk = ($password === $hash);
    }
}

if ($authOk) {
    $_SESSION['logged_in'] = true;
    $_SESSION['username']  = $foundUsernameKey;
    $_SESSION['role']      = $foundUser['role'];
    $_SESSION['name']      = $foundUser['name'];
    $_SESSION['goals']     = $foundUser['goals'] ?? [0, 0, 0, 0, 0];
    $_SESSION['filial']    = $foundUser['filial'] ?? '';
    
    echo json_encode([
        'success' => true,
        'user' => [
            'username' => $foundUsernameKey,
            'role'     => $foundUser['role'],
            'name'     => $foundUser['name'],
            'goals'    => $_SESSION['goals'],
            'filial'   => $_SESSION['filial']
        ]
    ]);
    exit;
}

http_response_code(401);
echo json_encode(['success' => false, 'error' => 'Usuário ou senha incorretos.']);
exit;
