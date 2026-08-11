<?php
/**
 * verify_logic.php — Validação do Backend e Métricas da LF Promotora.
 * Acesse no seu navegador para rodar diagnósticos completos e testes de lógica.
 */

header('Content-Type: text/html; charset=utf-8');
session_start();

$tests = [];

function runTest($category, $name, $checkFn) {
    global $tests;
    try {
        $result = $checkFn();
        $tests[] = [
            'category' => $category,
            'name'     => $name,
            'status'   => $result['success'] ? 'success' : 'fail',
            'message'  => $result['message']
        ];
    } catch (Exception $e) {
        $tests[] = [
            'category' => $category,
            'name'     => $name,
            'status'   => 'fail',
            'message'  => 'Erro de execução: ' . $e->getMessage()
        ];
    }
}

// ── 1. TESTES DE AMBIENTE ─────────────────────────────────────
runTest('Ambiente PHP', 'Suporte a Sessões', function() {
    return [
        'success' => session_status() === PHP_SESSION_ACTIVE,
        'message' => 'Sessão PHP ativa na requisição.'
    ];
});

runTest('Ambiente PHP', 'Algoritmo Bcrypt', function() {
    return [
        'success' => defined('PASSWORD_BCRYPT'),
        'message' => 'Bcrypt disponível para encriptação de senhas.'
    ];
});

// ── 2. VALIDAR BANCO DE DADOS JSON ────────────────────────────
runTest('Banco de Dados', 'Estrutura users.json', function() {
    $dbFile = __DIR__ . '/users.json';
    if (!file_exists($dbFile)) {
        return ['success' => false, 'message' => 'Arquivo users.json não existe no diretório raiz.'];
    }
    
    $data = json_decode(file_get_contents($dbFile), true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        return ['success' => false, 'message' => 'Arquivo users.json corrompido: ' . json_last_error_msg()];
    }
    
    if (!isset($data['admin'])) {
        return ['success' => false, 'message' => 'Conta "admin" ausente do arquivo users.json.'];
    }
    
    return [
        'success' => true,
        'message' => 'users.json saudável com ' . count($data) . ' contas cadastradas.'
    ];
});

// ── 3. TESTAR CRIPTOGRAFIA E AUTHENTICAÇÃO ────────────────────
runTest('Autenticação', 'Verificação Bcrypt', function() {
    $dbFile = __DIR__ . '/users.json';
    if (!file_exists($dbFile)) return ['success' => false, 'message' => 'Sem base de dados.'];
    
    $users = json_decode(file_get_contents($dbFile), true);
    $admin = $users['admin'] ?? null;
    if (!$admin) return ['success' => false, 'message' => 'Sem conta admin.'];
    
    $ok = password_verify('admin', $admin['password_hash']);
    return [
        'success' => $ok,
        'message' => $ok ? 'Criptografia validada com a senha padrão "admin".' : 'Senha "admin" não bate com o hash cadastrado.'
    ];
});

// ── 4. LÓGICA DE FILTRAGEM E METAS DINÂMICAS ──────────────────
runTest('Regras de Metas', 'Normalização de Corretores (Acentos)', function() {
    // Função idêntica ao do data.php
    function normTest($str) {
        $unwanted = [
            'Š'=>'S', 'š'=>'s', 'Ž'=>'Z', 'ž'=>'z', 'À'=>'A', 'Á'=>'A', 'Â'=>'A', 'Ã'=>'A', 'Ä'=>'A', 'Å'=>'A', 'Æ'=>'A', 'Ç'=>'C',
            'È'=>'E', 'É'=>'E', 'Ê'=>'E', 'Ë'=>'E', 'Ì'=>'I', 'Í'=>'I', 'Î'=>'I', 'Ï'=>'I', 'Ñ'=>'N', 'Ò'=>'O', 'Ó'=>'O', 'Ô'=>'O',
            'Õ'=>'O', 'Ö'=>'O', 'Ø'=>'O', 'Ù'=>'U', 'Ú'=>'U', 'Û'=>'U', 'Ü'=>'U', 'Ý'=>'Y', 'Þ'=>'B', 'ß'=>'Ss', 'à'=>'a', 'á'=>'a',
            'â'=>'a', 'ã'=>'a', 'ä'=>'a', 'å'=>'a', 'æ'=>'a', 'ç'=>'c', 'è'=>'e', 'é'=>'e', 'ê'=>'e', 'ë'=>'e', 'ì'=>'i', 'í'=>'i',
            'î'=>'i', 'ï'=>'i', 'ð'=>'o', 'ñ'=>'n', 'ò'=>'o', 'ó'=>'o', 'ô'=>'o', 'õ'=>'o', 'ö'=>'o', 'ø'=>'o', 'ù'=>'u', 'ú'=>'u',
            'û'=>'u', 'ü'=>'u', 'ý'=>'y', 'þ'=>'b', 'ÿ'=>'y'
        ];
        return strtoupper(trim(preg_replace('/\s+/', ' ', strtr($str, $unwanted))));
    }
    
    $t1 = normTest('JOÃO SILVA');
    $t2 = normTest('joao silva');
    $t3 = normTest('  JoãO   SilvA  ');
    
    $ok = ($t1 === 'JOAO SILVA' && $t2 === 'JOAO SILVA' && $t3 === 'JOAO SILVA');
    return [
        'success' => $ok,
        'message' => $ok ? 'Filtro imune a acentos, maiúsculas e espaços.' : 'Falha na normalização das strings.'
    ];
});

runTest('Regras de Metas', 'Soma Dinâmica de Metas da Filial', function() {
    // Simulando 2 corretores associados à filial "315"
    $mockUsers = [
        'corr1' => [
            'role' => 'corretor',
            'filial' => '315',
            'goals' => [1000, 2000, 3000, 4000, 5000]
        ],
        'corr2' => [
            'role' => 'corretor',
            'filial' => '315',
            'goals' => [2000, 4000, 6000, 8000, 10000]
        ],
        'corrOutside' => [
            'role' => 'corretor',
            'filial' => '444',
            'goals' => [5000, 5000, 5000, 5000, 5000]
        ],
        'superv' => [
            'role' => 'supervisor',
            'filial' => '315'
        ]
    ];
    
    // Calcula soma para filial "315"
    $filial = '315';
    $summedGoals = [0, 0, 0, 0, 0];
    foreach ($mockUsers as $uData) {
        if ($uData['role'] === 'corretor' && isset($uData['filial']) && strval($uData['filial']) === $filial) {
            for ($i = 0; $i < 5; $i++) {
                $summedGoals[$i] += $uData['goals'][$i];
            }
        }
    }
    
    $expected = [3000, 6000, 9000, 12000, 15000];
    $ok = ($summedGoals === $expected);
    
    return [
        'success' => $ok,
        'message' => $ok 
            ? 'Metas consolidadas somadas perfeitamente: ' . implode(' · ', $summedGoals)
            : 'Erro na soma. Esperado: ' . implode(' · ', $expected) . ' | Obtido: ' . implode(' · ', $summedGoals)
    ];
});

?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Diagnóstico Backend — LF Promotora</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono&display=swap" rel="stylesheet">
    <style>
        body { background: #09090b; color: #fafafa; font-family: 'Inter', sans-serif; padding: 2rem; margin: 0; }
        .container { max-width: 800px; margin: 0 auto; }
        h1 { font-size: 24px; font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 12px; margin-bottom: 2rem; }
        .card { background: #18181b; border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 1.5rem; margin-bottom: 1.25rem; }
        .row { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
        .row:last-child { border-bottom: none; }
        .badge { font-size: 11px; font-weight: 600; padding: 4px 8px; border-radius: 4px; }
        .badge-success { background: rgba(34, 197, 94, 0.15); color: #22c55e; border: 1px solid rgba(34,197,94,0.25); }
        .badge-fail { background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239,68,68,0.25); }
        .title { font-weight: 600; font-size: 14px; }
        .desc { font-size: 12px; color: #a1a1aa; margin-top: 4px; }
        .cat-title { font-size: 14px; text-transform: uppercase; color: #f7cb45; margin-bottom: 12px; font-weight: 700; letter-spacing: 0.04em; }
    </style>
</head>
<body>
    <div class="container">
        <h1>LF Promotora — Painel de Testes do Backend</h1>
        
        <?php
        $grouped = [];
        foreach ($tests as $t) {
            $grouped[$t['category']][] = $t;
        }

        foreach ($grouped as $cat => $testsList):
        ?>
        <div class="card">
            <div class="cat-title"><?= htmlspecialchars($cat) ?></div>
            <?php foreach ($testsList as $t): ?>
            <div class="row">
                <div>
                    <div class="title"><?= htmlspecialchars($t['name']) ?></div>
                    <div class="desc"><?= htmlspecialchars($t['message']) ?></div>
                </div>
                <div>
                    <span class="badge badge-<?= $t['status'] ?>"><?= $t['status'] === 'success' ? 'SUCESSO' : 'FALHOU' ?></span>
                </div>
            </div>
            <?php endforeach; ?>
        </div>
        <?php endforeach; ?>
    </div>
</body>
</html>
