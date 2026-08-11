<?php
/**
 * manage_users.php — Endpoint administrativo para gerenciar usuários e metas no PostgreSQL.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/db.php';

$input = json_decode(file_get_contents('php://input'), true);
$action = isset($input['action']) ? trim($input['action']) : '';
$token  = isset($input['token']) ? trim($input['token']) : '';

if (empty($action)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Ação não especificada.']);
    exit;
}

// 1. Validar se está logado e é administrador via Token
$adminUser = validateTokenAndGetUser($token);
if (!$adminUser || $adminUser['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Acesso negado. Apenas administradores autenticados podem gerenciar usuários.']);
    exit;
}

switch ($action) {
    case 'list':
        try {
            $stmt = $pdo->query("SELECT username, role, name, filial, goals FROM users ORDER BY username ASC");
            $rows = $stmt->fetchAll();
            
            $cleanUsers = [];
            foreach ($rows as $row) {
                $goals = json_decode($row['goals'] ?? '[0,0,0,0,0]', true);
                if (json_last_error() !== JSON_ERROR_NONE) {
                    $goals = [0, 0, 0, 0, 0];
                }
                
                $cleanUsers[] = [
                    'username' => $row['username'],
                    'role'     => $row['role'],
                    'name'     => $row['name'] ?? '',
                    'filial'   => $row['filial'] ?? '',
                    'goals'    => $goals
                ];
            }
            echo json_encode(['success' => true, 'users' => $cleanUsers]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Erro ao listar usuários: ' . $e->getMessage()]);
        }
        break;

    case 'create':
        $username = isset($input['username']) ? strtolower(trim($input['username'])) : '';
        $password = isset($input['password']) ? trim($input['password']) : '';
        $role     = isset($input['role']) ? trim($input['role']) : '';
        $name     = isset($input['name']) ? trim($input['name']) : '';
        $filial   = isset($input['filial']) ? trim($input['filial']) : '';
        $goals    = isset($input['goals']) && is_array($input['goals']) ? $input['goals'] : [0, 0, 0, 0, 0];

        // Normaliza tamanho do array de metas para 5
        while (count($goals) < 5) {
            $goals[] = 0;
        }
        $goals = array_slice($goals, 0, 5);
        $goals = array_map('floatval', $goals);

        if (empty($username) || empty($password) || empty($role) || empty($name)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Preencha todos os campos obrigatórios (Usuário, Senha, Nome, Papel).']);
            exit;
        }

        try {
            // Verifica se usuário existe
            $stmtCheck = $pdo->prepare("SELECT COUNT(*) FROM users WHERE LOWER(username) = LOWER(?)");
            $stmtCheck->execute([$username]);
            if ($stmtCheck->fetchColumn() > 0) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Este usuário já está cadastrado.']);
                exit;
            }

            // Insere novo usuário (salva a senha em texto simples para compatibilidade de primeiro login ou encripta se preferir)
            // Para maior robustez, encriptamos direto
            $hashedPass = password_hash($password, PASSWORD_DEFAULT);
            $goalsJson  = json_encode($goals);

            $stmtInsert = $pdo->prepare("INSERT INTO users (username, password_hash, role, name, filial, goals) VALUES (?, ?, ?, ?, ?, ?)");
            $stmtInsert->execute([$username, $hashedPass, $role, $name, $filial, $goalsJson]);

            echo json_encode(['success' => true, 'message' => 'Usuário cadastrado com sucesso.']);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Erro ao salvar usuário: ' . $e->getMessage()]);
        }
        break;

    case 'edit':
        $username = isset($input['username']) ? strtolower(trim($input['username'])) : '';
        $password = isset($input['password']) ? trim($input['password']) : '';
        $role     = isset($input['role']) ? trim($input['role']) : '';
        $name     = isset($input['name']) ? trim($input['name']) : '';
        $filial   = isset($input['filial']) ? trim($input['filial']) : '';
        $goals    = isset($input['goals']) && is_array($input['goals']) ? $input['goals'] : null;

        if (empty($username)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Nome de usuário não informado.']);
            exit;
        }

        try {
            // Verifica se usuário existe
            $stmtCheck = $pdo->prepare("SELECT * FROM users WHERE LOWER(username) = LOWER(?)");
            $stmtCheck->execute([$username]);
            $userToEdit = $stmtCheck->fetch();

            if (!$userToEdit) {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Usuário não encontrado.']);
                exit;
            }

            $sql = "UPDATE users SET name = ?, role = ?, filial = ?";
            $params = [$name ?: $userToEdit['name'], $role ?: $userToEdit['role'], $filial];

            if ($goals !== null) {
                while (count($goals) < 5) {
                    $goals[] = 0;
                }
                $goals = array_slice($goals, 0, 5);
                $goals = array_map('floatval', $goals);
                $sql .= ", goals = ?";
                $params[] = json_encode($goals);
            }

            if (!empty($password)) {
                $sql .= ", password_hash = ?";
                $params[] = password_hash($password, PASSWORD_DEFAULT);
            }

            $sql .= " WHERE username = ?";
            $params[] = $userToEdit['username'];

            $stmtUpdate = $pdo->prepare($sql);
            $stmtUpdate->execute($params);

            echo json_encode(['success' => true, 'message' => 'Usuário editado com sucesso.']);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Erro ao editar usuário: ' . $e->getMessage()]);
        }
        break;

    case 'delete':
        $username = isset($input['username']) ? strtolower(trim($input['username'])) : '';

        if (empty($username)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Usuário não informado.']);
            exit;
        }

        if ($username === strtolower($adminUser['username'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Você não pode excluir sua própria conta de administrador.']);
            exit;
        }

        try {
            $stmtDelete = $pdo->prepare("DELETE FROM users WHERE LOWER(username) = LOWER(?)");
            $stmtDelete->execute([$username]);

            echo json_encode(['success' => true, 'message' => 'Usuário excluído com sucesso.']);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Erro ao excluir usuário: ' . $e->getMessage()]);
        }
        break;

    default:
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Ação inválida.']);
        break;
}
exit;
