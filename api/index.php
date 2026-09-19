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

        // Anúncios vendidos sem cadastro no banco
        $anunciosSemCadastro = $pdo->query("
            SELECT COUNT(DISTINCT p.ml_item_id) 
            FROM pedidos_vendas p
            LEFT JOIN anuncios a ON p.ml_item_id = a.id_ml
            WHERE a.id_ml IS NULL
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
            SELECT p.*, a.kit, a.caixa, (a.id_ml IS NOT NULL) as cadastrado
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
                    COALESCE(d.local, 'S/L') as local,
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
            WHERE p.status_picking = 'pendente'
            GROUP BY COALESCE(d.local, 'S/L'), k.id_kit_nissi
            ORDER BY COALESCE(d.local, 'S/L') ASC, k.id_kit_nissi ASC
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
                COALESCE(d.local, 'S/L') as local,
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
            WHERE COALESCE(s.saldo_atual, 0) <= COALESCE(s.estoque_minimo, 5)
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
                'unassigned_local_count' => $unassignedLocalCount
            ]
        ]);
        exit;
    }

    // -------------------------------------------------------------
    // ROTA: /api/stock/create (Cadastrar Novo Item no Catálogo Nissi)
    // -------------------------------------------------------------
    if ($route === 'stock/create' && $method === 'POST') {
        $idNissi = isset($input['id_nissi']) ? strtoupper(trim(preg_replace('/[^a-zA-Z0-9_\-\.]/', '', $input['id_nissi']))) : '';
        $descricao = isset($input['descricao']) ? trim(strip_tags($input['descricao'])) : '';
        $unidade = (isset($input['unidade_medida']) && strtoupper(trim($input['unidade_medida'])) === 'PAR') ? 'PAR' : 'UNIDADE';
        $local = isset($input['local']) ? strtoupper(trim(preg_replace('/[^a-zA-Z0-9_\-\.]/', '', $input['local']))) : 'S/L';
        $saldo = isset($input['saldo_atual']) ? max(0, (int)$input['saldo_atual']) : 0;
        $minimo = isset($input['estoque_minimo']) ? max(0, (int)$input['estoque_minimo']) : 5;

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
        $idNissi = isset($input['id_nissi']) ? substr(preg_replace('/[^a-zA-Z0-9_\-\.]/', '', trim($input['id_nissi'])), 0, 30) : '';
        $descricao = isset($input['descricao']) ? trim(strip_tags($input['descricao'])) : null;
        $unidade = isset($input['unidade_medida']) ? ((strtoupper(trim($input['unidade_medida'])) === 'PAR') ? 'PAR' : 'UNIDADE') : null;
        $saldo = isset($input['saldo_atual']) ? max(0, min(1000000, (int)$input['saldo_atual'])) : null;
        $minimo = isset($input['estoque_minimo']) ? max(0, min(100000, (int)$input['estoque_minimo'])) : null;
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
                COALESCE(d.local, 'S/L') as local,
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
        $idMl = isset($input['id_ml']) ? preg_replace('/[^0-9]/', '', trim($input['id_ml'])) : '';
        $caixa = isset($input['caixa']) ? preg_replace('/[^a-zA-Z0-9_\-\s]/', '', trim($input['caixa'])) : '1';
        $kit = (isset($input['kit']) && $input['kit'] === 'N') ? 'N' : 'S';
        $componentes = $input['componentes'] ?? [];

        if (empty($idMl)) {
            http_response_code(400);
            echo json_encode(['error' => 'id_ml é obrigatório']);
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

            // Atualiza kits_anuncio
            $pdo->prepare("DELETE FROM kits_anuncio WHERE id_ml_anuncio = ?")->execute([$idMl]);

            if (is_array($componentes) && count($componentes) > 0) {
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
            $pdo->commit();
        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }

        $logStmt = $pdo->prepare("INSERT INTO ml_audit_log (evento, detalhes, ip_origem) VALUES (?, ?, ?)");
        $logStmt->execute([
            'ANUNCIO_CADASTRADO',
            "Anúncio MLB-{$idMl} cadastrado: Caixa {$caixa}, Kit {$kit}, " . count($componentes) . " componentes.",
            $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'
        ]);

        echo json_encode([
            'success' => true,
            'message' => "Anúncio MLB-{$idMl} cadastrado com sucesso no banco de dados SQLite!"
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
