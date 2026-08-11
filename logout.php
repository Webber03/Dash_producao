<?php
/**
 * logout.php — Endpoint para deslogar e revogar o token no PostgreSQL.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/db.php';

$token = isset($_GET['token']) ? trim($_GET['token']) : '';
if (empty($token)) {
    $headers = array_change_key_case(getallheaders(), CASE_LOWER);
    if (isset($headers['authorization']) && preg_match('/bearer\s(\S+)/i', $headers['authorization'], $matches)) {
        $token = $matches[1];
    }
}

if (!empty($token)) {
    $stmt = $pdo->prepare("UPDATE users SET token = NULL, token_expires = NULL WHERE token = ?");
    $stmt->execute([$token]);
}

echo json_encode(['success' => true]);
exit;
