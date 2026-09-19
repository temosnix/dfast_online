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

try {
    // -------------------------------------------------------------
    // ROTA: /api/stats (Estatísticas do Painel)
    // -------------------------------------------------------------
    if ($route === 'stats' && $method === 'GET') {
        $totalAnuncios = $pdo->query("SELECT COUNT(*) FROM anuncios")->fetchColumn();
        $totalComponentes = $pdo->query("SELECT COUNT(*) FROM distribuidor")->fetchColumn();
        
        $totalPedidos = $pdo->query("SELECT COUNT(*) FROM pedidos_vendas")->fetchColumn();
        $pedidosPendentes = $pdo->query("SELECT COUNT(*) FROM pedidos_vendas WHERE status_picking = 'pendente'")->fetchColumn();
        $pedidosSeparados = $pdo->query("SELECT COUNT(*) FROM pedidos_vendas WHERE status_picking = 'separado'")->fetchColumn();
        $pedidosFlex = $pdo->query("SELECT COUNT(*) FROM pedidos_vendas WHERE envio_tipo = 'flex' AND status_picking = 'pendente'")->fetchColumn();

        // Itens com estoque baixo
        $estoqueBaixo = $pdo->query("
            SELECT COUNT(*) FROM estoque_saldos s 
            WHERE s.saldo_atual <= s.estoque_minimo
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
            ]
        ]);
        exit;
    }

    // -------------------------------------------------------------
    // ROTA: /api/picking (Lista de Separação Inteligente)
    // -------------------------------------------------------------
    if ($route === 'picking' && $method === 'GET') {
        // 1. Visão por Pedido
        $pedidos = $pdo->query("
            SELECT p.*, a.kit, a.caixa
            FROM pedidos_vendas p
            LEFT JOIN anuncios a ON p.ml_item_id = a.id_ml
            ORDER BY 
                CASE WHEN p.envio_tipo = 'flex' THEN 0 ELSE 1 END,
                p.status_picking ASC,
                p.id ASC
        ")->fetchAll();

        foreach ($pedidos as &$ped) {
            $stmt = $pdo->prepare("
                SELECT 
                    k.id_kit_nissi,
                    (k.qtd_kit * :qtd_pedido) as qtd_necessaria,
                    d.descricao,
                    d.unidade_medida,
                    d.local,
                    COALESCE(s.saldo_atual, 0) as saldo_atual
                FROM kits_anuncio k
                JOIN distribuidor d ON k.id_kit_nissi = d.id_nissi
                LEFT JOIN estoque_saldos s ON d.id_nissi = s.id_nissi
                WHERE k.id_ml_anuncio = :id_ml
                ORDER BY d.local ASC
            ");
            $stmt->execute([
                'qtd_pedido' => $ped['quantidade'],
                'id_ml' => $ped['ml_item_id']
            ]);
            $ped['componentes'] = $stmt->fetchAll();
        }

        // 2. Visão Consolidada por Localização no Galpão (Rota de Picking Otimizada)
        $consolidadoStmt = $pdo->query("
            SELECT 
                d.local,
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
            WHERE p.status_picking = 'pendente'
            GROUP BY d.local, k.id_kit_nissi
            ORDER BY d.local ASC, k.id_kit_nissi ASC
        ");
        $consolidado = $consolidadoStmt->fetchAll();

        // 3. Resumo de Caixas Necessárias para o Despacho
        $caixasStmt = $pdo->query("
            SELECT 
                COALESCE(a.caixa, 'Indefinida') as numero_caixa,
                SUM(p.quantidade) as total_caixas
            FROM pedidos_vendas p
            LEFT JOIN anuncios a ON p.ml_item_id = a.id_ml
            WHERE p.status_picking = 'pendente'
            GROUP BY a.caixa
            ORDER BY a.caixa ASC
        ");
        $caixas = $caixasStmt->fetchAll();

        echo json_encode([
            'success' => true,
            'pedidos' => $pedidos,
            'rota_consolidada' => $consolidado,
            'caixas_necessarias' => $caixas,
        ]);
        exit;
    }

    // -------------------------------------------------------------
    // ROTA: /api/picking/toggle (Alternar Status de Separação)
    // -------------------------------------------------------------
    if ($route === 'picking/toggle' && $method === 'POST') {
        $orderId = $input['order_id'] ?? '';
        if (!$orderId) {
            http_response_code(400);
            echo json_encode(['error' => 'order_id é obrigatório']);
            exit;
        }

        $current = $pdo->prepare("SELECT status_picking FROM pedidos_vendas WHERE order_id = ?");
        $current->execute([$orderId]);
        $row = $current->fetch();

        if (!$row) {
            http_response_code(404);
            echo json_encode(['error' => 'Pedido não encontrado']);
            exit;
        }

        $newStatus = ($row['status_picking'] === 'separado') ? 'pendente' : 'separado';
        $separadoEm = ($newStatus === 'separado') ? date('Y-m-d H:i:s') : null;

        $update = $pdo->prepare("UPDATE pedidos_vendas SET status_picking = ?, separado_em = ? WHERE order_id = ?");
        $update->execute([$newStatus, $separadoEm, $orderId]);

        echo json_encode([
            'success' => true,
            'order_id' => $orderId,
            'new_status' => $newStatus,
            'message' => "Pedido {$orderId} marcado como {$newStatus}!"
        ]);
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
                d.local,
                COALESCE(s.saldo_atual, 0) as saldo_atual,
                COALESCE(s.estoque_minimo, 5) as estoque_minimo,
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
            $sql .= " AND d.local LIKE :local";
            $params['local'] = "%$localFilter%";
        }

        $sql .= " ORDER BY d.local ASC, d.id_nissi ASC LIMIT 300";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $items = $stmt->fetchAll();

        echo json_encode(['success' => true, 'stock' => $items]);
        exit;
    }

    // -------------------------------------------------------------
    // ROTA: /api/stock/update (Atualizar Saldo ou Localização)
    // -------------------------------------------------------------
    if ($route === 'stock/update' && $method === 'POST') {
        $idNissi = isset($input['id_nissi']) ? substr(preg_replace('/[^a-zA-Z0-9_\-\.]/', '', trim($input['id_nissi'])), 0, 30) : '';
        $saldo = isset($input['saldo_atual']) ? max(0, min(1000000, (int)$input['saldo_atual'])) : null;
        $minimo = isset($input['estoque_minimo']) ? max(0, min(100000, (int)$input['estoque_minimo'])) : null;
        $novoLocal = isset($input['local']) ? strtoupper(substr(preg_replace('/[^a-zA-Z0-9_\-\.]/', '', trim($input['local'])), 0, 15)) : null;

        if (!$idNissi) {
            http_response_code(400);
            echo json_encode(['error' => 'id_nissi é obrigatório e deve ser alfanumérico']);
            exit;
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

        if ($novoLocal !== null) {
            $stmtLocal = $pdo->prepare("UPDATE distribuidor SET local = ? WHERE id_nissi = ?");
            $stmtLocal->execute([$novoLocal, $idNissi]);
        }

        echo json_encode(['success' => true, 'message' => "Item {$idNissi} atualizado com sucesso!"]);
        exit;
    }

    // -------------------------------------------------------------
    // ROTA: /api/purchases (Gerador de Lista de Compras Nissi)
    // -------------------------------------------------------------
    if ($route === 'purchases' && $method === 'GET') {
        // Itens que precisam ser comprados:
        // 1. Demanda para suprir vendas pendentes que excedem o saldo
        // 2. Reposição de itens abaixo do estoque mínimo
        $sql = "
            SELECT 
                d.id_nissi,
                d.descricao,
                d.unidade_medida,
                d.local,
                COALESCE(s.saldo_atual, 0) as saldo_atual,
                COALESCE(s.estoque_minimo, 5) as estoque_minimo,
                COALESCE(demanda.total_vendido, 0) as demanda_pendente,
                CASE 
                    WHEN COALESCE(s.saldo_atual, 0) < COALESCE(demanda.total_vendido, 0)
                        THEN (COALESCE(demanda.total_vendido, 0) - COALESCE(s.saldo_atual, 0) + COALESCE(s.estoque_minimo, 5))
                    WHEN COALESCE(s.saldo_atual, 0) <= COALESCE(s.estoque_minimo, 5)
                        THEN (COALESCE(s.estoque_minimo, 5) * 2 - COALESCE(s.saldo_atual, 0))
                    ELSE 0
                END as sugestao_compra,
                CASE 
                    WHEN COALESCE(s.saldo_atual, 0) < COALESCE(demanda.total_vendido, 0) THEN 'URGENTE (Falta para Envio)'
                    WHEN COALESCE(s.saldo_atual, 0) <= COALESCE(s.estoque_minimo, 5) THEN 'Reposição Preventiva'
                    ELSE 'Estoque Normal'
                END as urgencia
            FROM distribuidor d
            LEFT JOIN estoque_saldos s ON d.id_nissi = s.id_nissi
            LEFT JOIN (
                SELECT 
                    k.id_kit_nissi,
                    SUM(k.qtd_kit * p.quantidade) as total_vendido
                FROM pedidos_vendas p
                JOIN kits_anuncio k ON p.ml_item_id = k.id_ml_anuncio
                WHERE p.status_picking = 'pendente'
                GROUP BY k.id_kit_nissi
            ) demanda ON d.id_nissi = demanda.id_kit_nissi
            WHERE 
                (COALESCE(s.saldo_atual, 0) < COALESCE(demanda.total_vendido, 0))
                OR (COALESCE(s.saldo_atual, 0) <= COALESCE(s.estoque_minimo, 5))
            ORDER BY 
                CASE WHEN COALESCE(s.saldo_atual, 0) < COALESCE(demanda.total_vendido, 0) THEN 0 ELSE 1 END,
                d.descricao ASC
        ";

        $purchases = $pdo->query($sql)->fetchAll();
        echo json_encode([
            'success' => true,
            'distribuidor' => 'Distribuidor Nissi',
            'data_geracao' => date('d/m/Y H:i'),
            'total_itens' => count($purchases),
            'itens' => $purchases
        ]);
        exit;
    }

    // -------------------------------------------------------------
    // ROTA: /api/mercadolivre/config (Credenciais Mercado Livre)
    // -------------------------------------------------------------
    if ($route === 'mercadolivre/config') {
        if ($method === 'GET') {
            $configs = $pdo->query("SELECT chave, valor FROM ml_config")->fetchAll(PDO::FETCH_KEY_PAIR);
            // Mascarar chaves secretas por segurança
            $appId = $configs['ml_app_id'] ?? getenv('ML_APP_ID') ?: '';
            $secret = $configs['ml_secret_key'] ?? getenv('ML_SECRET_KEY') ?: '';
            $hasSecret = !empty($secret);
            $sellerId = $configs['ml_seller_id'] ?? getenv('ML_SELLER_ID') ?: '';
            $hasToken = !empty($configs['ml_access_token'] ?? getenv('ML_ACCESS_TOKEN'));

            echo json_encode([
                'success' => true,
                'config' => [
                    'app_id' => $appId,
                    'has_secret' => $hasSecret,
                    'seller_id' => $sellerId,
                    'connected' => $hasToken,
                    'flex_cutoff' => $configs['flex_cutoff_hour'] ?? getenv('FLEX_CUTOFF_HOUR') ?: '14:00',
                    'coleta_cutoff' => $configs['coleta_cutoff_hour'] ?? getenv('COLETA_CUTOFF_HOUR') ?: '16:00',
                ]
            ]);
            exit;
        }

        if ($method === 'POST') {
            $stmt = $pdo->prepare("INSERT OR REPLACE INTO ml_config (chave, valor, atualizado_em) VALUES (?, ?, CURRENT_TIMESTAMP)");
            
            if (!empty($input['app_id'])) $stmt->execute(['ml_app_id', trim($input['app_id'])]);
            if (!empty($input['secret_key'])) $stmt->execute(['ml_secret_key', trim($input['secret_key'])]);
            if (!empty($input['seller_id'])) $stmt->execute(['ml_seller_id', trim($input['seller_id'])]);
            if (!empty($input['flex_cutoff'])) $stmt->execute(['flex_cutoff_hour', trim($input['flex_cutoff'])]);
            if (!empty($input['coleta_cutoff'])) $stmt->execute(['coleta_cutoff_hour', trim($input['coleta_cutoff'])]);

            echo json_encode(['success' => true, 'message' => 'Configurações salvas no banco com sucesso!']);
            exit;
        }
    }

    // -------------------------------------------------------------
    // ROTA: /api/mercadolivre/simulate (Simulador com 767 Anúncios Reais)
    // -------------------------------------------------------------
    if ($route === 'mercadolivre/simulate' && $method === 'POST') {
        // Selecionar 8 anúncios aleatórios do banco existente do Danilo que possuem kits
        $anuncios = $pdo->query("
            SELECT DISTINCT a.id_ml, a.kit, a.caixa
            FROM anuncios a
            JOIN kits_anuncio k ON a.id_ml = k.id_ml_anuncio
            ORDER BY RANDOM()
            LIMIT 8
        ")->fetchAll();

        $nomesFicticios = [
            'Carlos Alberto Silva', 'Mariana Oliveira Souza', 'Roberto Ferreira Santos', 
            'Juliana Costa Lima', 'Fernando Mendes Rocha', 'Patrícia Martins Ramos',
            'Lucas Henrique Dias', 'Amanda Ribeiro Duarte'
        ];

        $stmtInsert = $pdo->prepare("
            INSERT OR REPLACE INTO pedidos_vendas 
            (order_id, ml_item_id, titulo, quantidade, comprador, envio_tipo, envio_status, status_picking)
            VALUES (:order_id, :ml_item_id, :titulo, :quantidade, :comprador, :envio_tipo, 'ready_to_ship', 'pendente')
        ");

        $stmtDesc = $pdo->prepare("
            SELECT d.descricao FROM kits_anuncio k 
            JOIN distribuidor d ON k.id_kit_nissi = d.id_nissi 
            WHERE k.id_ml_anuncio = ? LIMIT 1
        ");

        $gerados = 0;
        foreach ($anuncios as $idx => $anuncio) {
            $stmtDesc->execute([$anuncio['id_ml']]);
            $descComponente = $stmtDesc->fetchColumn() ?: 'Kit de Suspensão Automotiva';

            $orderId = '20000' . rand(1000000, 9999999);
            $tipoEnvio = ($idx % 2 === 0) ? 'flex' : 'coleta'; // Metade Flex (mesmo dia), metade Coleta
            $qtd = ($idx === 2) ? 2 : 1;

            $stmtInsert->execute([
                'order_id' => $orderId,
                'ml_item_id' => $anuncio['id_ml'],
                'titulo' => "MLB{$anuncio['id_ml']} - " . $descComponente,
                'quantidade' => $qtd,
                'comprador' => $nomesFicticios[$idx % count($nomesFicticios)],
                'envio_tipo' => $tipoEnvio
            ]);
            $gerados++;
        }

        echo json_encode([
            'success' => true,
            'message' => "{$gerados} pedidos reais do Mercado Livre simulados com sucesso para expedição hoje!",
            'total_gerados' => $gerados
        ]);
        exit;
    }

    // -------------------------------------------------------------
    // ROTA: /api/orders/reset (Limpar Pedidos)
    // -------------------------------------------------------------
    if ($route === 'orders/reset' && $method === 'POST') {
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
