<?php
/**
 * proxy.php — Coloque este arquivo no mesmo servidor que o dashboard.html
 * Ele busca o JSON no servidor progestor e repassa para o navegador com CORS liberado.
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache, no-store');

$url = isset($_GET['url']) ? $_GET['url'] : '';

// Valida que é do domínio permitido
if (empty($url) || strpos($url, 'progestor21.com.br') === false) {
    http_response_code(400);
    echo json_encode(['error' => 'URL inválida ou não permitida']);
    exit;
}

$ctx = stream_context_create([
    'http' => [
        'timeout' => 15,
        'user_agent' => 'Mozilla/5.0 (compatible; Dashboard/1.0)',
        'ignore_errors' => true,
    ],
    'ssl' => [
        'verify_peer' => false,
        'verify_peer_name' => false,
    ]
]);

$data = @file_get_contents($url, false, $ctx);

if ($data === false) {
    http_response_code(502);
    echo json_encode(['error' => 'Não foi possível buscar o JSON remoto']);
    exit;
}

echo $data;
