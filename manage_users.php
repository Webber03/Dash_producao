<?php
/**
 * manage_users.php — Endpoint administrativo para gerenciar usuários e metas.
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

// 1. Validar se está logado e é administrador
if (!isset($_SESSION['logged_in']) || $_SESSION['logged_in'] !== true || $_SESSION['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Acesso negado. Apenas administradores podem gerenciar usuários.']);
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

$input = json_decode(file_get_contents('php://input'), true);
$action = isset($input['action']) ? trim($input['action']) : '';

if (empty($action)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Ação não especificada.']);
    exit;
}

switch ($action) {
    case 'list':
        // Retorna a lista de usuários (removendo os hashes por segurança)
        $cleanUsers = [];
        foreach ($users as $username => $data) {
            $cleanUsers[] = [
                'username' => $username,
                'role'     => $data['role'],
                'name'     => $data['name'] ?? '',
                'filial'   => $data['filial'] ?? '',
                'goals'    => $data['goals'] ?? [0, 0, 0, 0, 0]
            ];
        }
        echo json_encode(['success' => true, 'users' => $cleanUsers]);
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

        if (isset($users[$username])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Este usuário já está cadastrado.']);
            exit;
        }

        $users[$username] = [
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
            'role'          => $role,
            'name'          => $name,
            'filial'        => $filial,
            'goals'         => $goals
        ];

        if (file_put_contents($dbFile, json_encode($users, JSON_PRETTY_PRINT)) !== false) {
            echo json_encode(['success' => true, 'message' => 'Usuário cadastrado com sucesso.']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Falha ao salvar usuário no arquivo.']);
        }
        break;

    case 'edit':
        $username = isset($input['username']) ? strtolower(trim($input['username'])) : '';
        $password = isset($input['password']) ? trim($input['password']) : '';
        $role     = isset($input['role']) ? trim($input['role']) : '';
        $name     = isset($input['name']) ? trim($input['name']) : '';
        $filial   = isset($input['filial']) ? trim($input['filial']) : '';
        $goals    = isset($input['goals']) && is_array($input['goals']) ? $input['goals'] : null;

        if (empty($username) || !isset($users[$username])) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Usuário não encontrado.']);
            exit;
        }

        if (!empty($role)) {
            $users[$username]['role'] = $role;
        }
        if (!empty($name)) {
            $users[$username]['name'] = $name;
        }
        
        $users[$username]['filial'] = $filial; // Pode ser vazio

        if ($goals !== null) {
            while (count($goals) < 5) {
                $goals[] = 0;
            }
            $goals = array_slice($goals, 0, 5);
            $goals = array_map('floatval', $goals);
            $users[$username]['goals'] = $goals;
        }

        if (!empty($password)) {
            $users[$username]['password_hash'] = password_hash($password, PASSWORD_DEFAULT);
        }

        if (file_put_contents($dbFile, json_encode($users, JSON_PRETTY_PRINT)) !== false) {
            echo json_encode(['success' => true, 'message' => 'Usuário editado com sucesso.']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Falha ao salvar alterações.']);
        }
        break;

    case 'delete':
        $username = isset($input['username']) ? strtolower(trim($input['username'])) : '';

        if (empty($username) || !isset($users[$username])) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Usuário não encontrado.']);
            exit;
        }

        if ($username === strtolower($_SESSION['username'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Você não pode excluir sua própria conta.']);
            exit;
        }

        unset($users[$username]);

        if (file_put_contents($dbFile, json_encode($users, JSON_PRETTY_PRINT)) !== false) {
            echo json_encode(['success' => true, 'message' => 'Usuário excluído com sucesso.']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Falha ao excluir usuário.']);
        }
        break;

    default:
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Ação inválida.']);
        break;
}
exit;
