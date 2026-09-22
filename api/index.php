<?php
// ================================================================
// DFAST ONLINE - API REST EM PHP (HOSTGATOR PLANO TURBO NATIVO)
// ================================================================

// Cabeçalhos de Segurança HTTP Estritos
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('X-XSS-Protection: 1; mode=block');
header('Referrer-Policy: strict-origin-when-cross-origin');

// Controle Seguro de CORS (Evita Acesso Indevido de Sites Terceiros)
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (!empty($origin)) {
    $originHost = parse_url($origin, PHP_URL_HOST);
    $serverHost = $_SERVER['HTTP_HOST'] ?? '';
    // Permitir se vier de localhost ou do mesmo domínio da aplicação
    if (in_array($originHost, ['localhost', '127.0.0.1']) || $originHost === $serverHost) {
        header("Access-Control-Allow-Origin: {$origin}");
    } else {
        header('Access-Control-Allow-Origin: null');
    }
} else {
    header('Access-Control-Allow-Origin: *');
}

header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-API-Key');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/db.php';
$pdo = getDatabaseConnection();

// Obter a rota chamada
$route = $_GET['route'] ?? '';
if (empty($route)) {
    $uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $route = preg_replace('#^/api/#', '', $uri);
}
$route = trim($route, '/');
$method = $_SERVER['REQUEST_METHOD'];

// Obter payload JSON em requisições POST/PUT
$input = [];
if (in_array($method, ['POST', 'PUT'])) {
    $raw = file_get_contents('php://input');
    if (!empty($raw)) {
        $input = json_decode($raw, true) ?: [];
    }
}

// Helpers para Processamento e Parse de XML NF-e (Distribuidor)
function extractTagValuePhp($xml, $tagName) {
    if (preg_match('/<(?:[a-zA-Z0-9_]+:)?' . preg_quote($tagName, '/') . '(?:\s+[^>]*)?>([\s\S]*?)<\/(?:[a-zA-Z0-9_]+:)?' . preg_quote($tagName, '/') . '>/i', $xml, $matches)) {
        $val = trim($matches[1]);
        if (preg_match('/^<!\[CDATA\[([\s\S]*?)\]\]>$/i', $val, $cdata)) {
            $val = trim($cdata[1]);
        }
        return $val;
    }
    return '';
}

function parseNfeXmlPhp($xmlString) {
    if (empty($xmlString)) {
        throw new Exception('Conteúdo XML vazio.');
    }

    $nNF = extractTagValuePhp($xmlString, 'nNF');
    $dhEmi = extractTagValuePhp($xmlString, 'dhEmi');
    if (empty($dhEmi)) {
        $dhEmi = extractTagValuePhp($xmlString, 'dEmi');
    }

    $emitente = '';
    $cnpj = '';
    if (preg_match('/<(?:[a-zA-Z0-9_]+:)?emit(?:\s+[^>]*)?>([\s\S]*?)<\/(?:[a-zA-Z0-9_]+:)?emit>/i', $xmlString, $emitMatches)) {
        $emitContent = $emitMatches[1];
        $emitente = extractTagValuePhp($emitContent, 'xNome');
        $cnpj = extractTagValuePhp($emitContent, 'CNPJ');
    } else {
        $emitente = extractTagValuePhp($xmlString, 'xNome');
        $cnpj = extractTagValuePhp($xmlString, 'CNPJ');
    }

    $items = [];
    if (preg_match_all('/<(?:[a-zA-Z0-9_]+:)?det(?:\s+[^>]*)?>([\s\S]*?)<\/(?:[a-zA-Z0-9_]+:)?det>/i', $xmlString, $detMatches)) {
        foreach ($detMatches[1] as $detContent) {
            $cProd = strtoupper(trim(extractTagValuePhp($detContent, 'cProd')));
            $xProd = trim(extractTagValuePhp($detContent, 'xProd'));
            $uComRaw = strtoupper(trim(extractTagValuePhp($detContent, 'uCom')));
            $uCom = ($uComRaw === 'PAR' || $uComRaw === 'PR') ? 'PAR' : 'UNIDADE';
            $qComStr = str_replace(',', '.', extractTagValuePhp($detContent, 'qCom'));
            $vUnComStr = str_replace(',', '.', extractTagValuePhp($detContent, 'vUnCom'));

            $quantidade = (int)round((float)$qComStr);
            $valorUnitario = (float)$vUnComStr;

            if (!empty($cProd) && $quantidade > 0) {
                $items[] = [
                    'cProd' => $cProd,
                    'xProd' => $xProd,
                    'uCom' => $uCom,
                    'quantidade' => $quantidade,
                    'valorUnitario' => $valorUnitario
                ];
            }
        }
    }

    if (empty($items)) {
        throw new Exception('Nenhum item/produto válido encontrado no XML da NF-e.');
    }

    return [
        'nNF' => $nNF,
        'emitente' => $emitente,
        'cnpj' => $cnpj,
        'dataEmissao' => $dhEmi,
        'itens' => $items
    ];
}

try {
    // -------------------------------------------------------------
    // ROTAS DE AUTENTICAÇÃO E CONTROLE DE ACESSO (RBAC)
    // -------------------------------------------------------------
    if ($route === 'auth/login' && $method === 'POST') {
        $username = trim($input['username'] ?? '');
        $password = (string)($input['password'] ?? '');

        if (empty($username) || empty($password)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Informe o usuário e a senha.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $stmt = $pdo->prepare("SELECT * FROM usuarios WHERE LOWER(username) = LOWER(?)");
        $stmt->execute([$username]);
        $user = $stmt->fetch();

        if (!$user || !CryptoService::verifyPassword($password, $user['password_hash'])) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'Usuário ou senha incorretos.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $pdo->prepare("UPDATE usuarios SET ultimo_login = CURRENT_TIMESTAMP WHERE id = ?")->execute([$user['id']]);
        $token = CryptoService::createSessionToken($user);

        echo json_encode([
            'success' => true,
            'token' => $token,
            'user' => [
                'id' => (int)$user['id'],
                'username' => $user['username'],
                'nome' => $user['nome'],
                'role' => $user['role']
            ]
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($route === 'auth/me' && $method === 'GET') {
        $authUser = CryptoService::getAuthenticatedUser();
        if (!$authUser) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'Sessão inválida ou expirada.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $stmt = $pdo->prepare("SELECT id, username, nome, role FROM usuarios WHERE id = ?");
        $stmt->execute([$authUser['id']]);
        $user = $stmt->fetch();

        if (!$user) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'Usuário não encontrado.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        echo json_encode(['success' => true, 'user' => $user], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($route === 'auth/logout' && $method === 'POST') {
        echo json_encode(['success' => true, 'message' => 'Logout realizado com sucesso.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // -------------------------------------------------------------
    // ROTA: /api/stats (Estatísticas do Painel)
    // -------------------------------------------------------------
    if ($route === 'stats' && $method === 'GET') {
        $totalAnuncios = $pdo->query("SELECT COUNT(*) FROM anuncios")->fetchColumn();
        $totalComponentes = $pdo->query("SELECT COUNT(*) FROM distribuidor")->fetchColumn();
        
        $totalPedidos = $pdo->query("SELECT COUNT(*) FROM pedidos_vendas")->fetchColumn();
        $pedidosPendentes = $pdo->query("
            SELECT COUNT(*) 
            FROM pedidos_vendas p
            LEFT JOIN anuncios a ON p.ml_item_id = a.id_ml
            WHERE p.status_picking = 'pendente' AND (a.kit IS NULL OR a.kit = 'S')
        ")->fetchColumn();
        $pedidosSeparados = $pdo->query("SELECT COUNT(*) FROM pedidos_vendas WHERE status_picking = 'separado'")->fetchColumn();
        $pedidosFlex = $pdo->query("
            SELECT COUNT(*) 
            FROM pedidos_vendas p
            LEFT JOIN anuncios a ON p.ml_item_id = a.id_ml
            WHERE p.envio_tipo = 'flex' AND p.status_picking = 'pendente' AND (a.kit IS NULL OR a.kit = 'S')
        ")->fetchColumn();

        // Itens com estoque baixo
        $estoqueBaixo = $pdo->query("
            SELECT COUNT(*) FROM estoque_saldos s 
            WHERE s.saldo_atual <= s.estoque_minimo
        ")->fetchColumn();

        // Anúncios vendidos sem cadastro no banco
        $anunciosSemCadastro = $pdo->query("
            SELECT COUNT(DISTINCT p.ml_item_id) 
            FROM pedidos_vendas p
            LEFT JOIN anuncios a ON p.ml_item_id = a.id_ml
            WHERE a.id_ml IS NULL
        ")->fetchColumn();

        // Pedidos de produção local (sem kit de peças nissi)
        $pedidosProducaoLocal = $pdo->query("
            SELECT COUNT(*) 
            FROM pedidos_vendas p
            JOIN anuncios a ON p.ml_item_id = a.id_ml
            WHERE a.kit = 'N'
        ")->fetchColumn();

        echo json_encode([
            'success' => true,
            'stats' => [
                'total_anuncios' => (int)$totalAnuncios,
                'total_componentes' => (int)$totalComponentes,
                'total_pedidos' => (int)$totalPedidos,
                'pedidos_pendentes' => (int)$pedidosPendentes,
                'pedidos_separados' => (int)$pedidosSeparados,
                'pedidos_flex_hoje' => (int)$pedidosFlex,
                'itens_estoque_baixo' => (int)$estoqueBaixo,
                'anuncios_sem_cadastro' => (int)$anunciosSemCadastro,
                'pedidos_producao_local' => (int)$pedidosProducaoLocal,
            ]
        ]);
        exit;
    }

    // -------------------------------------------------------------
    // ROTA: /api/picking (Lista de Separação Inteligente com Filtro de Origem e SLA)
    // -------------------------------------------------------------
    if ($route === 'picking' && $method === 'GET') {
        $tipo = $_GET['tipo'] ?? 'nissi'; // 'nissi' (padrão: almoxarifado), 'producao', 'todos'
        $sla = $_GET['sla'] ?? 'todos'; // 'hoje', 'proximo', 'todos' ou data específica 'YYYY-MM-DD'

        $todayStr = date('Y-m-d');

        // Descobre a próxima data de SLA disponível (>= hoje)
        $stmtNextSla = $pdo->prepare("
            SELECT sla_expected_date 
            FROM pedidos_vendas 
            WHERE sla_expected_date IS NOT NULL AND sla_expected_date >= ?
            ORDER BY sla_expected_date ASC LIMIT 1
        ");
        $stmtNextSla->execute([$todayStr]);
        $nextSlaDate = $stmtNextSla->fetchColumn() ?: null;

        // Lista de SLAs disponíveis no banco de dados com contagens
        $availableSlasRaw = $pdo->query("
            SELECT 
                COALESCE(p.sla_expected_date, 'Sem Data') as date,
                COUNT(*) as count,
                SUM(CASE WHEN p.status_picking = 'pendente' THEN 1 ELSE 0 END) as pendentes
            FROM pedidos_vendas p
            GROUP BY COALESCE(p.sla_expected_date, 'Sem Data')
            ORDER BY p.sla_expected_date ASC
        ")->fetchAll();

        $availableSlas = array_map(function($s) use ($todayStr, $nextSlaDate) {
            $label = $s['date'];
            if ($s['date'] === $todayStr) {
                $label = "Hoje ({$s['date']})";
            } else if ($s['date'] === $nextSlaDate) {
                $label = "Próximo ({$s['date']})";
            }
            return array_merge($s, [
                'count' => (int)$s['count'],
                'pendentes' => (int)$s['pendentes'],
                'label' => $label
            ]);
        }, $availableSlasRaw);

        // Filtros dinâmicos da query de pedidos
        $whereClauses = [];
        $queryParams = [];

        if ($tipo === 'nissi') {
            $whereClauses[] = "(a.kit = 'S' OR a.id_ml IS NULL)";
        } else if ($tipo === 'producao') {
            $whereClauses[] = "a.kit = 'N'";
        }

        $activeSlaDate = null;
        if ($sla === 'hoje') {
            $whereClauses[] = "p.sla_expected_date = ?";
            $queryParams[] = $todayStr;
            $activeSlaDate = $todayStr;
        } else if ($sla === 'proximo' && $nextSlaDate) {
            $whereClauses[] = "p.sla_expected_date = ?";
            $queryParams[] = $nextSlaDate;
            $activeSlaDate = $nextSlaDate;
        } else if (!empty($sla) && $sla !== 'todos' && $sla !== 'all') {
            $whereClauses[] = "p.sla_expected_date = ?";
            $queryParams[] = $sla;
            $activeSlaDate = $sla;
        }

        $sqlWhere = !empty($whereClauses) ? 'WHERE ' . implode(' AND ', $whereClauses) : '';

        // 1. Visão por Pedido
        $pedStmt = $pdo->prepare("
            SELECT p.*, a.kit, a.caixa, (a.id_ml IS NOT NULL) as cadastrado
            FROM pedidos_vendas p
            LEFT JOIN anuncios a ON p.ml_item_id = a.id_ml
            {$sqlWhere}
            ORDER BY 
                CASE WHEN p.status_picking = 'separado' THEN 1 ELSE 0 END,
                CASE WHEN p.envio_tipo = 'flex' THEN 0 ELSE 1 END,
                p.id ASC
        ");
        $pedStmt->execute($queryParams);
        $pedidos = $pedStmt->fetchAll();

        $stmtComponents = $pdo->prepare("
            SELECT 
                k.id_kit_nissi,
                (k.qtd_kit * :qtd_pedido) as qtd_necessaria,
                d.descricao,
                d.unidade_medida,
                COALESCE(d.local, 'S/L') as local,
                COALESCE(s.saldo_atual, 0) as saldo_atual
            FROM kits_anuncio k
            JOIN distribuidor d ON k.id_kit_nissi = d.id_nissi
            LEFT JOIN estoque_saldos s ON d.id_nissi = s.id_nissi
            WHERE k.id_ml_anuncio = :id_ml
            ORDER BY d.local ASC
        ");

        foreach ($pedidos as &$ped) {
            $stmtComponents->execute([
                'qtd_pedido' => $ped['quantidade'],
                'id_ml' => $ped['ml_item_id']
            ]);
            $ped['componentes'] = $stmtComponents->fetchAll();
        }

        // 2. Rota consolidada e caixas filtradas pelo SLA selecionado
        $rotaWhereClauses = ["p.status_picking = 'pendente'"];
        $rotaParams = [];

        if ($activeSlaDate) {
            $rotaWhereClauses[] = "p.sla_expected_date = ?";
            $rotaParams[] = $activeSlaDate;
        }

        $rotaSqlWhere = implode(' AND ', $rotaWhereClauses);

        $consolidadoStmt = $pdo->prepare("
            SELECT 
                COALESCE(d.local, 'S/L') as local,
                k.id_kit_nissi,
                d.descricao,
                d.unidade_medida,
                SUM(k.qtd_kit * p.quantidade) as total_a_retirar,
                COALESCE(s.saldo_atual, 0) as saldo_atual,
                GROUP_CONCAT(DISTINCT p.order_id) as pedidos_relacionados
            FROM pedidos_vendas p
            JOIN kits_anuncio k ON p.ml_item_id = k.id_ml_anuncio
            JOIN distribuidor d ON k.id_kit_nissi = d.id_nissi
            LEFT JOIN estoque_saldos s ON d.id_nissi = s.id_nissi
            WHERE {$rotaSqlWhere}
            GROUP BY COALESCE(d.local, 'S/L'), k.id_kit_nissi
            ORDER BY COALESCE(d.local, 'S/L') ASC, k.id_kit_nissi ASC
        ");
        $consolidadoStmt->execute($rotaParams);
        $consolidado = $consolidadoStmt->fetchAll();

        // 3. Resumo de Caixas Necessárias para o Despacho
        $caixasStmt = $pdo->prepare("
            SELECT 
                COALESCE(a.caixa, 'Indefinida') as numero_caixa,
                SUM(p.quantidade) as total_caixas
            FROM pedidos_vendas p
            LEFT JOIN anuncios a ON p.ml_item_id = a.id_ml
            WHERE {$rotaSqlWhere}
            GROUP BY a.caixa
            ORDER BY a.caixa ASC
        ");
        $caixasStmt->execute($rotaParams);
        $caixas = $caixasStmt->fetchAll();

        // 4. Contadores por Origem
        $slaParam = $activeSlaDate ? [$activeSlaDate] : [];
        $slaClause = $activeSlaDate ? 'AND p.sla_expected_date = ?' : '';

        $stmtCountNissi = $pdo->prepare("
            SELECT COUNT(*) FROM pedidos_vendas p
            LEFT JOIN anuncios a ON p.ml_item_id = a.id_ml
            WHERE (a.kit = 'S' OR a.id_ml IS NULL) {$slaClause}
        ");
        $stmtCountNissi->execute($slaParam);
        $countNissi = $stmtCountNissi->fetchColumn();

        $stmtCountProducao = $pdo->prepare("
            SELECT COUNT(*) FROM pedidos_vendas p
            JOIN anuncios a ON p.ml_item_id = a.id_ml
            WHERE a.kit = 'N' {$slaClause}
        ");
        $stmtCountProducao->execute($slaParam);
        $countProducao = $stmtCountProducao->fetchColumn();

        $stmtCountTodos = $pdo->prepare("
            SELECT COUNT(*) FROM pedidos_vendas p
            " . ($activeSlaDate ? 'WHERE p.sla_expected_date = ?' : '') . "
        ");
        $stmtCountTodos->execute($slaParam);
        $countTodos = $stmtCountTodos->fetchColumn();

        echo json_encode([
            'success' => true,
            'pedidos' => $pedidos,
            'rota_consolidada' => $consolidado,
            'caixas_necessarias' => $caixas,
            'available_slas' => $availableSlas,
            'selected_sla' => $sla,
            'active_sla_date' => $activeSlaDate,
            'next_sla_date' => $nextSlaDate,
            'counts' => [
                'nissi' => (int)$countNissi,
                'producao' => (int)$countProducao,
                'todos' => (int)$countTodos
            ]
        ]);
        exit;
    }

    // -------------------------------------------------------------
    // ROTA: /api/picking/toggle (Alternar Status de Separação & Movimentar Estoque)
    // -------------------------------------------------------------
    if ($route === 'picking/toggle' && $method === 'POST') {
        $authUser = CryptoService::requireAuth();
        $username = $authUser['username'] ?? 'sistema';

        $orderId = $input['order_id'] ?? '';
        if (!$orderId) {
            http_response_code(400);
            echo json_encode(['error' => 'order_id é obrigatório']);
            exit;
        }

        $current = $pdo->prepare("SELECT * FROM pedidos_vendas WHERE order_id = ?");
        $current->execute([$orderId]);
        $pedido = $current->fetch(PDO::FETCH_ASSOC);

        if (!$pedido) {
            http_response_code(404);
            echo json_encode(['error' => 'Pedido não encontrado']);
            exit;
        }

        $newStatus = ($pedido['status_picking'] === 'separado') ? 'pendente' : 'separado';
        $separadoEm = ($newStatus === 'separado') ? date('Y-m-d H:i:s') : null;

        // Buscar componentes do anúncio
        $compStmt = $pdo->prepare("SELECT id_kit_nissi, qtd_kit FROM kits_anuncio WHERE id_ml_anuncio = ?");
        $compStmt->execute([$pedido['ml_item_id']]);
        $componentes = $compStmt->fetchAll(PDO::FETCH_ASSOC);

        $itemsAffected = [];

        $pdo->beginTransaction();
        try {
            if ($newStatus === 'separado') {
                if (empty($pedido['estoque_deduzido']) && count($componentes) > 0) {
                    foreach ($componentes as $comp) {
                        $qtdBaixar = ((int)($pedido['quantidade'] ?? 1)) * ((int)($comp['qtd_kit'] ?? 1));
                        
                        $saldoStmt = $pdo->prepare("SELECT saldo_atual FROM estoque_saldos WHERE id_nissi = ?");
                        $saldoStmt->execute([$comp['id_kit_nissi']]);
                        $saldoRow = $saldoStmt->fetch(PDO::FETCH_ASSOC);
                        
                        $saldoAnterior = $saldoRow ? (int)$saldoRow['saldo_atual'] : 0;
                        $saldoNovo = $saldoAnterior - $qtdBaixar;

                        if ($saldoRow) {
                            $pdo->prepare("UPDATE estoque_saldos SET saldo_atual = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id_nissi = ?")
                                ->execute([$saldoNovo, $comp['id_kit_nissi']]);
                        } else {
                            $pdo->prepare("INSERT INTO estoque_saldos (id_nissi, saldo_atual, estoque_minimo, atualizado_em) VALUES (?, ?, 5, CURRENT_TIMESTAMP)")
                                ->execute([$comp['id_kit_nissi'], $saldoNovo]);
                        }

                        $pdo->prepare("INSERT INTO estoque_movimentacoes (id_nissi, order_id, tipo, quantidade, saldo_anterior, saldo_novo, usuario) VALUES (?, ?, 'SAIDA_PICKING', ?, ?, ?, ?)")
                            ->execute([$comp['id_kit_nissi'], $orderId, $qtdBaixar, $saldoAnterior, $saldoNovo, $username]);

                        $itemsAffected[] = [
                            'id_nissi' => $comp['id_kit_nissi'],
                            'qtd' => $qtdBaixar,
                            'saldo_anterior' => $saldoAnterior,
                            'saldo_novo' => $saldoNovo,
                            'tipo' => 'SAIDA_PICKING'
                        ];
                    }
                }
                $pdo->prepare("UPDATE pedidos_vendas SET status_picking = ?, separado_em = ?, estoque_deduzido = 1 WHERE order_id = ?")
                    ->execute([$newStatus, $separadoEm, $orderId]);
            } else {
                if (!empty($pedido['estoque_deduzido']) && count($componentes) > 0) {
                    foreach ($componentes as $comp) {
                        $qtdEstornar = ((int)($pedido['quantidade'] ?? 1)) * ((int)($comp['qtd_kit'] ?? 1));
                        
                        $saldoStmt = $pdo->prepare("SELECT saldo_atual FROM estoque_saldos WHERE id_nissi = ?");
                        $saldoStmt->execute([$comp['id_kit_nissi']]);
                        $saldoRow = $saldoStmt->fetch(PDO::FETCH_ASSOC);
                        
                        $saldoAnterior = $saldoRow ? (int)$saldoRow['saldo_atual'] : 0;
                        $saldoNovo = $saldoAnterior + $qtdEstornar;

                        if ($saldoRow) {
                            $pdo->prepare("UPDATE estoque_saldos SET saldo_atual = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id_nissi = ?")
                                ->execute([$saldoNovo, $comp['id_kit_nissi']]);
                        } else {
                            $pdo->prepare("INSERT INTO estoque_saldos (id_nissi, saldo_atual, estoque_minimo, atualizado_em) VALUES (?, ?, 5, CURRENT_TIMESTAMP)")
                                ->execute([$comp['id_kit_nissi'], $saldoNovo]);
                        }

                        $pdo->prepare("INSERT INTO estoque_movimentacoes (id_nissi, order_id, tipo, quantidade, saldo_anterior, saldo_novo, usuario) VALUES (?, ?, 'ESTORNO_PICKING', ?, ?, ?, ?)")
                            ->execute([$comp['id_kit_nissi'], $orderId, $qtdEstornar, $saldoAnterior, $saldoNovo, $username]);

                        $itemsAffected[] = [
                            'id_nissi' => $comp['id_kit_nissi'],
                            'qtd' => $qtdEstornar,
                            'saldo_anterior' => $saldoAnterior,
                            'saldo_novo' => $saldoNovo,
                            'tipo' => 'ESTORNO_PICKING'
                        ];
                    }
                }
                $pdo->prepare("UPDATE pedidos_vendas SET status_picking = ?, separado_em = NULL, estoque_deduzido = 0 WHERE order_id = ?")
                    ->execute([$newStatus, $orderId]);
            }
            $pdo->commit();
        } catch (Exception $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['error' => 'Falha ao atualizar status e estoque: ' . $e->getMessage()]);
            exit;
        }

        echo json_encode([
            'success' => true,
            'order_id' => $orderId,
            'new_status' => $newStatus,
            'items_affected' => $itemsAffected,
            'message' => ($newStatus === 'separado')
                ? (count($itemsAffected) > 0 ? "Pedido separado! " . count($itemsAffected) . " peça(s) deduzida(s) do estoque." : "Pedido separado! (Item próprio sem peças Nissi)")
                : (count($itemsAffected) > 0 ? "Pedido desmarcado! " . count($itemsAffected) . " peça(s) estornada(s) ao estoque." : "Pedido desmarcado!")
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // -------------------------------------------------------------
    // ROTA: /api/stock (Consulta e Gestão de Estoque)
    // -------------------------------------------------------------
    if ($route === 'stock' && $method === 'GET') {
        $search = $_GET['search'] ?? '';
        $localFilter = $_GET['local'] ?? '';
        
        $sql = "
            SELECT 
                d.id_nissi,
                d.descricao,
                d.unidade_medida,
                COALESCE(d.local, 'S/L') as local,
                COALESCE(s.saldo_atual, 0) as saldo_atual,
                COALESCE(s.estoque_minimo, 5) as estoque_minimo,
                COALESCE(s.estoque_minimo, 5) as estoque_desejavel,
                (
                    SELECT COUNT(DISTINCT k.id_ml_anuncio)
                    FROM kits_anuncio k
                    WHERE k.id_kit_nissi = d.id_nissi
                ) as total_anuncios_vinculados
            FROM distribuidor d
            LEFT JOIN estoque_saldos s ON d.id_nissi = s.id_nissi
            WHERE 1=1
        ";
        $params = [];

        if (!empty($search)) {
            $sql .= " AND (d.id_nissi LIKE :search OR d.descricao LIKE :search)";
            $params['search'] = "%$search%";
        }

        if (!empty($localFilter)) {
            $sql .= " AND COALESCE(d.local, 'S/L') LIKE :local";
            $params['local'] = "%$localFilter%";
        }

        $sql .= " ORDER BY COALESCE(d.local, 'S/L') ASC, d.id_nissi ASC LIMIT 500";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $items = $stmt->fetchAll();

        // Métricas de Estoque para Cards KPI
        $totalItems = (int)$pdo->query("SELECT COUNT(*) FROM distribuidor")->fetchColumn();
        $totalUnits = (int)$pdo->query("SELECT COALESCE(SUM(saldo_atual), 0) FROM estoque_saldos")->fetchColumn();
        $lowStockCount = (int)$pdo->query("
            SELECT COUNT(*) 
            FROM distribuidor d 
            LEFT JOIN estoque_saldos s ON d.id_nissi = s.id_nissi 
            WHERE COALESCE(s.saldo_atual, 0) < COALESCE(s.estoque_minimo, 5)
        ")->fetchColumn();
        $unassignedLocalCount = (int)$pdo->query("
            SELECT COUNT(*) 
            FROM distribuidor 
            WHERE local IS NULL OR local = '' OR local = 'S/L'
        ")->fetchColumn();

        echo json_encode([
            'success' => true, 
            'stock' => $items,
            'metrics' => [
                'total_items' => $totalItems,
                'total_units' => $totalUnits,
                'low_stock_count' => $lowStockCount,
                'below_desired_count' => $lowStockCount,
                'unassigned_local_count' => $unassignedLocalCount
            ]
        ]);
        exit;
    }

    // -------------------------------------------------------------
    // ROTA: /api/stock/create (Cadastrar Novo Item no Catálogo Nissi)
    // -------------------------------------------------------------
    if ($route === 'stock/create' && $method === 'POST') {
        CryptoService::requireMaster();
        $idNissi = isset($input['id_nissi']) ? strtoupper(trim(preg_replace('/[^a-zA-Z0-9_\-\.]/', '', $input['id_nissi']))) : '';
        $descricao = isset($input['descricao']) ? trim(strip_tags($input['descricao'])) : '';
        $unidade = (isset($input['unidade_medida']) && strtoupper(trim($input['unidade_medida'])) === 'PAR') ? 'PAR' : 'UNIDADE';
        $local = isset($input['local']) ? strtoupper(trim(preg_replace('/[^a-zA-Z0-9_\-\.]/', '', $input['local']))) : 'S/L';
        $saldo = isset($input['saldo_atual']) ? max(0, (int)$input['saldo_atual']) : 0;
        $minimo = isset($input['estoque_desejavel']) ? max(0, (int)$input['estoque_desejavel']) : (isset($input['estoque_minimo']) ? max(0, (int)$input['estoque_minimo']) : 5);

        if (empty($idNissi)) {
            http_response_code(400);
            echo json_encode(['error' => 'Código Nissi é obrigatório']);
            exit;
        }
        if (empty($descricao)) {
            http_response_code(400);
            echo json_encode(['error' => 'Descrição da peça é obrigatória']);
            exit;
        }

        $checkStmt = $pdo->prepare("SELECT 1 FROM distribuidor WHERE id_nissi = ?");
        $checkStmt->execute([$idNissi]);
        if ($checkStmt->fetch()) {
            http_response_code(409);
            echo json_encode(['error' => "O código Nissi '{$idNissi}' já está cadastrado no sistema."]);
            exit;
        }

        $pdo->beginTransaction();
        try {
            $stmtDist = $pdo->prepare("INSERT INTO distribuidor (id_nissi, descricao, unidade_medida, local) VALUES (?, ?, ?, ?)");
            $stmtDist->execute([$idNissi, $descricao, $unidade, $local ?: 'S/L']);

            $stmtSaldo = $pdo->prepare("INSERT INTO estoque_saldos (id_nissi, saldo_atual, estoque_minimo, atualizado_em) VALUES (?, ?, ?, CURRENT_TIMESTAMP)");
            $stmtSaldo->execute([$idNissi, $saldo, $minimo]);

            $pdo->commit();
        } catch (Exception $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
            exit;
        }

        echo json_encode(['success' => true, 'message' => "Item {$idNissi} cadastrado com sucesso!"]);
        exit;
    }

    // -------------------------------------------------------------
    // ROTA: /api/stock/update (Atualizar Item Completo ou Saldo/Local)
    // -------------------------------------------------------------
    if ($route === 'stock/update' && $method === 'POST') {
        CryptoService::requireMaster();
        $idNissi = isset($input['id_nissi']) ? substr(preg_replace('/[^a-zA-Z0-9_\-\.]/', '', trim($input['id_nissi'])), 0, 30) : '';
        $descricao = isset($input['descricao']) ? trim(strip_tags($input['descricao'])) : null;
        $unidade = isset($input['unidade_medida']) ? ((strtoupper(trim($input['unidade_medida'])) === 'PAR') ? 'PAR' : 'UNIDADE') : null;
        $saldo = isset($input['saldo_atual']) ? max(0, min(1000000, (int)$input['saldo_atual'])) : null;
        $desiredRaw = $input['estoque_desejavel'] ?? $input['estoque_minimo'] ?? null;
        $minimo = $desiredRaw !== null ? max(0, min(100000, (int)$desiredRaw)) : null;
        $novoLocal = isset($input['local']) ? strtoupper(substr(preg_replace('/[^a-zA-Z0-9_\-\.]/', '', trim($input['local'])), 0, 15)) : null;

        if (!$idNissi) {
            http_response_code(400);
            echo json_encode(['error' => 'id_nissi é obrigatório e deve ser alfanumérico']);
            exit;
        }

        $pdo->beginTransaction();
        try {
            if ($descricao !== null || $unidade !== null || $novoLocal !== null) {
                $curStmt = $pdo->prepare("SELECT descricao, unidade_medida, local FROM distribuidor WHERE id_nissi = ?");
                $curStmt->execute([$idNissi]);
                $curr = $curStmt->fetch();
                if ($curr) {
                    $upDesc = $descricao !== null ? $descricao : $curr['descricao'];
                    $upUn = $unidade !== null ? $unidade : $curr['unidade_medida'];
                    $upLoc = $novoLocal !== null ? $novoLocal : $curr['local'];
                    $upDist = $pdo->prepare("UPDATE distribuidor SET descricao = ?, unidade_medida = ?, local = ? WHERE id_nissi = ?");
                    $upDist->execute([$upDesc, $upUn, $upLoc, $idNissi]);
                }
            }

            if ($saldo !== null || $minimo !== null) {
                $stmt = $pdo->prepare("
                    INSERT INTO estoque_saldos (id_nissi, saldo_atual, estoque_minimo, atualizado_em)
                    VALUES (:id, COALESCE(:saldo, 10), COALESCE(:minimo, 5), CURRENT_TIMESTAMP)
                    ON CONFLICT(id_nissi) DO UPDATE SET
                        saldo_atual = COALESCE(:saldo, estoque_saldos.saldo_atual),
                        estoque_minimo = COALESCE(:minimo, estoque_saldos.estoque_minimo),
                        atualizado_em = CURRENT_TIMESTAMP
                ");
                $stmt->execute([
                    'id' => $idNissi,
                    'saldo' => $saldo,
                    'minimo' => $minimo
                ]);
            }

            $pdo->commit();
        } catch (Exception $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
            exit;
        }

        echo json_encode(['success' => true, 'message' => "Item {$idNissi} atualizado com sucesso!"]);
        exit;
    }

    // -------------------------------------------------------------
    // ROTA: /api/stock/adjust (Ajuste Rápido de Saldo +1 / -1 / +X / -X)
    // -------------------------------------------------------------
    if ($route === 'stock/adjust' && $method === 'POST') {
        CryptoService::requireMaster();
        $idNissi = isset($input['id_nissi']) ? substr(preg_replace('/[^a-zA-Z0-9_\-\.]/', '', trim($input['id_nissi'])), 0, 30) : '';
        $delta = isset($input['delta']) ? (int)$input['delta'] : 0;

        if (!$idNissi || $delta === 0) {
            http_response_code(400);
            echo json_encode(['error' => 'id_nissi e delta diferente de zero são obrigatórios']);
            exit;
        }

        $pdo->beginTransaction();
        try {
            $curStmt = $pdo->prepare("SELECT COALESCE(saldo_atual, 0) as s FROM estoque_saldos WHERE id_nissi = ?");
            $curStmt->execute([$idNissi]);
            $curr = $curStmt->fetch();
            $currSaldo = $curr ? (int)$curr['s'] : 0;
            $novoSaldo = max(0, $currSaldo + $delta);

            $stmt = $pdo->prepare("
                INSERT INTO estoque_saldos (id_nissi, saldo_atual, estoque_minimo, atualizado_em)
                VALUES (?, ?, 5, CURRENT_TIMESTAMP)
                ON CONFLICT(id_nissi) DO UPDATE SET
                    saldo_atual = ?,
                    atualizado_em = CURRENT_TIMESTAMP
            ");
            $stmt->execute([$idNissi, $novoSaldo, $novoSaldo]);
            $pdo->commit();

            echo json_encode([
                'success' => true,
                'id_nissi' => $idNissi,
                'saldo_atual' => $novoSaldo,
                'message' => "Saldo de {$idNissi} ajustado para {$novoSaldo} un!"
            ]);
            exit;
        } catch (Exception $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
            exit;
        }
    }

    // -------------------------------------------------------------
    // ROTA: /api/stock/delete (Excluir Item do Catálogo com Proteção)
    // -------------------------------------------------------------
    if ($route === 'stock/delete' && $method === 'POST') {
        CryptoService::requireMaster();
        $idNissi = isset($input['id_nissi']) ? substr(preg_replace('/[^a-zA-Z0-9_\-\.]/', '', trim($input['id_nissi'])), 0, 30) : '';
        $force = !empty($input['force']);

        if (!$idNissi) {
            http_response_code(400);
            echo json_encode(['error' => 'id_nissi é obrigatório']);
            exit;
        }

        $linkStmt = $pdo->prepare("SELECT id_ml_anuncio FROM kits_anuncio WHERE id_kit_nissi = ?");
        $linkStmt->execute([$idNissi]);
        $linked = $linkStmt->fetchAll(PDO::FETCH_COLUMN);

        if (count($linked) > 0 && !$force) {
            echo json_encode([
                'success' => false,
                'requires_confirmation' => true,
                'linked_count' => count($linked),
                'linked_ads' => $linked,
                'warning' => "O item {$idNissi} está vinculado a " . count($linked) . " anúncio(s) do Mercado Livre."
            ]);
            exit;
        }

        $pdo->beginTransaction();
        try {
            $pdo->prepare("DELETE FROM kits_anuncio WHERE id_kit_nissi = ?")->execute([$idNissi]);
            $pdo->prepare("DELETE FROM estoque_saldos WHERE id_nissi = ?")->execute([$idNissi]);
            $pdo->prepare("DELETE FROM distribuidor WHERE id_nissi = ?")->execute([$idNissi]);
            $pdo->commit();

            echo json_encode(['success' => true, 'message' => "Item {$idNissi} excluído do catálogo!"]);
            exit;
        } catch (Exception $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
            exit;
        }
    }

    // -------------------------------------------------------------
    // ROTA: /api/stock/parse-xml (Parse do XML de NF-e do Distribuidor)
    // -------------------------------------------------------------
    if ($route === 'stock/parse-xml' && $method === 'POST') {
        CryptoService::requireMaster();
        $xmlContent = trim((string)($input['xml'] ?? ''));
        if (empty($xmlContent)) {
            http_response_code(400);
            echo json_encode(['error' => 'Arquivo XML não fornecido ou vazio.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        try {
            $parsedNfe = parseNfeXmlPhp($xmlContent);
        } catch (Exception $e) {
            http_response_code(400);
            echo json_encode(['error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $stmtDist = $pdo->prepare("SELECT descricao, unidade_medida, local FROM distribuidor WHERE id_nissi = ?");
        $stmtSaldo = $pdo->prepare("SELECT saldo_atual, ultimo_custo FROM estoque_saldos WHERE id_nissi = ?");

        $itensEnriquecidos = [];
        $totalUnidades = 0;

        foreach ($parsedNfe['itens'] as $item) {
            $cProd = $item['cProd'];
            $stmtDist->execute([$cProd]);
            $dist = $stmtDist->fetch(PDO::FETCH_ASSOC);

            $stmtSaldo->execute([$cProd]);
            $saldoRow = $stmtSaldo->fetch(PDO::FETCH_ASSOC);

            $cadastrado = !empty($dist);
            $saldoAtual = $saldoRow ? (int)$saldoRow['saldo_atual'] : 0;
            $novoSaldo = $saldoAtual + $item['quantidade'];
            $ultimoCusto = $saldoRow ? (float)$saldoRow['ultimo_custo'] : 0.0;
            $totalUnidades += $item['quantidade'];

            $itensEnriquecidos[] = [
                'cProd' => $cProd,
                'xProd' => $item['xProd'],
                'uCom' => $dist ? $dist['unidade_medida'] : $item['uCom'],
                'quantidade' => (int)$item['quantidade'],
                'valorUnitario' => (float)$item['valorUnitario'],
                'cadastrado' => $cadastrado,
                'descricao_cadastrada' => $dist ? $dist['descricao'] : null,
                'local_cadastrado' => $dist ? ($dist['local'] ?: 'S/L') : 'S/L',
                'saldo_atual' => $saldoAtual,
                'novo_saldo' => $novoSaldo,
                'ultimo_custo' => $ultimoCusto
            ];
        }

        echo json_encode([
            'success' => true,
            'nota' => [
                'nNF' => $parsedNfe['nNF'] ?: 'S/N',
                'emitente' => $parsedNfe['emitente'] ?: 'Distribuidor',
                'cnpj' => $parsedNfe['cnpj'] ?: '',
                'dataEmissao' => $parsedNfe['dataEmissao'] ?: '',
                'total_itens' => count($itensEnriquecidos),
                'total_unidades' => $totalUnidades
            ],
            'itens' => $itensEnriquecidos
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // -------------------------------------------------------------
    // ROTA: /api/stock/import-xml (Confirmação e Entrada de Estoque via XML)
    // -------------------------------------------------------------
    if ($route === 'stock/import-xml' && $method === 'POST') {
        CryptoService::requireMaster();
        $user = CryptoService::getAuthenticatedUser();
        $username = $user ? $user['username'] : 'master';

        $nNF = trim((string)($input['nNF'] ?? 'S/N'));
        $emitente = trim((string)($input['emitente'] ?? 'Distribuidor'));
        $itens = $input['itens'] ?? [];

        if (!is_array($itens) || empty($itens)) {
            http_response_code(400);
            echo json_encode(['error' => 'Nenhum item fornecido para importação.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $orderRef = 'NF-' . $nNF;
        $itensImportados = 0;
        $totalUnidades = 0;

        $pdo->beginTransaction();
        try {
            $stmtFindDist = $pdo->prepare("SELECT id_nissi FROM distribuidor WHERE id_nissi = ?");
            $stmtInsertDist = $pdo->prepare("INSERT INTO distribuidor (id_nissi, descricao, unidade_medida, local) VALUES (?, ?, ?, 'S/L')");
            $stmtFindSaldo = $pdo->prepare("SELECT saldo_atual FROM estoque_saldos WHERE id_nissi = ?");
            $stmtUpsertSaldo = $pdo->prepare("
                INSERT INTO estoque_saldos (id_nissi, saldo_atual, estoque_minimo, ultimo_custo, atualizado_em)
                VALUES (?, ?, 5, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(id_nissi) DO UPDATE SET
                    saldo_atual = ?,
                    ultimo_custo = CASE WHEN ? > 0 THEN ? ELSE ultimo_custo END,
                    atualizado_em = CURRENT_TIMESTAMP
            ");
            $stmtMov = $pdo->prepare("
                INSERT INTO estoque_movimentacoes (id_nissi, order_id, tipo, quantidade, saldo_anterior, saldo_novo, usuario)
                VALUES (?, ?, 'ENTRADA', ?, ?, ?, ?)
            ");

            foreach ($itens as $item) {
                $cProd = strtoupper(trim(preg_replace('/[^a-zA-Z0-9_\-\.]/', '', (string)($item['cProd'] ?? ''))));
                $xProd = trim(strip_tags((string)($item['xProd'] ?? '')));
                $uCom = (strtoupper(trim((string)($item['uCom'] ?? ''))) === 'PAR') ? 'PAR' : 'UNIDADE';
                $qtd = max(0, (int)($item['quantidade'] ?? 0));
                $vUn = (float)($item['valorUnitario'] ?? 0.0);

                if (empty($cProd) || $qtd <= 0) continue;

                // Se não existir, cadastra no distribuidor
                $stmtFindDist->execute([$cProd]);
                if (!$stmtFindDist->fetch()) {
                    $stmtInsertDist->execute([$cProd, !empty($xProd) ? $xProd : $cProd, $uCom]);
                }

                // Saldo anterior
                $stmtFindSaldo->execute([$cProd]);
                $curr = $stmtFindSaldo->fetch(PDO::FETCH_ASSOC);
                $saldoAnterior = $curr ? (int)$curr['saldo_atual'] : 0;
                $saldoNovo = $saldoAnterior + $qtd;

                // Upsert saldo
                $stmtUpsertSaldo->execute([$cProd, $saldoNovo, $vUn, $saldoNovo, $vUn, $vUn]);

                // Movimentação de Entrada
                $stmtMov->execute([$cProd, $orderRef, $qtd, $saldoAnterior, $saldoNovo, $username]);

                $itensImportados++;
                $totalUnidades += $qtd;
            }

            $pdo->commit();
        } catch (Exception $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
            exit;
        }

        echo json_encode([
            'success' => true,
            'message' => "Nota Fiscal {$nNF} importada com sucesso! {$itensImportados} produto(s) atualizado(s) (+{$totalUnidades} un).",
            'nNF' => $nNF,
            'itens_importados' => $itensImportados,
            'total_unidades' => $totalUnidades
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // -------------------------------------------------------------
    // ROTA: /api/purchases (Reposição Direta por Unidade Desejável)
    // -------------------------------------------------------------
    if ($route === 'purchases' && $method === 'GET') {
        // Regra: Itens com saldo físico abaixo da unidade desejável (saldo_atual < estoque_desejavel)
        // Quantidade a Comprar = Unidade Desejável - Saldo Físico Atual
        $sql = "
            SELECT 
                d.id_nissi,
                d.descricao,
                d.unidade_medida,
                COALESCE(d.local, 'S/L') as local,
                COALESCE(s.saldo_atual, 0) as saldo_atual,
                COALESCE(s.estoque_minimo, 5) as estoque_minimo,
                COALESCE(s.estoque_minimo, 5) as estoque_desejavel,
                (COALESCE(s.estoque_minimo, 5) - COALESCE(s.saldo_atual, 0)) as compra_desejavel,
                (COALESCE(s.estoque_minimo, 5) - COALESCE(s.saldo_atual, 0)) as sugestao_compra,
                (COALESCE(s.estoque_minimo, 5) - COALESCE(s.saldo_atual, 0)) as quantidade_comprar,
                CASE 
                    WHEN COALESCE(s.saldo_atual, 0) <= 0 THEN 'Zerado (0 un)'
                    ELSE 'Abaixo do Desejável'
                END as urgencia
            FROM distribuidor d
            LEFT JOIN estoque_saldos s ON d.id_nissi = s.id_nissi
            WHERE COALESCE(s.saldo_atual, 0) < COALESCE(s.estoque_minimo, 5)
            ORDER BY 
                CASE WHEN COALESCE(s.saldo_atual, 0) <= 0 THEN 0 ELSE 1 END,
                COALESCE(d.local, 'S/L') ASC,
                d.id_nissi ASC
        ";

        $rawPurchases = $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC);
        $purchases = [];
        $linhasDistribuidor = [];
        $totalUnidades = 0;

        foreach ($rawPurchases as $p) {
            $qtdComprar = max(0, (int)$p['compra_desejavel']);
            $linha = "{$p['id_nissi']} - {$qtdComprar}";
            $totalUnidades += $qtdComprar;
            $linhasDistribuidor[] = $linha;

            $purchases[] = array_merge($p, [
                'compra_desejavel' => $qtdComprar,
                'sugestao_compra' => $qtdComprar,
                'quantidade_comprar' => $qtdComprar,
                'estoque_desejavel' => (int)($p['estoque_desejavel'] ?? $p['estoque_minimo'] ?? 5),
                'linha_distribuidor' => $linha
            ]);
        }

        $textoCodigoUnidade = implode("\n", $linhasDistribuidor);

        echo json_encode([
            'success' => true, 
            'distribuidor' => 'Distribuidor Nissi',
            'data_geracao' => date('d/m/Y H:i'),
            'total_itens' => count($purchases),
            'total_unidades' => $totalUnidades,
            'texto_codigo_unidade' => $textoCodigoUnidade,
            'itens' => $purchases
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // -------------------------------------------------------------
    // ROTA: /api/anuncios/unregistered (Anúncios do ML Vendidos sem Cadastro no Banco)
    // -------------------------------------------------------------
    if ($route === 'anuncios/unregistered' && $method === 'GET') {
        $sql = "
            SELECT 
                p.ml_item_id as id_ml,
                p.titulo,
                COUNT(p.id) as total_pedidos,
                SUM(p.quantidade) as total_unidades,
                MAX(p.data_venda) as ultima_venda
            FROM pedidos_vendas p
            LEFT JOIN anuncios a ON p.ml_item_id = a.id_ml
            WHERE a.id_ml IS NULL
            GROUP BY p.ml_item_id, p.titulo
            ORDER BY total_pedidos DESC
        ";
        $unregistered = $pdo->query($sql)->fetchAll();
        echo json_encode(['success' => true, 'count' => count($unregistered), 'unregistered' => $unregistered]);
        exit;
    }

    // -------------------------------------------------------------
    // ROTA: /api/anuncios/cadastrar (Cadastrar Caixa e Componentes Nissi do Anúncio)
    // -------------------------------------------------------------
    if ($route === 'anuncios/cadastrar' && $method === 'POST') {
        CryptoService::requireMaster();
        $idMl = isset($input['id_ml']) ? preg_replace('/[^0-9]/', '', trim($input['id_ml'])) : '';
        $caixa = isset($input['caixa']) ? preg_replace('/[^a-zA-Z0-9_\-\s]/', '', trim($input['caixa'])) : '1';
        $kit = (isset($input['kit']) && $input['kit'] === 'N') ? 'N' : 'S';
        $componentes = $input['componentes'] ?? [];

        if (empty($idMl)) {
            http_response_code(400);
            echo json_encode(['error' => 'id_ml é obrigatório']);
            exit;
        }

        if ($kit === 'S' && (!is_array($componentes) || count($componentes) === 0)) {
            http_response_code(400);
            echo json_encode(['error' => 'Para anúncios com peças do distribuidor (Kit S), adicione pelo menos 1 componente Nissi.']);
            exit;
        }

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare("
                INSERT INTO anuncios (id_ml, kit, caixa)
                VALUES (:id_ml, :kit, :caixa)
                ON CONFLICT(id_ml) DO UPDATE SET
                    kit = excluded.kit,
                    caixa = excluded.caixa
            ");
            $stmt->execute([
                'id_ml' => $idMl,
                'kit' => $kit,
                'caixa' => $caixa ?: '1'
            ]);

            // Atualiza kits_anuncio (limpa qualquer registro anterior)
            $pdo->prepare("DELETE FROM kits_anuncio WHERE id_ml_anuncio = ?")->execute([$idMl]);

            if ($kit === 'S' && is_array($componentes) && count($componentes) > 0) {
                $stmtComp = $pdo->prepare("INSERT INTO kits_anuncio (id_ml_anuncio, id_kit_nissi, qtd_kit) VALUES (?, ?, ?)");
                foreach ($componentes as $c) {
                    if (!empty($c['id_kit_nissi'])) {
                        $stmtComp->execute([
                            $idMl,
                            trim($c['id_kit_nissi']),
                            max(1, (int)($c['qtd_kit'] ?? 1))
                        ]);
                    }
                }
            }

            // Anúncios sem kit permanecem desmarcados (pendentes) por padrão conforme nova regra
            $pdo->commit();
        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }

        $tipoDesc = ($kit === 'N') ? 'Sem Kit (Produção Local)' : 'Com Kit (' . count($componentes) . ' peças Nissi)';
        $logStmt = $pdo->prepare("INSERT INTO ml_audit_log (evento, detalhes, ip_origem) VALUES (?, ?, ?)");
        $logStmt->execute([
            'ANUNCIO_CADASTRADO',
            "Anúncio MLB-{$idMl} cadastrado: Caixa {$caixa}, Tipo {$tipoDesc}.",
            $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'
        ]);

        echo json_encode([
            'success' => true,
            'message' => "Anúncio MLB-{$idMl} cadastrado com sucesso (" . ($kit === 'N' ? 'Produção Local' : 'Com Kit Nissi') . ")!"
        ]);
        exit;
    }

    // -------------------------------------------------------------
    // ROTA: /api/mercadolivre/config (Credenciais com Criptografia AES-256-GCM)
    // -------------------------------------------------------------
    if ($route === 'mercadolivre/config') {
        require_once __DIR__ . '/crypto.php';

        if ($method === 'GET') {
            $configs = $pdo->query("SELECT chave, valor FROM ml_config")->fetchAll(PDO::FETCH_KEY_PAIR);
            
            // Descriptografar campos sensíveis com AES-256-GCM
            $appId = CryptoService::decrypt($configs['ml_app_id'] ?? '') ?: getenv('ML_APP_ID') ?: '';
            $secret = CryptoService::decrypt($configs['ml_secret_key'] ?? '') ?: getenv('ML_SECRET_KEY') ?: '';
            $sellerId = CryptoService::decrypt($configs['ml_seller_id'] ?? '') ?: getenv('ML_SELLER_ID') ?: '';
            $accessToken = CryptoService::decrypt($configs['ml_access_token'] ?? '') ?: getenv('ML_ACCESS_TOKEN') ?: '';
            $refreshToken = CryptoService::decrypt($configs['ml_refresh_token'] ?? '') ?: getenv('ML_REFRESH_TOKEN') ?: '';

            echo json_encode([
                'success' => true,
                'config' => [
                    'app_id' => $appId,
                    'has_secret' => !empty($secret),
                    'seller_id' => $sellerId,
                    'has_access_token' => !empty($accessToken),
                    'has_refresh_token' => !empty($refreshToken),
                    'connected' => !empty($accessToken),
                    'encryption' => 'AES-256-GCM (AEAD Autenticado)',
                    'token_expires_at' => !empty($configs['ml_token_expires_at']) ? (int)$configs['ml_token_expires_at'] : null,
                    'flex_cutoff' => $configs['flex_cutoff_hour'] ?? getenv('FLEX_CUTOFF_HOUR') ?: '14:00',
                    'coleta_cutoff' => $configs['coleta_cutoff_hour'] ?? getenv('COLETA_CUTOFF_HOUR') ?: '16:00',
                ]
            ]);
            exit;
        }

        if ($method === 'POST') {
            CryptoService::requireMaster();
            $stmt = $pdo->prepare("INSERT OR REPLACE INTO ml_config (chave, valor, atualizado_em) VALUES (?, ?, CURRENT_TIMESTAMP)");
            
            // Criptografar campos sensíveis antes de persistir no banco de dados SQLite
            if (!empty($input['app_id'])) {
                $stmt->execute(['ml_app_id', CryptoService::encrypt(trim($input['app_id']))]);
            }
            if (!empty($input['secret_key'])) {
                $stmt->execute(['ml_secret_key', CryptoService::encrypt(trim($input['secret_key']))]);
            }
            if (!empty($input['seller_id'])) {
                $stmt->execute(['ml_seller_id', CryptoService::encrypt(trim($input['seller_id']))]);
            }
            if (!empty($input['access_token'])) {
                $stmt->execute(['ml_access_token', CryptoService::encrypt(trim($input['access_token']))]);
            }
            if (!empty($input['refresh_token'])) {
                $stmt->execute(['ml_refresh_token', CryptoService::encrypt(trim($input['refresh_token']))]);
            }
            if (!empty($input['flex_cutoff'])) {
                $stmt->execute(['flex_cutoff_hour', trim($input['flex_cutoff'])]);
            }
            if (!empty($input['coleta_cutoff'])) {
                $stmt->execute(['coleta_cutoff_hour', trim($input['coleta_cutoff'])]);
            }

            echo json_encode([
                'success' => true, 
                'message' => 'Credenciais criptografadas com AES-256-GCM e salvas no banco com sucesso!'
            ]);
            exit;
        }
    }

    // -------------------------------------------------------------
    // ROTA: /api/mercadolivre/auth-url (OAuth 2.0 com State Anti-CSRF)
    // -------------------------------------------------------------
    if ($route === 'mercadolivre/auth-url' && $method === 'GET') {
        require_once __DIR__ . '/mercadolivre.php';
        $client = new MercadoLivreClient($pdo);
        $authUrl = $client->getAuthUrl();
        echo json_encode([
            'success' => true,
            'auth_url' => $authUrl
        ]);
        exit;
    }

    // -------------------------------------------------------------
    // ROTA: /api/mercadolivre/callback (Callback OAuth com Validação de State)
    // -------------------------------------------------------------
    if ($route === 'mercadolivre/callback') {
        require_once __DIR__ . '/mercadolivre.php';
        $client = new MercadoLivreClient($pdo);
        $code = $_GET['code'] ?? $input['code'] ?? '';
        $state = $_GET['state'] ?? $input['state'] ?? '';

        if (empty($code)) {
            http_response_code(400);
            echo json_encode(['error' => 'Código de autorização não informado.']);
            exit;
        }

        if (empty($state) || !$client->validateState($state)) {
            http_response_code(403);
            echo json_encode(['error' => 'Falha de segurança: parâmetro state inválido ou expirado (Prevenção contra CSRF).']);
            exit;
        }

        $res = $client->exchangeCode($code);
        if (isset($res['error'])) {
            http_response_code(400);
            echo json_encode($res);
            exit;
        }

        if ($method === 'GET') {
            header('Location: /?ml_auth=success');
            exit;
        }

        echo json_encode([
            'success' => true,
            'message' => 'Conta do Mercado Livre vinculada com sucesso! Tokens armazenados com criptografia AES-256-GCM.'
        ]);
        exit;
    }

    // -------------------------------------------------------------
    // ROTA: /api/mercadolivre/refresh (Renovação Manual / Preventiva de Token)
    // -------------------------------------------------------------
    if ($route === 'mercadolivre/refresh' && $method === 'POST') {
        require_once __DIR__ . '/mercadolivre.php';
        $client = new MercadoLivreClient($pdo);
        $res = $client->refreshToken();
        if (isset($res['error'])) {
            http_response_code(400);
            echo json_encode($res);
            exit;
        }
        echo json_encode([
            'success' => true,
            'message' => 'Tokens de acesso do Mercado Livre renovados com sucesso!'
        ]);
        exit;
    }

    // -------------------------------------------------------------
    // ROTA: /api/mercadolivre/sync (Sincronização Real de Pedidos com ML)
    // -------------------------------------------------------------
    if ($route === 'mercadolivre/sync' && $method === 'POST') {
        CryptoService::requireMaster();
        require_once __DIR__ . '/mercadolivre.php';
        $client = new MercadoLivreClient($pdo);
        $res = $client->syncTodayOrders();
        if (isset($res['error'])) {
            http_response_code(400);
            echo json_encode($res);
            exit;
        }
        echo json_encode($res);
        exit;
    }

    // -------------------------------------------------------------
    // ROTA: /api/mercadolivre/audit-logs (Trilha de Auditoria de Segurança)
    // -------------------------------------------------------------
    if ($route === 'mercadolivre/audit-logs' && $method === 'GET') {
        CryptoService::requireMaster();
        $logs = $pdo->query("SELECT * FROM ml_audit_log ORDER BY id DESC LIMIT 50")->fetchAll();
        echo json_encode([
            'success' => true,
            'total' => count($logs),
            'logs' => $logs
        ]);
        exit;
    }

    // -------------------------------------------------------------
    // ROTA: /api/orders/reset (Limpar Pedidos)
    // -------------------------------------------------------------
    if ($route === 'orders/reset' && $method === 'POST') {
        CryptoService::requireMaster();
        $pdo->exec("DELETE FROM pedidos_vendas");
        echo json_encode(['success' => true, 'message' => 'Fila de pedidos limpa com sucesso!']);
        exit;
    }

    // Rota não encontrada
    http_response_code(404);
    echo json_encode(['error' => "Rota '/api/{$route}' não encontrada."]);
} catch (Exception $e) {
    error_log("Dfast API Error: " . $e->getMessage());
    http_response_code(500);
    $debug = getenv('APP_DEBUG') === 'true';
    echo json_encode([
        'error' => $debug ? $e->getMessage() : 'Ocorreu um erro interno ao processar a requisição no servidor.'
    ]);
}
