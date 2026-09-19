<?php
// ================================================================
// DFAST ONLINE - CONEXÃO COM O BANCO SQLITE (COMPATÍVEL HOSTGATOR)
// ================================================================

function getDatabaseConnection(): PDO {
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    // Carregar .env se existir
    $envPath = __DIR__ . '/../.env';
    if (file_exists($envPath)) {
        $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line) || str_starts_with($line, '#')) continue;
            if (strpos($line, '=') !== false) {
                list($key, $val) = explode('=', $line, 2);
                $key = trim($key);
                $val = trim($val);
                if (!array_key_exists($key, $_ENV)) {
                    $_ENV[$key] = $val;
                    $_SERVER[$key] = $val;
                    @putenv("$key=$val");
                }
            }
        }
    }

    // Identificar caminho do arquivo do banco SQLite
    $customPath = $_ENV['DATABASE_PATH'] ?? $_SERVER['DATABASE_PATH'] ?? getenv('DATABASE_PATH');
    $possiblePaths = [
        $customPath,
        $customPath ? __DIR__ . '/../' . $customPath : null,
        $customPath ? __DIR__ . '/' . $customPath : null,
        __DIR__ . '/database/db_app.db',
        __DIR__ . '/../database/db_app.db',
        __DIR__ . '/../../database/db_app.db',
        'C:/Users/User/projetos/banco de dados Dfast/db_app.db'
    ];

    $dbFile = null;
    foreach ($possiblePaths as $p) {
        if (!empty($p) && file_exists($p)) {
            $dbFile = $p;
            break;
        }
    }

    if (!$dbFile) {
        // Se ainda não existir na pasta, cria ou usa a pasta database local
        $dbDir = __DIR__ . '/database';
        if (!is_dir($dbDir)) {
            mkdir($dbDir, 0755, true);
        }
        $dbFile = $dbDir . '/db_app.db';
    }

    try {
        $pdo = new PDO("sqlite:" . $dbFile);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

        // Otimizações de concorrência e integridade para SQLite
        $pdo->exec("PRAGMA busy_timeout = 10000;");
        $pdo->exec("PRAGMA journal_mode = WAL;");
        $pdo->exec("PRAGMA foreign_keys = ON;");

        // Inicializar tabelas complementares sem afetar as tabelas existentes do Danilo
        initSupplementaryTables($pdo);

        return $pdo;
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Falha ao conectar com o banco de dados SQLite: ' . $e->getMessage()]);
        exit;
    }
}

function initSupplementaryTables(PDO $pdo): void {
    // Tabela de Saldos Físicos de Estoque vinculada ao distribuidor (id_nissi)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS estoque_saldos (
            id_nissi TEXT PRIMARY KEY,
            saldo_atual INTEGER DEFAULT 10,
            estoque_minimo INTEGER DEFAULT 5,
            ultimo_custo REAL DEFAULT 0.0,
            atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (id_nissi) REFERENCES distribuidor (id_nissi) ON DELETE CASCADE
        );
    ");

    // Tabela de Pedidos e Vendas do Mercado Livre para Separação / Picking
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS pedidos_vendas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id TEXT UNIQUE NOT NULL,
            ml_item_id TEXT NOT NULL,
            titulo TEXT NOT NULL,
            quantidade INTEGER NOT NULL DEFAULT 1,
            comprador TEXT,
            data_venda DATETIME DEFAULT CURRENT_TIMESTAMP,
            envio_tipo TEXT DEFAULT 'flex',
            envio_status TEXT DEFAULT 'ready_to_ship',
            status_picking TEXT DEFAULT 'pendente',
            separado_em DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    ");

    // Tabela de Configurações do Mercado Livre
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS ml_config (
            chave TEXT PRIMARY KEY,
            valor TEXT,
            atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    ");

    // Tabela de Auditoria de Segurança para Eventos do Mercado Livre (LGPD & Security Compliance)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS ml_audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            evento TEXT NOT NULL,
            detalhes TEXT,
            ip_origem TEXT,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            nome TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('master', 'basico')),
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            ultimo_login DATETIME
        );
    ");

    // Inicialização e Sincronização dos Usuários Padrão (RBAC)
    require_once __DIR__ . '/crypto.php';
    try {
        $masterStmt = $pdo->prepare("SELECT id FROM usuarios WHERE LOWER(username) = LOWER('daniloivanoff')");
        $masterStmt->execute();
        $masterId = $masterStmt->fetchColumn();
        if (!$masterId) {
            $pdo->prepare("INSERT INTO usuarios (username, nome, password_hash, role) VALUES (?, ?, ?, ?)")
                ->execute(['daniloivanoff', 'Danilo Ivanoff', CryptoService::hashPassword('D4n1l002!@!'), 'master']);
        } else {
            $pdo->prepare("UPDATE usuarios SET nome = 'Danilo Ivanoff', password_hash = ?, role = 'master' WHERE id = ?")
                ->execute([CryptoService::hashPassword('D4n1l002!@!'), $masterId]);
        }

        $basicoStmt = $pdo->prepare("SELECT id FROM usuarios WHERE LOWER(username) = LOWER('dfast')");
        $basicoStmt->execute();
        $basicoId = $basicoStmt->fetchColumn();
        if (!$basicoId) {
            $pdo->prepare("INSERT INTO usuarios (username, nome, password_hash, role) VALUES (?, ?, ?, ?)")
                ->execute(['dfast', 'Operador Dfast', CryptoService::hashPassword('dfast355'), 'basico']);
        } else {
            $pdo->prepare("UPDATE usuarios SET nome = 'Operador Dfast', password_hash = ?, role = 'basico' WHERE id = ?")
                ->execute([CryptoService::hashPassword('dfast355'), $basicoId]);
        }
    } catch (Exception $e) {
        // Silencioso
    }

    // Migração de Criptografia Automática para Campos Sensíveis
    $sensitiveKeys = ['ml_app_id', 'ml_secret_key', 'ml_seller_id', 'ml_access_token', 'ml_refresh_token'];
    $rows = $pdo->query("SELECT chave, valor FROM ml_config")->fetchAll(PDO::FETCH_KEY_PAIR);
    $stmtUpdate = $pdo->prepare("UPDATE ml_config SET valor = ?, atualizado_em = CURRENT_TIMESTAMP WHERE chave = ?");
    foreach ($sensitiveKeys as $k) {
        if (!empty($rows[$k]) && !str_starts_with($rows[$k], 'enc:v1:')) {
            $stmtUpdate->execute([CryptoService::encrypt($rows[$k]), $k]);
        }
    }

    // Auto-popular estoque_saldos para os itens do distribuidor se estiver vazio
    $count = $pdo->query("SELECT COUNT(*) FROM estoque_saldos")->fetchColumn();
    if ($count == 0) {
        $pdo->exec("
            INSERT OR IGNORE INTO estoque_saldos (id_nissi, saldo_atual, estoque_minimo)
            SELECT id_nissi, 15, 5 FROM distribuidor;
        ");
    }
}
