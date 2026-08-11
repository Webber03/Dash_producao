<?php
/**
 * db.php — Conexão com o banco de dados PostgreSQL e inicialização automática de tabelas.
 */

// Dados de conexão fornecidos para o ambiente do container PHP
$host     = 'ic-postgresql-ZJ9c';
$port     = '5432';
$dbname   = 'dash';
$user     = 'dash';
$password = 'ZKYXxhtcmB7QGfcF';

try {
    $dsn = "pgsql:host=$host;port=$port;dbname=$dbname";
    $pdo = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);

    // 1. Criação automática da tabela de usuários se não existir (Self-healing Schema)
    $pdo->exec("CREATE TABLE IF NOT EXISTS users (
        username VARCHAR(50) PRIMARY KEY,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL,
        name VARCHAR(100) NOT NULL,
        filial VARCHAR(50),
        goals VARCHAR(255) DEFAULT '[0,0,0,0,0]',
        token VARCHAR(64),
        token_expires TIMESTAMP
    )");

    // 2. Se a tabela estiver vazia, semeia com os usuários de teste padrão
    $check = $pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
    if ($check == 0) {
        $stmt = $pdo->prepare("INSERT INTO users (username, password_hash, role, name, filial, goals) VALUES (?, ?, ?, ?, ?, ?)");
        
        // Cadastra os mesmos usuários padrão em texto simples (serão hasheados no primeiro login)
        $stmt->execute(['admin', 'admin', 'admin', 'Administrador', '', '[0,0,0,0,0]']);
        $stmt->execute(['corretor1', '123', 'corretor', 'CORRETOR EXEMPLO', '315', '[1000,2000,3000,4000,5000]']);
        $stmt->execute(['supervisor1', '123', 'supervisor', 'Supervisor Exemplo', '315', '[0,0,0,0,0]']);
    }

} catch (PDOException $e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => false,
        'error' => 'Falha ao conectar com o banco de dados PostgreSQL: ' . $e->getMessage()
    ]);
    exit;
}

/**
 * Função utilitária para validar o token enviado via requisição HTTP
 * Substitui a dependência de sessões do PHP (PHPSESSID)
 */
function validateTokenAndGetUser($token) {
    global $pdo;
    if (empty($token)) {
        return null;
    }
    
    $stmt = $pdo->prepare("SELECT * FROM users WHERE token = ? AND token_expires > CURRENT_TIMESTAMP");
    $stmt->execute([$token]);
    $user = $stmt->fetch();
    
    if ($user) {
        // Atualiza a validade do token por mais 2 horas (sliding expiration)
        $stmtUpdate = $pdo->prepare("UPDATE users SET token_expires = CURRENT_TIMESTAMP + INTERVAL '2 hours' WHERE username = ?");
        $stmtUpdate->execute([$user['username']]);
        return $user;
    }
    
    return null;
}
