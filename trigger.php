<?php
/**
 * trigger.php — Acessa a página de produção do progestor, extrai o link
 * do JSON via window.location e retorna os dados frescos.
 * Cache de 55s sincronizado com o auto-refresh de 60s do dashboard.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

ini_set('memory_limit', '256M');
set_time_limit(60);

$PRODUCAO_URL = 'https://novo.progestor21.com.br/sistema/producao';
$BASE_URL     = 'https://novo.progestor21.com.br';
$CACHE_FILE   = __DIR__ . '/trigger_cache.json';
$CACHE_URL    = __DIR__ . '/trigger_last_url.txt';
$CACHE_TTL    = 55; // segundos

$ctx = stream_context_create([
    'http' => [
        'timeout'       => 20,
        'user_agent'    => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'ignore_errors' => true,
        'header'        => "Accept: text/html\r\nCache-Control: no-cache\r\n",
    ],
    'ssl' => ['verify_peer' => false, 'verify_peer_name' => false],
]);

$ctxJson = stream_context_create([
    'http' => [
        'timeout'       => 30,
        'user_agent'    => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'ignore_errors' => true,
        'header'        => "Cache-Control: no-cache\r\nPragma: no-cache\r\n",
    ],
    'ssl' => ['verify_peer' => false, 'verify_peer_name' => false],
]);

// ── 1. CACHE VÁLIDO? ──────────────────────────────────────────
if (file_exists($CACHE_FILE) && (time() - filemtime($CACHE_FILE)) < $CACHE_TTL) {
    $cached = file_get_contents($CACHE_FILE);
    if ($cached && strlen(trim($cached)) > 100) {
        echo $cached;
        exit;
    }
}

// ── 2. ACESSA PÁGINA DE PRODUÇÃO ──────────────────────────────
$html = @file_get_contents($PRODUCAO_URL, false, $ctx);

if (!$html) {
    http_response_code(502);
    echo json_encode(['error' => 'Não foi possível acessar a página de produção']);
    exit;
}

// ── 3. EXTRAI O LINK via window.location ──────────────────────
// Padrão: window.location='/sistema/_lib/tmp/sc_json_TIMESTAMP_ID_consultajsonlf.json';
$jsonPath = null;

if (preg_match("/window\.location\s*=\s*'([^']+sc_json_[^']+\.json)'/", $html, $m)) {
    $jsonPath = $m[1];
} elseif (preg_match('/window\.location\s*=\s*"([^"]+sc_json_[^"]+\.json)"/', $html, $m)) {
    $jsonPath = $m[1];
}

if (!$jsonPath) {
    http_response_code(404);
    echo json_encode([
        'error' => 'Link do JSON não encontrado no window.location',
        'html'  => substr(strip_tags($html), 0, 300)
    ]);
    exit;
}

// Monta URL completa
$jsonUrl = (strpos($jsonPath, 'http') === 0)
    ? $jsonPath
    : $BASE_URL . '/' . ltrim($jsonPath, '/');

// ── 4. BAIXA O JSON ───────────────────────────────────────────
$data = @file_get_contents($jsonUrl . '?_t=' . time(), false, $ctxJson);

if (!$data || strlen(trim($data)) < 100) {
    http_response_code(502);
    echo json_encode(['error' => 'Não foi possível baixar o JSON', 'url' => $jsonUrl]);
    exit;
}

if (substr(rtrim($data), -1) !== ']') {
    http_response_code(502);
    echo json_encode(['error' => 'JSON incompleto', 'url' => $jsonUrl, 'bytes' => strlen($data)]);
    exit;
}

json_decode($data);
if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(502);
    echo json_encode(['error' => 'JSON inválido: ' . json_last_error_msg()]);
    exit;
}

// ── 5. SALVA CACHE E RETORNA ──────────────────────────────────
file_put_contents($CACHE_FILE, $data);
file_put_contents($CACHE_URL, $jsonUrl);

echo $data;
