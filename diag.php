<?php
/**
 * diag.php - Diagnóstico de conexão PostgreSQL
 * APAGUE ESTE ARQUIVO APÓS USAR (contém informações sensíveis)
 */
header('Content-Type: text/plain; charset=utf-8');
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "=== DIAGNÓSTICO LF PROMOTORA ===\n\n";
echo "PHP Version: " . phpversion() . "\n";
echo "PHP SAPI: " . php_sapi_name() . "\n\n";

echo "--- EXTENSÕES PDO ---\n";
echo "pdo: " . (extension_loaded('pdo') ? 'SIM' : 'NAO') . "\n";
echo "pdo_pgsql: " . (extension_loaded('pdo_pgsql') ? 'SIM' : 'NAO') . "\n";
echo "pdo_mysql: " . (extension_loaded('pdo_mysql') ? 'SIM' : 'NAO') . "\n\n";

$drivers = PDO::getAvailableDrivers();
echo "Drivers disponíveis: " . implode(', ', $drivers) . "\n\n";

echo "--- TESTANDO CONEXÃO (Container) ---\n";
$host = 'ic-postgresql-ZJ9c';
$port = '5432';
$dbname = 'dash';
$user = 'dash';
$password = 'ZKYXxhtcmB7QGfcF';
$dsn = "pgsql:host=$host;port=$port;dbname=$dbname";
echo "DSN: $dsn\n";
echo "User: $user\n";
try {
    $pdo = new PDO($dsn, $user, $password, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    echo "RESULTADO: CONEXAO OK!\n";
    $v = $pdo->query("SELECT version()")->fetchColumn();
    echo "PostgreSQL Version: $v\n";
} catch (Exception $e) {
    echo "RESULTADO: FALHOU\n";
    echo "ERRO: " . $e->getMessage() . "\n";
}

echo "\n--- TESTANDO CONEXÃO (Externa) ---\n";
$host2 = '209.50.241.79';
$dsn2 = "pgsql:host=$host2;port=$port;dbname=$dbname";
echo "DSN: $dsn2\n";
try {
    $pdo2 = new PDO($dsn2, 'user_yrXshF', 'password_AZsFjd', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    echo "RESULTADO: CONEXAO OK!\n";
    $v2 = $pdo2->query("SELECT version()")->fetchColumn();
    echo "PostgreSQL Version: $v2\n";
} catch (Exception $e) {
    echo "RESULTADO: FALHOU\n";
    echo "ERRO: " . $e->getMessage() . "\n";
}

echo "\n=== FIM DO DIAGNÓSTICO ===\n";
echo "LEMBRE-SE: Apague diag.php do servidor!\n";
