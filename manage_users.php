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
    // ----------------------------------------------------
    // GESTÃO DE TIPOS DE CONSULTOR / PLANOS DE METAS
    // ----------------------------------------------------
    case 'list_consultant_types':
        try {
            $stmt = $pdo->query("
                SELECT ct.id, ct.name, ct.goals, ct.created_at,
                       COUNT(u.username) as users_count
                FROM consultant_types ct
                LEFT JOIN users u ON u.consultant_type_id = ct.id
                GROUP BY ct.id, ct.name, ct.goals, ct.created_at
                ORDER BY ct.id ASC
            ");
            $rows = $stmt->fetchAll();
            
            $types = [];
            foreach ($rows as $row) {
                $goals = json_decode($row['goals'] ?? '[]', true);
                if (json_last_error() !== JSON_ERROR_NONE || !is_array($goals)) {
                    $goals = [];
                }
                $types[] = [
                    'id'          => (int)$row['id'],
                    'name'        => $row['name'],
                    'goals'       => $goals,
                    'users_count' => (int)$row['users_count'],
                    'created_at'  => $row['created_at']
                ];
            }
            echo json_encode(['success' => true, 'types' => $types]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Erro ao listar tipos de consultor: ' . $e->getMessage()]);
        }
        break;

    case 'save_consultant_type':
        $id    = isset($input['id']) && !empty($input['id']) ? (int)$input['id'] : null;
        $name  = isset($input['name']) ? trim($input['name']) : '';
        $goals = isset($input['goals']) && is_array($input['goals']) ? $input['goals'] : [];

        if (empty($name)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'O nome do tipo de consultor é obrigatório.']);
            exit;
        }

        // Sanitiza e normaliza o array de metas
        $cleanGoals = [];
        foreach ($goals as $idx => $g) {
            $gName = isset($g['name']) && trim($g['name']) !== '' ? trim($g['name']) : 'Meta ' . ($idx + 1);
            $gVal  = isset($g['value']) ? floatval($g['value']) : (isset($g['val']) ? floatval($g['val']) : 0);
            if ($gVal >= 0) {
                $cleanGoals[] = [
                    'name'  => $gName,
                    'value' => $gVal
                ];
            }
        }

        // Se não passou nenhuma meta, inicializa com 1 meta padrão zerada
        if (empty($cleanGoals)) {
            $cleanGoals[] = ['name' => 'Meta 1', 'value' => 0];
        }

        $goalsJson = json_encode($cleanGoals, JSON_UNESCAPED_UNICODE);

        try {
            if ($id) {
                // Edição de Tipo existente
                $stmtCheck = $pdo->prepare("SELECT id FROM consultant_types WHERE LOWER(name) = LOWER(?) AND id != ?");
                $stmtCheck->execute([$name, $id]);
                if ($stmtCheck->fetchColumn()) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'Já existe outro tipo de consultor com este nome.']);
                    exit;
                }

                $stmtUpdate = $pdo->prepare("UPDATE consultant_types SET name = ?, goals = ? WHERE id = ?");
                $stmtUpdate->execute([$name, $goalsJson, $id]);
                echo json_encode(['success' => true, 'message' => 'Tipo de consultor atualizado com sucesso.']);
            } else {
                // Novo Tipo
                $stmtCheck = $pdo->prepare("SELECT id FROM consultant_types WHERE LOWER(name) = LOWER(?)");
                $stmtCheck->execute([$name]);
                if ($stmtCheck->fetchColumn()) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'Já existe um tipo de consultor com este nome.']);
                    exit;
                }

                $stmtInsert = $pdo->prepare("INSERT INTO consultant_types (name, goals) VALUES (?, ?)");
                $stmtInsert->execute([$name, $goalsJson]);
                echo json_encode(['success' => true, 'message' => 'Tipo de consultor cadastrado com sucesso.']);
            }
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Erro ao salvar tipo de consultor: ' . $e->getMessage()]);
        }
        break;

    case 'delete_consultant_type':
        $id = isset($input['id']) ? (int)$input['id'] : 0;
        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID de tipo de consultor inválido.']);
            exit;
        }

        try {
            // Desvincula usuários associados antes de deletar
            $pdo->prepare("UPDATE users SET consultant_type_id = NULL WHERE consultant_type_id = ?")->execute([$id]);
            
            $stmtDel = $pdo->prepare("DELETE FROM consultant_types WHERE id = ?");
            $stmtDel->execute([$id]);

            echo json_encode(['success' => true, 'message' => 'Tipo de consultor removido com sucesso.']);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Erro ao excluir tipo de consultor: ' . $e->getMessage()]);
        }
        break;

    // ----------------------------------------------------
    // GESTÃO DE USUÁRIOS
    // ----------------------------------------------------
    case 'list':
        try {
            $stmt = $pdo->query("
                SELECT u.username, u.role, u.name, u.filial, u.consultant_type_id,
                       ct.name as consultant_type_name, ct.goals as type_goals
                FROM users u
                LEFT JOIN consultant_types ct ON u.consultant_type_id = ct.id
                ORDER BY u.username ASC
            ");
            $rows = $stmt->fetchAll();
            
            $cleanUsers = [];
            foreach ($rows as $row) {
                $typeGoals = json_decode($row['type_goals'] ?? '[]', true);
                if (json_last_error() !== JSON_ERROR_NONE || !is_array($typeGoals)) {
                    $typeGoals = [];
                }

                $cleanUsers[] = [
                    'username'             => $row['username'],
                    'role'                 => $row['role'],
                    'name'                 => $row['name'] ?? '',
                    'filial'               => $row['filial'] ?? '',
                    'consultant_type_id'   => $row['consultant_type_id'] ? (int)$row['consultant_type_id'] : null,
                    'consultant_type_name' => $row['consultant_type_name'] ?? null,
                    'goals'                => $typeGoals
                ];
            }
            echo json_encode(['success' => true, 'users' => $cleanUsers]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Erro ao listar usuários: ' . $e->getMessage()]);
        }
        break;

    case 'create':
        $username         = isset($input['username']) ? strtolower(trim($input['username'])) : '';
        $password         = isset($input['password']) ? trim($input['password']) : '';
        $role             = isset($input['role']) ? trim($input['role']) : '';
        $name             = isset($input['name']) ? trim($input['name']) : '';
        $filial           = isset($input['filial']) ? trim($input['filial']) : '';
        $consultantTypeId = isset($input['consultant_type_id']) && !empty($input['consultant_type_id']) ? (int)$input['consultant_type_id'] : null;

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

            $hashedPass = password_hash($password, PASSWORD_DEFAULT);

            $stmtInsert = $pdo->prepare("INSERT INTO users (username, password_hash, role, name, filial, consultant_type_id) VALUES (?, ?, ?, ?, ?, ?)");
            $stmtInsert->execute([$username, $hashedPass, $role, $name, $filial, ($role === 'corretor' ? $consultantTypeId : null)]);

            echo json_encode(['success' => true, 'message' => 'Usuário cadastrado com sucesso.']);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Erro ao salvar usuário: ' . $e->getMessage()]);
        }
        break;

    case 'edit':
        $username         = isset($input['username']) ? strtolower(trim($input['username'])) : '';
        $password         = isset($input['password']) ? trim($input['password']) : '';
        $role             = isset($input['role']) ? trim($input['role']) : '';
        $name             = isset($input['name']) ? trim($input['name']) : '';
        $filial           = isset($input['filial']) ? trim($input['filial']) : '';
        $consultantTypeId = isset($input['consultant_type_id']) ? (!empty($input['consultant_type_id']) ? (int)$input['consultant_type_id'] : null) : -1;

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

            $newRole = $role ?: $userToEdit['role'];
            $sql = "UPDATE users SET name = ?, role = ?, filial = ?";
            $params = [$name ?: $userToEdit['name'], $newRole, $filial];

            if ($consultantTypeId !== -1) {
                $sql .= ", consultant_type_id = ?";
                $params[] = ($newRole === 'corretor' ? $consultantTypeId : null);
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
