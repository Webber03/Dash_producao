<?php
/**
 * login.php — Endpoint para autenticar usuários contra o PostgreSQL e gerar Token de Sessão.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/db.php';

$input = json_decode(file_get_contents('php://input'), true);
$username = isset($input['username']) ? trim($input['username']) : '';
$password = isset($input['password']) ? trim($input['password']) : '';

if (empty($username) || empty($password)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Preencha usuário e senha.']);
    exit;
}

// Busca usuário no PostgreSQL
$stmt = $pdo->prepare("SELECT * FROM users WHERE LOWER(username) = LOWER(?)");
$stmt->execute([$username]);
$foundUser = $stmt->fetch();

if (!$foundUser) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Usuário ou senha incorretos.']);
    exit;
}

$hash = $foundUser['password_hash'];
$isBcrypt = (substr($hash, 0, 4) === '$2y$');
$authOk = false;

if ($isBcrypt) {
    $authOk = password_verify($password, $hash);
} else {
    $authOk = ($password === $hash);
    if ($authOk) {
        // Converte para bcrypt no primeiro login bem-sucedido
        $newHash = password_hash($password, PASSWORD_DEFAULT);
        $stmtUpdateHash = $pdo->prepare("UPDATE users SET password_hash = ? WHERE username = ?");
        $stmtUpdateHash->execute([$newHash, $foundUser['username']]);
    }
}

if ($authOk) {
    // Gera token de sessão seguro (64 caracteres hex)
    $token = bin2hex(random_bytes(32));
    
    // Atualiza o token e validade no PostgreSQL
    $stmtUpdateToken = $pdo->prepare("UPDATE users SET token = ?, token_expires = CURRENT_TIMESTAMP + INTERVAL '2 hours' WHERE username = ?");
    $stmtUpdateToken->execute([$token, $foundUser['username']]);
    
    $goals = json_decode($foundUser['goals'] ?? '[0,0,0,0,0]', true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        $goals = [0, 0, 0, 0, 0];
    }
    
    echo json_encode([
        'success' => true,
        'token'   => $token,
        'user' => [
            'username' => $foundUser['username'],
            'role'     => $foundUser['role'],
            'name'     => $foundUser['name'],
            'goals'    => $goals,
            'filial'   => $foundUser['filial'] ?? ''
        ]
    ]);
    exit;
}

http_response_code(401);
echo json_encode(['success' => false, 'error' => 'Usuário ou senha incorretos.']);
exit;
