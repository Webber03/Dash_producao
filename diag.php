<?php
/**
 * diag.php - Diagnóstico COMPLETO do fluxo de login
 * APAGUE ESTE ARQUIVO APÓS USAR
 */
header('Content-Type: text/plain; charset=utf-8');
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "=== DIAGNÓSTICO COMPLETO LOGIN ===\n\n";

// Inclui db.php para inicializar a tabela e variável $pdo
require_once __DIR__ . '/db.php';
echo "1. db.php carregado com sucesso\n";
echo "   PDO disponível: " . (isset($pdo) ? 'SIM' : 'NAO') . "\n\n";

// Verifica se a tabela users existe
try {
    $rows = $pdo->query("SELECT COUNT(*) as total FROM users")->fetchColumn();
    echo "2. Tabela 'users' existe. Registros: $rows\n\n";
} catch (Exception $e) {
    echo "2. ERRO ao consultar tabela users: " . $e->getMessage() . "\n\n";
}

// Lista todos os usuários (sem mostrar hash completo por segurança)
try {
    $stmt = $pdo->query("SELECT username, role, name, filial, LEFT(password_hash, 10) as hash_inicio FROM users");
    $users = $stmt->fetchAll();
    echo "3. Usuários cadastrados:\n";
    foreach ($users as $u) {
        echo "   - Login: {$u['username']} | Papel: {$u['role']} | Nome: {$u['name']} | Hash_inicio: {$u['hash_inicio']}...\n";
    }
    echo "\n";
} catch (Exception $e) {
    echo "3. ERRO ao listar usuários: " . $e->getMessage() . "\n\n";
}

// Simula o login do admin
echo "4. Simulando login com usuario='admin', senha='admin'...\n";
try {
    $stmt = $pdo->prepare("SELECT * FROM users WHERE LOWER(username) = LOWER(?)");
    $stmt->execute(['admin']);
    $foundUser = $stmt->fetch();
    
    if (!$foundUser) {
        echo "   RESULTADO: Usuário 'admin' NÃO encontrado no banco!\n";
    } else {
        echo "   Usuário encontrado: {$foundUser['username']}\n";
        $hash = $foundUser['password_hash'];
        $isBcrypt = (substr($hash, 0, 4) === '$2y$');
        echo "   Hash é Bcrypt: " . ($isBcrypt ? 'SIM' : "NAO (valor atual: $hash)") . "\n";
        
        if ($isBcrypt) {
            $ok = password_verify('admin', $hash);
            echo "   password_verify('admin', hash): " . ($ok ? 'CORRETO' : 'INCORRETO') . "\n";
        } else {
            $ok = ('admin' === $hash);
            echo "   Comparação direta 'admin' === hash: " . ($ok ? 'CORRETO' : 'INCORRETO') . "\n";
        }
        
        if ($ok) {
            echo "   Login FUNCIONARIA! Testando geração de token...\n";
            $token = bin2hex(random_bytes(32));
            $stmtToken = $pdo->prepare("UPDATE users SET token = ?, token_expires = CURRENT_TIMESTAMP + INTERVAL '2 hours' WHERE username = ?");
            $stmtToken->execute([$token, $foundUser['username']]);
            echo "   Token gerado e salvo: " . substr($token, 0, 12) . "...\n";
            echo "   FLUXO COMPLETO: OK!\n";
        }
    }
} catch (Exception $e) {
    echo "   ERRO na simulação: " . $e->getMessage() . "\n";
}

echo "\n5. Testando função validateTokenAndGetUser...\n";
try {
    $stmt = $pdo->prepare("SELECT token FROM users WHERE username = 'admin' AND token IS NOT NULL");
    $stmt->execute();
    $row = $stmt->fetch();
    if ($row) {
        $user = validateTokenAndGetUser($row['token']);
        echo "   Validação do token: " . ($user ? 'OK - encontrou usuário ' . $user['username'] : 'FALHOU') . "\n";
    } else {
        echo "   Nenhum token ativo para testar\n";
    }
} catch (Exception $e) {
    echo "   ERRO: " . $e->getMessage() . "\n";
}

echo "\n=== FIM ===\n";
echo "LEMBRE-SE: Apague diag.php!\n";
