<?php
/**
 * trigger.php — Acessa a página de produção do progestor, extrai o link
 * do JSON gerado automaticamente e retorna os dados.
 * Cache de 55s para sincronizar com o auto-refresh de 60s do dashboard.
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
$CACHE_TTL    = 55; // segundos — sincronizado com o auto-refresh de 60s

$ctx = stream_context_create([
    'http' => [
        'timeout'       => 20,
        'user_agent'    => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'ignore_errors' => true,
        'header'        => "Accept: text/html,application/xhtml+xml\r\nAccept-Language: pt-BR,pt;q=0.9\r\nCache-Control: no-cache\r\n",
    ],
    'ssl' => ['verify_peer' => false, 'verify_peer_name' => false],
]);

$ctxJson = stream_context_create([
    'http' => [
        'timeout'       => 30,
        'user_agent'    => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'ignore_errors' => true,
        'header'        => "Cache-Control: no-cache\r\nPragma: no-cache\r\n",
    ],
    'ssl' => ['verify_peer' => false, 'verify_peer_name' => false],
]);

// ── 1. VERIFICA CACHE ─────────────────────────────────────────
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
    // Tenta URL do último JSON conhecido como fallback
    if (file_exists($CACHE_URL)) {
        $lastUrl = trim(file_get_contents($CACHE_URL));
        if ($lastUrl) {
            $data = @file_get_contents($lastUrl, false, $ctxJson);
            if ($data && strlen(trim($data)) > 100) {
                file_put_contents($CACHE_FILE, $data);
                echo $data;
                exit;
            }
        }
    }
    http_response_code(502);
    echo json_encode(['error' => 'Não foi possível acessar a página de produção do progestor']);
    exit;
}

// ── 3. EXTRAI O LINK DO JSON ──────────────────────────────────
// Padrão: sc_json_YYYYMMDDHHMMSS_NNN_consultajsonlf.json
$jsonUrl = null;

// Tenta encontrar o link direto no HTML
if (preg_match('/https?:\/\/[^\s"\'<>]*sc_json_\d+_\d+_consultajsonlf\.json/', $html, $m)) {
    $jsonUrl = $m[0];
}

// Tenta encontrar apenas o nome do arquivo (caminho relativo)
if (!$jsonUrl && preg_match('/["\']([^"\']*sc_json_\d+_\d+_consultajsonlf\.json)["\']/', $html, $m)) {
    $path = $m[1];
    $jsonUrl = strpos($path, 'http') === 0 ? $path : $BASE_URL . '/' . ltrim($path, '/');
}

// Tenta encontrar qualquer referência ao padrão do arquivo
if (!$jsonUrl && preg_match('/(sc_json_(\d+)_(\d+)_consultajsonlf\.json)/', $html, $m)) {
    $jsonUrl = $BASE_URL . '/sistema/_lib/tmp/' . $m[1];
}

if (!$jsonUrl) {
    // Log do HTML para debug
    $preview = substr(strip_tags($html), 0, 500);
    http_response_code(404);
    echo json_encode([
        'error'   => 'Link do JSON não encontrado na página de produção',
        'preview' => $preview,
        'dica'    => 'Use o botão ⚙ URL para informar o link manualmente'
    ]);
    exit;
}

// ── 4. BAIXA O JSON ───────────────────────────────────────────
$data = @file_get_contents($jsonUrl . '?_t=' . time(), false, $ctxJson);

if (!$data || strlen(trim($data)) < 100) {
    http_response_code(502);
    echo json_encode(['error' => 'JSON encontrado mas não foi possível baixar', 'url' => $jsonUrl]);
    exit;
}

if (substr(rtrim($data), -1) !== ']') {
    http_response_code(502);
    echo json_encode(['error' => 'JSON incompleto retornado pelo servidor', 'url' => $jsonUrl]);
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
