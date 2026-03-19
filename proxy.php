<?php
/**
 * proxy.php — Intermediário sem cache para buscar o JSON do progestor.
 * Coloque na mesma pasta do index.html no servidor.
 */

// Sem cache algum — garante dados sempre frescos
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Cache-Control: post-check=0, pre-check=0', false);
header('Pragma: no-cache');
header('Expires: Thu, 01 Jan 1970 00:00:00 GMT');

$url = isset($_GET['url']) ? trim($_GET['url']) : '';

// Valida domínio permitido
if (empty($url) || strpos($url, 'progestor21.com.br') === false) {
    http_response_code(400);
    echo json_encode(['error' => 'URL inválida ou não permitida']);
    exit;
}

// Adiciona timestamp na URL para forçar busca sem cache no servidor de origem
$separator = strpos($url, '?') !== false ? '&' : '?';
$urlFresh = $url . $separator . '_t=' . time();

$ctx = stream_context_create([
    'http' => [
        'timeout'       => 15,
        'user_agent'    => 'Mozilla/5.0 (compatible; Dashboard/1.0)',
        'ignore_errors' => true,
        'header'        => "Cache-Control: no-cache\r\nPragma: no-cache\r\n",
    ],
    'ssl' => [
        'verify_peer'      => false,
        'verify_peer_name' => false,
    ],
]);

$data = @file_get_contents($urlFresh, false, $ctx);

if ($data === false || empty($data)) {
    http_response_code(502);
    echo json_encode(['error' => 'Não foi possível buscar o JSON remoto']);
    exit;
}

// Valida se é JSON válido antes de repassar
json_decode($data);
if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(502);
    echo json_encode(['error' => 'Resposta do servidor não é JSON válido']);
    exit;
}

echo $data;
