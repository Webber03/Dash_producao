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

    // 1. Criação automática da tabela de tipos de consultor / planos de metas
    $pdo->exec("CREATE TABLE IF NOT EXISTS consultant_types (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        goals TEXT NOT NULL DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");

    // 2. Criação automática da tabela de usuários se não existir
    $pdo->exec("CREATE TABLE IF NOT EXISTS users (
        username VARCHAR(50) PRIMARY KEY,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL,
        name VARCHAR(100) NOT NULL,
        filial VARCHAR(50),
        goals VARCHAR(255) DEFAULT '[0,0,0,0,0]',
        consultant_type_id INTEGER REFERENCES consultant_types(id) ON DELETE SET NULL,
        token VARCHAR(64),
        token_expires TIMESTAMP
    )");

    // 3. Garante coluna consultant_type_id na tabela users caso já exista
    $pdo->exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS consultant_type_id INTEGER REFERENCES consultant_types(id) ON DELETE SET NULL");

    // 4. Se a tabela consultant_types estiver vazia, semeia com tipos padrão
    $checkTypes = $pdo->query("SELECT COUNT(*) FROM consultant_types")->fetchColumn();
    if ($checkTypes == 0) {
        $stmtType = $pdo->prepare("INSERT INTO consultant_types (name, goals) VALUES (?, ?)");
        $juniorGoals = json_encode([
            ['name' => 'Meta 1', 'value' => 1000],
            ['name' => 'Meta 2', 'value' => 2000],
            ['name' => 'Meta 3', 'value' => 3000],
            ['name' => 'Meta 4', 'value' => 4000],
            ['name' => 'Meta 5', 'value' => 5000]
        ]);
        $plenoGoals = json_encode([
            ['name' => 'Meta 1', 'value' => 2000],
            ['name' => 'Meta 2', 'value' => 4000],
            ['name' => 'Meta 3', 'value' => 6000],
            ['name' => 'Meta 4', 'value' => 8000],
            ['name' => 'Meta 5', 'value' => 10000]
        ]);
        $meiGoals = json_encode([
            ['name' => 'Meta 1', 'value' => 3000],
            ['name' => 'Meta 2', 'value' => 6000],
            ['name' => 'Meta 3', 'value' => 9000],
            ['name' => 'Meta 4', 'value' => 12000],
            ['name' => 'Meta 5', 'value' => 15000]
        ]);
        $stmtType->execute(['CONSULTOR JÚNIOR', $juniorGoals]);
        $stmtType->execute(['CONSULTOR PLENO', $plenoGoals]);
        $stmtType->execute(['MEI TIPO 30', $meiGoals]);
    }

    // Pega o ID do primeiro tipo de consultor padrão
    $defaultTypeId = $pdo->query("SELECT id FROM consultant_types ORDER BY id ASC LIMIT 1")->fetchColumn();

    // 5. Se a tabela de usuários estiver vazia, semeia com os usuários padrão
    $check = $pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
    if ($check == 0) {
        $stmt = $pdo->prepare("INSERT INTO users (username, password_hash, role, name, filial, consultant_type_id) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute(['admin', 'admin', 'admin', 'Administrador', '', null]);
        $stmt->execute(['corretor1', '123', 'corretor', 'CORRETOR EXEMPLO', '315', $defaultTypeId]);
        $stmt->execute(['supervisor1', '123', 'supervisor', 'Supervisor Exemplo', '315', null]);
    } else if ($defaultTypeId) {
        // Atualiza corretores que estejam sem consultant_type_id
        $pdo->exec("UPDATE users SET consultant_type_id = {$defaultTypeId} WHERE role = 'corretor' AND consultant_type_id IS NULL");
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
