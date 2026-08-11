<?php
/**
 * data.php — Endpoint seguro para fornecimento dos dados filtrados no servidor (PostgreSQL & Tokens).
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/db.php';

// 1. Extração do Token (Suporta header Authorization Bearer ou query param ?token=...)
$token = isset($_GET['token']) ? trim($_GET['token']) : '';

if (empty($token)) {
    $headers = array_change_key_case(getallheaders(), CASE_LOWER);
    if (isset($headers['authorization']) && preg_match('/bearer\s(\S+)/i', $headers['authorization'], $matches)) {
        $token = $matches[1];
    }
}

// 2. Validação do Token no Banco de Dados
$user = validateTokenAndGetUser($token);
if (!$user) {
    http_response_code(401);
    echo json_encode(['error' => 'Não autorizado ou sessão expirada.']);
    exit;
}

$userRole   = $user['role'];
$userName   = $user['name'];
$userGoals  = json_decode($user['goals'] ?? '[0,0,0,0,0]', true) ?: [0, 0, 0, 0, 0];
$userFilial = $user['filial'] ?? '';

// 3. Auxiliar de normalização de strings (remova acentos, espaços extras e caixa alta)
function normalizeString($str) {
    $unwanted = [
        'Š'=>'S', 'š'=>'s', 'Ž'=>'Z', 'ž'=>'z', 'À'=>'A', 'Á'=>'A', 'Â'=>'A', 'Ã'=>'A', 'Ä'=>'A', 'Å'=>'A', 'Æ'=>'A', 'Ç'=>'C',
        'È'=>'E', 'É'=>'E', 'Ê'=>'E', 'Ë'=>'E', 'Ì'=>'I', 'Í'=>'I', 'Î'=>'I', 'Ï'=>'I', 'Ñ'=>'N', 'Ò'=>'O', 'Ó'=>'O', 'Ô'=>'O',
        'Õ'=>'O', 'Ö'=>'O', 'Ø'=>'O', 'Ù'=>'U', 'Ú'=>'U', 'Û'=>'U', 'Ü'=>'U', 'Ý'=>'Y', 'Þ'=>'B', 'ß'=>'Ss', 'à'=>'a', 'á'=>'a',
        'â'=>'a', 'ã'=>'a', 'ä'=>'a', 'å'=>'a', 'æ'=>'a', 'ç'=>'c', 'è'=>'e', 'é'=>'e', 'ê'=>'e', 'ì'=>'i', 'í'=>'i',
        'î'=>'i', 'ï'=>'i', 'ð'=>'o', 'ñ'=>'n', 'ò'=>'o', 'ó'=>'o', 'ô'=>'o', 'õ'=>'o', 'ö'=>'o', 'ø'=>'o', 'ù'=>'u', 'ú'=>'u',
        'û'=>'u', 'ü'=>'u', 'ý'=>'y', 'þ'=>'b', 'ÿ'=>'y'
    ];
    $str = strtr($str, $unwanted);
    return strtoupper(trim(preg_replace('/\s+/', ' ', $str)));
}

// 4. Se for Supervisor, calcula a meta da filial somando as metas de todos os seus corretores cadastrados no BD
if ($userRole === 'supervisor' && !empty($userFilial)) {
    $stmt = $pdo->prepare("SELECT goals FROM users WHERE role = 'corretor' AND filial = ?");
    $stmt->execute([$userFilial]);
    $brokers = $stmt->fetchAll();

    $filialGoals = [0.0, 0.0, 0.0, 0.0, 0.0];
    foreach ($brokers as $broker) {
        $uGoals = json_decode($broker['goals'] ?? '[0,0,0,0,0]', true) ?: [0,0,0,0,0];
        for ($i = 0; $i < 5; $i++) {
            $filialGoals[$i] += floatval($uGoals[$i] ?? 0);
        }
    }
    $userGoals = $filialGoals;
}

// 5. Obter dados JSON (Scraping automático ou URL Manual informada pelo Admin)
$CACHE_FILE = __DIR__ . '/trigger_cache.json';
$CACHE_TTL  = 55; // segundos
$dataJson   = null;

$manualUrl = isset($_GET['url']) ? trim($_GET['url']) : '';

if (!empty($manualUrl)) {
    if (strpos($manualUrl, 'progestor21.com.br') !== false) {
        $ctx = stream_context_create([
            'http' => ['timeout' => 15, 'user_agent' => 'Mozilla/5.0 (compatible; Dashboard/1.0)', 'header' => "Cache-Control: no-cache\r\nPragma: no-cache\r\n"],
            'ssl'  => ['verify_peer' => false, 'verify_peer_name' => false],
        ]);
        $dataJson = @file_get_contents($manualUrl . (strpos($manualUrl, '?') !== false ? '&' : '?') . '_t=' . time(), false, $ctx);
    }
}

if (empty($dataJson)) {
    $shouldRefresh = !file_exists($CACHE_FILE) || (time() - filemtime($CACHE_FILE)) >= $CACHE_TTL;
    
    if ($shouldRefresh) {
        $PRODUCAO_URL = 'https://sistemanovo.progestor21.com.br/sistema/producao';
        $BASE_URL     = 'https://sistemanovo.progestor21.com.br';
        
        $ctx = stream_context_create([
            'http' => ['timeout' => 15, 'user_agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'header' => "Accept: text/html\r\nCache-Control: no-cache\r\n"],
            'ssl'  => ['verify_peer' => false, 'verify_peer_name' => false],
        ]);
        
        $html = @file_get_contents($PRODUCAO_URL, false, $ctx);
        if ($html) {
            $jsonPath = null;
            if (preg_match("/window\.location\s*=\s*'([^']+sc_json_[^']+\.json)'/", $html, $m)) {
                $jsonPath = $m[1];
            } elseif (preg_match('/window\.location\s*=\s*"([^"]+sc_json_[^"]+\.json)"/', $html, $m)) {
                $jsonPath = $m[1];
            }
            
            if ($jsonPath) {
                $jsonUrl = (strpos($jsonPath, 'http') === 0) ? $jsonPath : $BASE_URL . '/' . ltrim($jsonPath, '/');
                $ctxJson = stream_context_create([
                    'http' => ['timeout' => 20, 'user_agent' => 'Mozilla/5.0', 'header' => "Cache-Control: no-cache\r\n"],
                    'ssl'  => ['verify_peer' => false, 'verify_peer_name' => false],
                ]);
                $freshData = @file_get_contents($jsonUrl . '?_t=' . time(), false, $ctxJson);
                if ($freshData && substr(rtrim($freshData), -1) === ']') {
                    json_decode($freshData);
                    if (json_last_error() === JSON_ERROR_NONE) {
                        file_put_contents($CACHE_FILE, $freshData);
                        file_put_contents(__DIR__ . '/trigger_last_url.txt', $jsonUrl);
                    }
                }
            }
        }
    }
    
    if (file_exists($CACHE_FILE)) {
        $dataJson = file_get_contents($CACHE_FILE);
    }
}

if (empty($dataJson)) {
    http_response_code(502);
    echo json_encode(['error' => 'Não foi possível carregar os dados de contratos.']);
    exit;
}

$rawRecords = json_decode($dataJson, true);
if (json_last_error() !== JSON_ERROR_NONE || !is_array($rawRecords)) {
    http_response_code(502);
    echo json_encode(['error' => 'Formato de dados inválido recebido do Progestor.']);
    exit;
}

// 6. Filtragem no Servidor baseada no Papel do Usuário
$filteredRecords = [];

if ($userRole === 'admin') {
    $filteredRecords = $rawRecords;
} elseif ($userRole === 'supervisor') {
    if (empty($userFilial)) {
        $filteredRecords = [];
    } else {
        foreach ($rawRecords as $record) {
            if (isset($record['Filial']) && strval($record['Filial']) === strval($userFilial)) {
                $filteredRecords[] = $record;
            }
        }
    }
} elseif ($userRole === 'corretor') {
    $normUserCorrName = normalizeString($userName);
    foreach ($rawRecords as $record) {
        $recordCorrName = isset($record['Corretor']) ? normalizeString($record['Corretor']) : '';
        if ($recordCorrName !== '' && $recordCorrName === $normUserCorrName) {
            $filteredRecords[] = $record;
        }
    }
}

// 7. Retorna o resultado seguro + Metas do usuário
echo json_encode([
    'success' => true,
    'role'    => $userRole,
    'name'    => $userName,
    'goals'   => $userGoals,
    'data'    => $filteredRecords
]);
exit;
