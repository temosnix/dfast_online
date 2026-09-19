// ================================================================
// DFAST ONLINE - SERVIDOR LOCAL NODE.JS (DESENVOLVIMENTO & TESTES)
// Utiliza node:sqlite nativo do Node 24 - 100% sem dependências externas!
// ================================================================

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');

const CIPHER_ALGO = 'aes-256-gcm';
const ENC_PREFIX = 'enc:v1:';

function getMasterKey() {
  const masterKey = process.env.APP_ENCRYPTION_KEY || 'dfast_online_master_aes256_key_sec_2026_hostgator';
  return crypto.createHash('sha256').update(masterKey).digest();
}

function encryptField(plaintext) {
  if (!plaintext) return plaintext;
  if (typeof plaintext === 'string' && plaintext.startsWith(ENC_PREFIX)) return plaintext;
  const key = getMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(CIPHER_ALGO, key, iv);
  let ciphertext = cipher.update(String(plaintext), 'utf8');
  ciphertext = Buffer.concat([ciphertext, cipher.final()]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, tag, ciphertext]);
  return ENC_PREFIX + combined.toString('base64');
}

function decryptField(data) {
  if (!data || typeof data !== 'string' || !data.startsWith(ENC_PREFIX)) return data;
  try {
    const raw = Buffer.from(data.slice(ENC_PREFIX.length), 'base64');
    if (raw.length < 28) return data;
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ciphertext = raw.subarray(28);
    const key = getMasterKey();
    const decipher = crypto.createDecipheriv(CIPHER_ALGO, key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(ciphertext, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return null;
  }
}

// Carregar variáveis do .env se existir
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...valParts] = trimmed.split('=');
      const val = valParts.join('=').trim();
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = val;
      }
    }
  });
}

const PORT = parseInt(process.env.PORT || '3001', 10);
const DB_PATH = process.env.DATABASE_PATH || 'C:/Users/User/projetos/banco de dados Dfast/db_app.db';

console.log(`[Dfast Online] Conectando ao SQLite: ${DB_PATH}`);
let db;
try {
  db = new DatabaseSync(DB_PATH);
  db.exec(`
    PRAGMA busy_timeout = 10000;
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);

  // Tabelas complementares
  db.exec(`
    CREATE TABLE IF NOT EXISTS estoque_saldos (
      id_nissi TEXT PRIMARY KEY,
      saldo_atual INTEGER DEFAULT 10,
      estoque_minimo INTEGER DEFAULT 5,
      ultimo_custo REAL DEFAULT 0.0,
      atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (id_nissi) REFERENCES distribuidor (id_nissi) ON DELETE CASCADE
    );

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

    CREATE TABLE IF NOT EXISTS ml_config (
      chave TEXT PRIMARY KEY,
      valor TEXT,
      atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ml_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evento TEXT NOT NULL,
      detalhes TEXT,
      ip_origem TEXT,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const countRow = db.prepare("SELECT COUNT(*) as count FROM estoque_saldos").get();
  if (countRow.count === 0) {
    db.exec(`
      INSERT OR IGNORE INTO estoque_saldos (id_nissi, saldo_atual, estoque_minimo)
      SELECT id_nissi, 15, 5 FROM distribuidor;
    `);
  }

  // Migração de Criptografia Automática para Campos Sensíveis
  const sensitiveKeys = ['ml_app_id', 'ml_secret_key', 'ml_seller_id', 'ml_access_token', 'ml_refresh_token'];
  const rows = db.prepare("SELECT chave, valor FROM ml_config").all();
  const updateStmt = db.prepare("UPDATE ml_config SET valor = ?, atualizado_em = CURRENT_TIMESTAMP WHERE chave = ?");
  for (const r of rows) {
    if (sensitiveKeys.includes(r.chave) && r.valor && !r.valor.startsWith(ENC_PREFIX)) {
      updateStmt.run(encryptField(r.valor), r.chave);
    }
  }

  console.log('[Dfast Online] Banco SQLite inicializado e campos sensíveis protegidos com AES-256-GCM.');
} catch (err) {
  console.error('[Dfast Online] Erro ao abrir SQLite:', err.message);
}

function logSecurityEvent(event, details, ip = '127.0.0.1') {
  try {
    if (db) {
      db.prepare("INSERT INTO ml_audit_log (evento, detalhes, ip_origem) VALUES (?, ?, ?)").run(event, details, ip);
    }
  } catch (e) {
    // Silencioso para não interromper fluxo
  }
}

// MIME types para arquivos estáticos
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-API-Key',
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-API-Key',
    });
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = parsedUrl.pathname;

  // Leitura do Body em POST/PUT
  let body = {};
  if (['POST', 'PUT'].includes(req.method)) {
    try {
      const buffers = [];
      for await (const chunk of req) {
        buffers.push(chunk);
      }
      const rawText = Buffer.concat(buffers).toString();
      if (rawText) {
        body = JSON.parse(rawText);
      }
    } catch (e) {
      body = {};
    }
  }

  // ==========================================
  // ROTAS DA API
  // ==========================================

  // 1. /api/stats
  if (pathname === '/api/stats' && req.method === 'GET') {
    try {
      const totalAnuncios = db.prepare("SELECT COUNT(*) as c FROM anuncios").get().c;
      const totalComponentes = db.prepare("SELECT COUNT(*) as c FROM distribuidor").get().c;
      const totalPedidos = db.prepare("SELECT COUNT(*) as c FROM pedidos_vendas").get().c;
      const pedidosPendentes = db.prepare(`
        SELECT COUNT(*) as c 
        FROM pedidos_vendas p
        LEFT JOIN anuncios a ON p.ml_item_id = a.id_ml
        WHERE p.status_picking = 'pendente' AND (a.kit IS NULL OR a.kit = 'S')
      `).get().c;
      const pedidosSeparados = db.prepare("SELECT COUNT(*) as c FROM pedidos_vendas WHERE status_picking = 'separado'").get().c;
      const pedidosFlex = db.prepare(`
        SELECT COUNT(*) as c 
        FROM pedidos_vendas p
        LEFT JOIN anuncios a ON p.ml_item_id = a.id_ml
        WHERE p.envio_tipo = 'flex' AND p.status_picking = 'pendente' AND (a.kit IS NULL OR a.kit = 'S')
      `).get().c;
      const estoqueBaixo = db.prepare("SELECT COUNT(*) as c FROM estoque_saldos s WHERE s.saldo_atual <= s.estoque_minimo").get().c;
      const anunciosSemCadastro = db.prepare(`
        SELECT COUNT(DISTINCT p.ml_item_id) as c
        FROM pedidos_vendas p
        LEFT JOIN anuncios a ON p.ml_item_id = a.id_ml
        WHERE a.id_ml IS NULL
      `).get().c;
      const pedidosProducaoLocal = db.prepare(`
        SELECT COUNT(*) as c
        FROM pedidos_vendas p
        JOIN anuncios a ON p.ml_item_id = a.id_ml
        WHERE a.kit = 'N'
      `).get().c;

      return sendJson(res, 200, {
        success: true,
        stats: {
          total_anuncios: totalAnuncios,
          total_componentes: totalComponentes,
          total_pedidos: totalPedidos,
          pedidos_pendentes: pedidosPendentes,
          pedidos_separados: pedidosSeparados,
          pedidos_flex_hoje: pedidosFlex,
          itens_estoque_baixo: estoqueBaixo,
          anuncios_sem_cadastro: anunciosSemCadastro,
          pedidos_producao_local: pedidosProducaoLocal,
        }
      });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 2. /api/picking (Separação com suporte a filtro de origem)
  if (pathname === '/api/picking' && req.method === 'GET') {
    try {
      const tipo = parsedUrl.searchParams.get('tipo') || 'nissi'; // 'nissi' (padrão: almoxarifado), 'producao', 'todos'

      let sqlWhere = '';
      if (tipo === 'nissi') {
        sqlWhere = "WHERE (a.kit = 'S' OR a.id_ml IS NULL)";
      } else if (tipo === 'producao') {
        sqlWhere = "WHERE a.kit = 'N'";
      }

      const pedidos = db.prepare(`
        SELECT p.*, a.kit, a.caixa, (a.id_ml IS NOT NULL) as cadastrado
        FROM pedidos_vendas p
        LEFT JOIN anuncios a ON p.ml_item_id = a.id_ml
        ${sqlWhere}
        ORDER BY 
          CASE WHEN p.envio_tipo = 'flex' THEN 0 ELSE 1 END,
          p.status_picking ASC,
          p.id ASC
      `).all();

      const stmtComponents = db.prepare(`
        SELECT 
          k.id_kit_nissi,
          (k.qtd_kit * ?) as qtd_necessaria,
          d.descricao,
          d.unidade_medida,
          COALESCE(d.local, 'S/L') as local,
          COALESCE(s.saldo_atual, 0) as saldo_atual
        FROM kits_anuncio k
        JOIN distribuidor d ON k.id_kit_nissi = d.id_nissi
        LEFT JOIN estoque_saldos s ON d.id_nissi = s.id_nissi
        WHERE k.id_ml_anuncio = ?
        ORDER BY d.local ASC
      `);

      for (const ped of pedidos) {
        ped.componentes = stmtComponents.all(ped.quantidade, ped.ml_item_id);
      }

      const rotaConsolidada = db.prepare(`
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
      `).all();

      const caixasNecessarias = db.prepare(`
        SELECT 
          COALESCE(a.caixa, 'Indefinida') as numero_caixa,
          SUM(p.quantidade) as total_caixas
        FROM pedidos_vendas p
        LEFT JOIN anuncios a ON p.ml_item_id = a.id_ml
        WHERE p.status_picking = 'pendente'
        GROUP BY a.caixa
        ORDER BY a.caixa ASC
      `).all();

      const countNissi = db.prepare(`
        SELECT COUNT(*) as c FROM pedidos_vendas p
        LEFT JOIN anuncios a ON p.ml_item_id = a.id_ml
        WHERE (a.kit = 'S' OR a.id_ml IS NULL)
      `).get().c;

      const countProducao = db.prepare(`
        SELECT COUNT(*) as c FROM pedidos_vendas p
        JOIN anuncios a ON p.ml_item_id = a.id_ml
        WHERE a.kit = 'N'
      `).get().c;

      const countTodos = db.prepare("SELECT COUNT(*) as c FROM pedidos_vendas").get().c;

      return sendJson(res, 200, {
        success: true,
        pedidos,
        rota_consolidada: rotaConsolidada,
        caixas_necessarias: caixasNecessarias,
        counts: {
          nissi: countNissi,
          producao: countProducao,
          todos: countTodos
        }
      });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 3. /api/picking/toggle
  if (pathname === '/api/picking/toggle' && req.method === 'POST') {
    try {
      const orderId = body.order_id;
      if (!orderId) {
        return sendJson(res, 400, { error: 'order_id é obrigatório' });
      }

      const current = db.prepare("SELECT status_picking FROM pedidos_vendas WHERE order_id = ?").get(orderId);
      if (!current) {
        return sendJson(res, 404, { error: 'Pedido não encontrado' });
      }

      const newStatus = current.status_picking === 'separado' ? 'pendente' : 'separado';
      const separadoEm = newStatus === 'separado' ? new Date().toISOString() : null;

      db.prepare("UPDATE pedidos_vendas SET status_picking = ?, separado_em = ? WHERE order_id = ?").run(newStatus, separadoEm, orderId);

      return sendJson(res, 200, {
        success: true,
        order_id: orderId,
        new_status: newStatus,
        message: `Pedido ${orderId} marcado como ${newStatus}!`
      });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 4. /api/stock
  if (pathname === '/api/stock' && req.method === 'GET') {
    try {
      const search = parsedUrl.searchParams.get('search') || '';
      const localFilter = parsedUrl.searchParams.get('local') || '';

      let query = `
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
      `;
      const params = [];

      if (search) {
        query += " AND (d.id_nissi LIKE ? OR d.descricao LIKE ?)";
        params.push(`%${search}%`, `%${search}%`);
      }
      if (localFilter) {
        query += " AND COALESCE(d.local, 'S/L') LIKE ?";
        params.push(`%${localFilter}%`);
      }

      query += " ORDER BY COALESCE(d.local, 'S/L') ASC, d.id_nissi ASC LIMIT 500";
      const items = db.prepare(query).all(...params);

      // Summary metrics for Stock KPIs
      const totalItems = db.prepare("SELECT COUNT(*) as c FROM distribuidor").get().c;
      const totalUnits = db.prepare("SELECT COALESCE(SUM(saldo_atual), 0) as s FROM estoque_saldos").get().s;
      const lowStockCount = db.prepare(`
        SELECT COUNT(*) as c 
        FROM distribuidor d 
        LEFT JOIN estoque_saldos s ON d.id_nissi = s.id_nissi 
        WHERE COALESCE(s.saldo_atual, 0) <= COALESCE(s.estoque_minimo, 5)
      `).get().c;
      const unassignedLocalCount = db.prepare(`
        SELECT COUNT(*) as c 
        FROM distribuidor 
        WHERE local IS NULL OR local = '' OR local = 'S/L'
      `).get().c;

      return sendJson(res, 200, { 
        success: true, 
        stock: items,
        metrics: {
          total_items: totalItems,
          total_units: totalUnits,
          low_stock_count: lowStockCount,
          unassigned_local_count: unassignedLocalCount
        }
      });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 5.1 /api/stock/create (Cadastrar Novo Item no Catálogo Nissi)
  if (pathname === '/api/stock/create' && req.method === 'POST') {
    try {
      const { id_nissi, descricao, unidade_medida, local, saldo_atual, estoque_minimo } = body;
      if (!id_nissi || !String(id_nissi).trim()) {
        return sendJson(res, 400, { error: 'Código Nissi é obrigatório' });
      }
      const cleanId = String(id_nissi).trim().toUpperCase();
      const cleanDesc = String(descricao || '').trim();
      if (!cleanDesc) {
        return sendJson(res, 400, { error: 'Descrição da peça é obrigatória' });
      }
      const cleanUnidade = (String(unidade_medida || '').trim().toUpperCase() === 'PAR') ? 'PAR' : 'UNIDADE';
      const cleanLocal = String(local || 'S/L').trim().toUpperCase();
      const saldo = Math.max(0, parseInt(saldo_atual ?? 0, 10) || 0);
      const minimo = Math.max(0, parseInt(estoque_minimo ?? 5, 10) || 5);

      const existing = db.prepare("SELECT id_nissi FROM distribuidor WHERE id_nissi = ?").get(cleanId);
      if (existing) {
        return sendJson(res, 409, { error: `O código Nissi "${cleanId}" já está cadastrado no sistema.` });
      }

      db.exec('BEGIN TRANSACTION');
      try {
        db.prepare(`
          INSERT INTO distribuidor (id_nissi, descricao, unidade_medida, local)
          VALUES (?, ?, ?, ?)
        `).run(cleanId, cleanDesc, cleanUnidade, cleanLocal);

        db.prepare(`
          INSERT INTO estoque_saldos (id_nissi, saldo_atual, estoque_minimo, atualizado_em)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `).run(cleanId, saldo, minimo);

        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }

      logSecurityEvent('STOCK_ITEM_CREATED', `Item ${cleanId} cadastrado no estoque: "${cleanDesc}", Local: ${cleanLocal}, Saldo: ${saldo}.`, req.socket.remoteAddress);

      return sendJson(res, 201, {
        success: true,
        message: `Item ${cleanId} criado com sucesso no catálogo!`
      });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 5.2 /api/stock/update (Atualizar Item Completo ou Saldo/Local)
  if (pathname === '/api/stock/update' && req.method === 'POST') {
    try {
      const { id_nissi, descricao, unidade_medida, saldo_atual, estoque_minimo, local } = body;
      if (!id_nissi) {
        return sendJson(res, 400, { error: 'id_nissi é obrigatório' });
      }
      const cleanId = String(id_nissi).trim();

      db.exec('BEGIN TRANSACTION');
      try {
        if (descricao !== undefined || unidade_medida !== undefined || local !== undefined) {
          const current = db.prepare("SELECT descricao, unidade_medida, local FROM distribuidor WHERE id_nissi = ?").get(cleanId);
          if (!current) {
            db.exec('ROLLBACK');
            return sendJson(res, 404, { error: `Item ${cleanId} não encontrado no catálogo` });
          }

          const newDesc = descricao !== undefined ? String(descricao).trim() : current.descricao;
          const newUnidade = unidade_medida !== undefined 
            ? ((String(unidade_medida).trim().toUpperCase() === 'PAR') ? 'PAR' : 'UNIDADE')
            : current.unidade_medida;
          const newLocal = local !== undefined ? String(local).trim().toUpperCase() : current.local;

          db.prepare("UPDATE distribuidor SET descricao = ?, unidade_medida = ?, local = ? WHERE id_nissi = ?")
            .run(newDesc, newUnidade, newLocal, cleanId);
        }

        if (saldo_atual !== undefined || estoque_minimo !== undefined) {
          const saldo = saldo_atual !== undefined ? Math.max(0, parseInt(saldo_atual, 10) || 0) : null;
          const minimo = estoque_minimo !== undefined ? Math.max(0, parseInt(estoque_minimo, 10) || 0) : null;

          db.prepare(`
            INSERT INTO estoque_saldos (id_nissi, saldo_atual, estoque_minimo, atualizado_em)
            VALUES (?, COALESCE(?, 10), COALESCE(?, 5), CURRENT_TIMESTAMP)
            ON CONFLICT(id_nissi) DO UPDATE SET
              saldo_atual = COALESCE(?, estoque_saldos.saldo_atual),
              estoque_minimo = COALESCE(?, estoque_saldos.estoque_minimo),
              atualizado_em = CURRENT_TIMESTAMP
          `).run(cleanId, saldo, minimo, saldo, minimo);
        }

        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }

      logSecurityEvent('STOCK_ITEM_UPDATED', `Item ${cleanId} atualizado no estoque.`, req.socket.remoteAddress);

      return sendJson(res, 200, { success: true, message: `Item ${cleanId} atualizado com sucesso!` });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 5.3 /api/stock/adjust (Ajuste Rápido de Saldo +1 / -1 / +X / -X)
  if (pathname === '/api/stock/adjust' && req.method === 'POST') {
    try {
      const { id_nissi, delta, motivo } = body;
      if (!id_nissi) {
        return sendJson(res, 400, { error: 'id_nissi é obrigatório' });
      }
      const numDelta = parseInt(delta, 10);
      if (isNaN(numDelta) || numDelta === 0) {
        return sendJson(res, 400, { error: 'delta numérico é obrigatório e diferente de zero' });
      }

      const cleanId = String(id_nissi).trim();

      db.exec('BEGIN TRANSACTION');
      let novoSaldo = 0;
      try {
        const current = db.prepare("SELECT COALESCE(saldo_atual, 0) as s FROM estoque_saldos WHERE id_nissi = ?").get(cleanId);
        const currentSaldo = current ? current.s : 0;
        novoSaldo = Math.max(0, currentSaldo + numDelta);

        db.prepare(`
          INSERT INTO estoque_saldos (id_nissi, saldo_atual, estoque_minimo, atualizado_em)
          VALUES (?, ?, 5, CURRENT_TIMESTAMP)
          ON CONFLICT(id_nissi) DO UPDATE SET
            saldo_atual = ?,
            atualizado_em = CURRENT_TIMESTAMP
        `).run(cleanId, novoSaldo, novoSaldo);

        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }

      logSecurityEvent('STOCK_ADJUSTMENT', `Ajuste rápido de estoque no item ${cleanId}: delta ${numDelta > 0 ? '+' : ''}${numDelta}, novo saldo: ${novoSaldo}. Motivo: ${motivo || 'Contagem Manual'}`, req.socket.remoteAddress);

      return sendJson(res, 200, {
        success: true,
        id_nissi: cleanId,
        saldo_atual: novoSaldo,
        message: `Saldo de ${cleanId} ajustado para ${novoSaldo} un!`
      });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 5.4 /api/stock/delete (Excluir Item do Catálogo com Proteção de Vínculos)
  if (pathname === '/api/stock/delete' && req.method === 'POST') {
    try {
      const { id_nissi, force } = body;
      if (!id_nissi) {
        return sendJson(res, 400, { error: 'id_nissi é obrigatório' });
      }
      const cleanId = String(id_nissi).trim();

      const linkedAds = db.prepare(`
        SELECT k.id_ml_anuncio, a.caixa
        FROM kits_anuncio k
        LEFT JOIN anuncios a ON k.id_ml_anuncio = a.id_ml
        WHERE k.id_kit_nissi = ?
      `).all(cleanId);

      if (linkedAds.length > 0 && !force) {
        return sendJson(res, 200, {
          success: false,
          requires_confirmation: true,
          linked_count: linkedAds.length,
          linked_ads: linkedAds.map(a => a.id_ml_anuncio),
          warning: `O item ${cleanId} está vinculado a ${linkedAds.length} anúncio(s) do Mercado Livre. Confirmar a exclusão irá desvincular a peça de todos eles.`
        });
      }

      db.exec('BEGIN TRANSACTION');
      try {
        db.prepare("DELETE FROM kits_anuncio WHERE id_kit_nissi = ?").run(cleanId);
        db.prepare("DELETE FROM estoque_saldos WHERE id_nissi = ?").run(cleanId);
        db.prepare("DELETE FROM distribuidor WHERE id_nissi = ?").run(cleanId);
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }

      logSecurityEvent('STOCK_ITEM_DELETED', `Item ${cleanId} excluído do catálogo (Vínculos desfeitos: ${linkedAds.length}).`, req.socket.remoteAddress);

      return sendJson(res, 200, {
        success: true,
        message: `Item ${cleanId} excluído com sucesso do catálogo!`
      });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 6. /api/purchases
  if (pathname === '/api/purchases' && req.method === 'GET') {
    try {
      const sql = `
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
      `;
      const purchases = db.prepare(sql).all();

      return sendJson(res, 200, {
        success: true,
        distribuidor: 'Distribuidor Nissi',
        data_geracao: new Date().toLocaleString('pt-BR'),
        total_itens: purchases.length,
        itens: purchases,
      });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 6.1 /api/anuncios/unregistered (Anúncios do ML Vendidos sem Cadastro no Banco)
  if (pathname === '/api/anuncios/unregistered' && req.method === 'GET') {
    try {
      const sql = `
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
      `;
      const unregistered = db.prepare(sql).all();
      return sendJson(res, 200, { success: true, count: unregistered.length, unregistered });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 6.2 /api/anuncios/cadastrar (Cadastrar Caixa e Componentes Nissi do Anúncio)
  if (pathname === '/api/anuncios/cadastrar' && req.method === 'POST') {
    try {
      const { id_ml, caixa, kit, componentes } = body;
      if (!id_ml) {
        return sendJson(res, 400, { error: 'id_ml é obrigatório' });
      }
      const cleanIdMl = String(id_ml).replace(/[^0-9]/g, '');
      const cleanCaixa = String(caixa || '1').replace(/[^a-zA-Z0-9_\-\s]/g, '').trim();
      const cleanKit = kit === 'N' ? 'N' : 'S';

      if (cleanKit === 'S' && (!Array.isArray(componentes) || componentes.length === 0)) {
        return sendJson(res, 400, { error: 'Para anúncios com peças do distribuidor (Kit S), adicione pelo menos 1 componente Nissi.' });
      }

      db.exec('BEGIN TRANSACTION');
      try {
        db.prepare(`
          INSERT INTO anuncios (id_ml, kit, caixa)
          VALUES (?, ?, ?)
          ON CONFLICT(id_ml) DO UPDATE SET
            kit = excluded.kit,
            caixa = excluded.caixa
        `).run(cleanIdMl, cleanKit, cleanCaixa);

        db.prepare("DELETE FROM kits_anuncio WHERE id_ml_anuncio = ?").run(cleanIdMl);

        if (cleanKit === 'S' && Array.isArray(componentes) && componentes.length > 0) {
          const stmtComp = db.prepare("INSERT INTO kits_anuncio (id_ml_anuncio, id_kit_nissi, qtd_kit) VALUES (?, ?, ?)");
          for (const c of componentes) {
            if (c.id_kit_nissi) {
              const cleanIdNissi = String(c.id_kit_nissi).trim();
              const qtd = Math.max(1, parseInt(c.qtd_kit || 1, 10));
              stmtComp.run(cleanIdMl, cleanIdNissi, qtd);
            }
          }
        }

        if (cleanKit === 'N') {
          // Anúncios sem kit são de produção local e não precisam de separação no almoxarifado
          db.prepare(`
            UPDATE pedidos_vendas 
            SET status_picking = 'separado', separado_em = CURRENT_TIMESTAMP 
            WHERE ml_item_id = ? AND status_picking = 'pendente'
          `).run(cleanIdMl);
        }

        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }

      const tipoDesc = cleanKit === 'N' ? 'Sem Kit (Produção Local)' : `Com Kit (${componentes ? componentes.length : 0} peças Nissi)`;
      logSecurityEvent('ANUNCIO_CADASTRADO', `Anúncio MLB-${cleanIdMl} cadastrado: Caixa ${cleanCaixa}, Tipo ${tipoDesc}.`, req.socket.remoteAddress);

      return sendJson(res, 200, {
        success: true,
        message: `Anúncio MLB-${cleanIdMl} cadastrado com sucesso (${cleanKit === 'N' ? 'Produção Local' : 'Com Kit Nissi'})!`
      });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 7. /api/mercadolivre/config (Credenciais com Criptografia AES-256-GCM)
  if (pathname === '/api/mercadolivre/config') {
    if (req.method === 'GET') {
      const rows = db.prepare("SELECT chave, valor FROM ml_config").all();
      const configs = {};
      rows.forEach(r => { configs[r.chave] = r.valor; });

      const appId = decryptField(configs['ml_app_id']) || process.env.ML_APP_ID || '';
      const secret = decryptField(configs['ml_secret_key']) || process.env.ML_SECRET_KEY || '';
      const sellerId = decryptField(configs['ml_seller_id']) || process.env.ML_SELLER_ID || '';
      const accessToken = decryptField(configs['ml_access_token']) || process.env.ML_ACCESS_TOKEN || '';
      const refreshToken = decryptField(configs['ml_refresh_token']) || process.env.ML_REFRESH_TOKEN || '';

      return sendJson(res, 200, {
        success: true,
        config: {
          app_id: appId,
          has_secret: !!secret,
          seller_id: sellerId,
          has_access_token: !!accessToken,
          has_refresh_token: !!refreshToken,
          connected: !!accessToken,
          encryption: 'AES-256-GCM (AEAD Autenticado)',
          token_expires_at: configs['ml_token_expires_at'] ? parseInt(configs['ml_token_expires_at'], 10) : null,
          flex_cutoff: configs['flex_cutoff_hour'] || process.env.FLEX_CUTOFF_HOUR || '14:00',
          coleta_cutoff: configs['coleta_cutoff_hour'] || process.env.COLETA_CUTOFF_HOUR || '16:00',
        }
      });
    }

    if (req.method === 'POST') {
      const stmt = db.prepare("INSERT OR REPLACE INTO ml_config (chave, valor, atualizado_em) VALUES (?, ?, CURRENT_TIMESTAMP)");
      if (body.app_id) stmt.run('ml_app_id', encryptField(body.app_id.trim()));
      if (body.secret_key) stmt.run('ml_secret_key', encryptField(body.secret_key.trim()));
      if (body.seller_id) stmt.run('ml_seller_id', encryptField(body.seller_id.trim()));
      if (body.access_token) stmt.run('ml_access_token', encryptField(body.access_token.trim()));
      if (body.refresh_token) stmt.run('ml_refresh_token', encryptField(body.refresh_token.trim()));
      if (body.flex_cutoff) stmt.run('flex_cutoff_hour', body.flex_cutoff.trim());
      if (body.coleta_cutoff) stmt.run('coleta_cutoff_hour', body.coleta_cutoff.trim());

      return sendJson(res, 200, {
        success: true,
        message: 'Credenciais criptografadas com AES-256-GCM e salvas no banco com sucesso!'
      });
    }
  }

  // 7.1 /api/mercadolivre/auth-url (OAuth 2.0 com State Anti-CSRF)
  if (pathname === '/api/mercadolivre/auth-url' && req.method === 'GET') {
    try {
      const rows = db.prepare("SELECT chave, valor FROM ml_config").all();
      const configs = {};
      rows.forEach(r => { configs[r.chave] = r.valor; });
      const appId = decryptField(configs['ml_app_id']) || process.env.ML_APP_ID || '';
      const redirectUri = configs['ml_redirect_uri'] || process.env.ML_REDIRECT_URI || `http://localhost:${PORT}/api/mercadolivre/callback`;

      if (!appId || appId === '12345678901234') {
        return sendJson(res, 400, { error: 'Por favor, informe seu App ID (Client ID) oficial do Mercado Livre no painel "Trocar Seller" antes de conectar via OAuth.' });
      }

      const state = crypto.randomBytes(16).toString('hex');
      db.prepare("INSERT OR REPLACE INTO ml_config (chave, valor, atualizado_em) VALUES ('ml_oauth_state', ?, CURRENT_TIMESTAMP)").run(state);
      logSecurityEvent('OAUTH_AUTH_URL_GENERATED', `State CSRF gerado: ${state}`, req.socket.remoteAddress);

      const encodedUri = encodeURIComponent(redirectUri);
      const authUrl = `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${appId}&redirect_uri=${encodedUri}&state=${state}`;

      return sendJson(res, 200, { success: true, auth_url: authUrl });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 7.2 /api/mercadolivre/callback (Callback OAuth com Validação de State)
  if (pathname === '/api/mercadolivre/callback') {
    try {
      const code = parsedUrl.searchParams.get('code') || body.code || '';
      const state = parsedUrl.searchParams.get('state') || body.state || '';

      if (!code) {
        return sendJson(res, 400, { error: 'Código de autorização não informado.' });
      }

      const storedRow = db.prepare("SELECT valor FROM ml_config WHERE chave = 'ml_oauth_state'").get();
      const storedState = storedRow ? storedRow.valor : '';

      if (!storedState || storedState !== state) {
        logSecurityEvent('OAUTH_CSRF_VALIDATION_FAILED', 'State recebido não coincide com o gerado.', req.socket.remoteAddress);
        return sendJson(res, 403, { error: 'Falha de segurança: parâmetro state inválido ou expirado (Prevenção contra CSRF).' });
      }

      // Consumir state
      db.prepare("DELETE FROM ml_config WHERE chave = 'ml_oauth_state'").run();
      logSecurityEvent('OAUTH_CSRF_VALIDATION_SUCCESS', 'State CSRF validado com sucesso.', req.socket.remoteAddress);

      const rows = db.prepare("SELECT chave, valor FROM ml_config").all();
      const configs = {};
      rows.forEach(r => { configs[r.chave] = r.valor; });
      const appId = decryptField(configs['ml_app_id']) || process.env.ML_APP_ID || '';
      const secret = decryptField(configs['ml_secret_key']) || process.env.ML_SECRET_KEY || '';
      const redirectUri = configs['ml_redirect_uri'] || process.env.ML_REDIRECT_URI || `http://localhost:${PORT}/api/mercadolivre/callback`;

      // Trocar code por tokens
      const tokenRes = await fetch('https://api.mercadolibre.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': `DfastOnline-WMS/1.0 (AppId: ${appId || 'Pending'}; Local-Dev)`
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: appId,
          client_secret: secret,
          code: code,
          redirect_uri: redirectUri
        })
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || tokenData.error) {
        logSecurityEvent('OAUTH_TOKEN_EXCHANGE_FAILED', JSON.stringify(tokenData), req.socket.remoteAddress);
        return sendJson(res, tokenRes.status || 400, tokenData);
      }

      const stmt = db.prepare("INSERT OR REPLACE INTO ml_config (chave, valor, atualizado_em) VALUES (?, ?, CURRENT_TIMESTAMP)");
      if (tokenData.access_token) stmt.run('ml_access_token', encryptField(tokenData.access_token));
      if (tokenData.refresh_token) stmt.run('ml_refresh_token', encryptField(tokenData.refresh_token));
      if (tokenData.user_id) stmt.run('ml_seller_id', encryptField(String(tokenData.user_id)));
      const expiresIn = tokenData.expires_in || 21600;
      stmt.run('ml_token_expires_at', String(Math.floor(Date.now() / 1000) + expiresIn));

      logSecurityEvent('OAUTH_TOKEN_EXCHANGED', 'Tokens gerados e salvos com AES-256-GCM.', req.socket.remoteAddress);

      if (req.method === 'GET') {
        res.writeHead(302, { Location: '/?ml_auth=success' });
        res.end();
        return;
      }

      return sendJson(res, 200, {
        success: true,
        message: 'Conta do Mercado Livre vinculada com sucesso! Tokens armazenados com criptografia AES-256-GCM.'
      });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 7.3 /api/mercadolivre/refresh (Renovação Manual / Preventiva de Token)
  if (pathname === '/api/mercadolivre/refresh' && req.method === 'POST') {
    try {
      const rows = db.prepare("SELECT chave, valor FROM ml_config").all();
      const configs = {};
      rows.forEach(r => { configs[r.chave] = r.valor; });
      const appId = decryptField(configs['ml_app_id']) || process.env.ML_APP_ID || '';
      const secret = decryptField(configs['ml_secret_key']) || process.env.ML_SECRET_KEY || '';
      const refreshToken = decryptField(configs['ml_refresh_token']) || process.env.ML_REFRESH_TOKEN || '';

      if (!refreshToken) {
        return sendJson(res, 400, { error: 'Nenhum refresh token cadastrado ou ativo.' });
      }

      const tokenRes = await fetch('https://api.mercadolibre.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': `DfastOnline-WMS/1.0 (AppId: ${appId || 'Pending'}; Local-Dev)`
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: appId,
          client_secret: secret,
          refresh_token: refreshToken
        })
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || tokenData.error) {
        logSecurityEvent('TOKEN_AUTO_REFRESH_FAILED', JSON.stringify(tokenData), req.socket.remoteAddress);
        return sendJson(res, tokenRes.status || 400, tokenData);
      }

      const stmt = db.prepare("INSERT OR REPLACE INTO ml_config (chave, valor, atualizado_em) VALUES (?, ?, CURRENT_TIMESTAMP)");
      if (tokenData.access_token) stmt.run('ml_access_token', encryptField(tokenData.access_token));
      if (tokenData.refresh_token) stmt.run('ml_refresh_token', encryptField(tokenData.refresh_token));
      const expiresIn = tokenData.expires_in || 21600;
      stmt.run('ml_token_expires_at', String(Math.floor(Date.now() / 1000) + expiresIn));

      logSecurityEvent('TOKEN_AUTO_REFRESH_SUCCESS', 'Access Token renovado com sucesso.', req.socket.remoteAddress);

      return sendJson(res, 200, {
        success: true,
        message: 'Tokens de acesso do Mercado Livre renovados com sucesso!'
      });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 7.4 /api/mercadolivre/sync (Sincronização Real de Pedidos com ML)
  if (pathname === '/api/mercadolivre/sync' && req.method === 'POST') {
    try {
      const rows = db.prepare("SELECT chave, valor FROM ml_config").all();
      const configs = {};
      rows.forEach(r => { configs[r.chave] = r.valor; });
      const appId = decryptField(configs['ml_app_id']) || process.env.ML_APP_ID || '';
      let accessToken = decryptField(configs['ml_access_token']) || process.env.ML_ACCESS_TOKEN || '';
      const sellerId = decryptField(configs['ml_seller_id']) || process.env.ML_SELLER_ID || '34977269';
      const expiresAt = parseInt(configs['ml_token_expires_at'] || '0', 10);

      if (!accessToken) {
        return sendJson(res, 400, { error: 'Não autenticado no Mercado Livre ou token ausente. Configure suas credenciais em Configurações.' });
      }

      // Se expirar em menos de 10 minutos (600s), renova preventivamente
      if (expiresAt > 0 && (Math.floor(Date.now() / 1000) + 600 >= expiresAt)) {
        const secret = decryptField(configs['ml_secret_key']) || process.env.ML_SECRET_KEY || '';
        const refreshToken = decryptField(configs['ml_refresh_token']) || process.env.ML_REFRESH_TOKEN || '';
        if (refreshToken) {
          logSecurityEvent('TOKEN_PRE_EXPIRY_TRIGGERED', 'Token próximo de expirar. Disparando renovação automática.', req.socket.remoteAddress);
          const rRes = await fetch('https://api.mercadolibre.com/oauth/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': `DfastOnline-WMS/1.0 (AppId: ${appId || 'Pending'}; Local-Dev)`
            },
            body: new URLSearchParams({
              grant_type: 'refresh_token',
              client_id: appId,
              client_secret: secret,
              refresh_token: refreshToken
            })
          });
          const rData = await rRes.json();
          if (rData.access_token) {
            accessToken = rData.access_token;
            const stmt = db.prepare("INSERT OR REPLACE INTO ml_config (chave, valor, atualizado_em) VALUES (?, ?, CURRENT_TIMESTAMP)");
            stmt.run('ml_access_token', encryptField(rData.access_token));
            if (rData.refresh_token) stmt.run('ml_refresh_token', encryptField(rData.refresh_token));
            stmt.run('ml_token_expires_at', String(Math.floor(Date.now() / 1000) + (rData.expires_in || 21600)));
            logSecurityEvent('TOKEN_AUTO_REFRESH_SUCCESS', 'Token preventivamente renovado com sucesso.', req.socket.remoteAddress);
          }
        }
      }

      // Função com retry e exponential backoff para HTTP 429 e auto-refresh para HTTP 401
      async function fetchOrdersPage(offset) {
        let retries = 0;
        let backoffDelay = 1000;
        const pageUrl = `https://api.mercadolibre.com/orders/search?seller=${sellerId}&order.status=paid&tags.not=delivered,no_shipping&sort=date_desc&limit=50&offset=${offset}`;

        while (retries <= 3) {
          const orderRes = await fetch(pageUrl, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'User-Agent': `DfastOnline-WMS/1.0 (AppId: ${appId || 'Pending'}; Local-Dev)`,
              'Accept': 'application/json'
            }
          });

          // Se retornar 401, tenta auto-renovação e repete
          if (orderRes.status === 401) {
            const secret = decryptField(configs['ml_secret_key']) || process.env.ML_SECRET_KEY || '';
            const refreshToken = decryptField(configs['ml_refresh_token']) || process.env.ML_REFRESH_TOKEN || '';
            if (refreshToken && retries === 0) {
              retries++;
              logSecurityEvent('TOKEN_AUTO_REFRESH_ON_401', 'HTTP 401 interceptado. Renovando token via refresh_token.', req.socket.remoteAddress);
              const rRes = await fetch('https://api.mercadolibre.com/oauth/token', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                  'User-Agent': `DfastOnline-WMS/1.0 (AppId: ${appId || 'Pending'}; Local-Dev)`
                },
                body: new URLSearchParams({
                  grant_type: 'refresh_token',
                  client_id: appId,
                  client_secret: secret,
                  refresh_token: refreshToken
                })
              });
              const rData = await rRes.json();
              if (rData.access_token) {
                accessToken = rData.access_token;
                const stmt = db.prepare("INSERT OR REPLACE INTO ml_config (chave, valor, atualizado_em) VALUES (?, ?, CURRENT_TIMESTAMP)");
                stmt.run('ml_access_token', encryptField(rData.access_token));
                if (rData.refresh_token) stmt.run('ml_refresh_token', encryptField(rData.refresh_token));
                stmt.run('ml_token_expires_at', String(Math.floor(Date.now() / 1000) + (rData.expires_in || 21600)));
                continue;
              }
            }
          }

          if (orderRes.status === 429) {
            retries++;
            if (retries > 3) {
              logSecurityEvent('RATE_LIMIT_EXCEEDED', 'Limite de requisições do Mercado Livre excedido após 3 tentativas.', req.socket.remoteAddress);
              return { ok: false, status: 429, error: 'Limite de requisições da API do Mercado Livre atingido (HTTP 429).' };
            }
            logSecurityEvent('RATE_LIMIT_BACKOFF', `HTTP 429 detectado. Aguardando ${backoffDelay}ms antes da tentativa ${retries}...`, req.socket.remoteAddress);
            await new Promise(r => setTimeout(r, backoffDelay));
            backoffDelay *= 2;
            continue;
          }

          const data = await orderRes.json();
          if (!orderRes.ok) {
            return { ok: false, status: orderRes.status, data };
          }
          return { ok: true, data };
        }
        return { ok: false, status: 500, error: 'Falha de comunicação após múltiplas tentativas.' };
      }

      // Loop de Paginação Dinâmica (offset=0, 50, 100...) baseado em paging.total
      let offset = 0;
      let totalOrders = null;
      const allResults = [];
      const MAX_ORDERS = 2000;

      while (totalOrders === null || (offset < totalOrders && allResults.length < MAX_ORDERS)) {
        if (offset > 0) {
          await new Promise(r => setTimeout(r, 150)); // Micro-delay respeitando limites de requisição
        }

        const pageResult = await fetchOrdersPage(offset);
        if (!pageResult.ok) {
          if (offset === 0) {
            if (pageResult.status === 401) {
              logSecurityEvent('API_SYNC_UNAUTHORIZED', 'Requisição rejeitada pelo Mercado Livre (HTTP 401). Token ausente, inválido ou expirado.', req.socket.remoteAddress);
              return sendJson(res, 401, {
                error: 'Não autorizado (HTTP 401): As credenciais (Access Token ou App ID) gravadas no banco de dados são valores de exemplo ou expiraram. Clique em "Trocar Seller" para atualizar suas credenciais oficiais do Mercado Livre.'
              });
            }
            if (pageResult.status === 403 && (pageResult.data?.code === 'PA_UNAUTHORIZED_RESULT_FROM_POLICIES' || (pageResult.data?.message && pageResult.data?.message.includes('policy')))) {
              logSecurityEvent('API_SYNC_POLICY_AGENT_BLOCK', 'Permissão de Vendas/Envios pendente no DevCenter do Mercado Livre (PA_UNAUTHORIZED_RESULT_FROM_POLICIES).', req.socket.remoteAddress);
              return sendJson(res, 403, {
                error: 'Permissão de Vendas pendente (HTTP 403): O seu aplicativo no Mercado Livre Developers (App ID: ' + (appId || '1536131190806405') + ') foi autenticado com sucesso, mas precisa da permissão de "Vendas e Envios" (urn:ml:mktp:orders-shipments:/read-only) habilitada no DevCenter.'
              });
            }
            return sendJson(res, pageResult.status, { error: pageResult.data?.message || pageResult.error || 'Erro na API do Mercado Livre ao sincronizar pedidos reais.' });
          }
          // Se falhou em páginas posteriores, encerra a paginação com o lote já carregado
          break;
        }

        const pageData = pageResult.data;
        const pageItems = Array.isArray(pageData.results) ? pageData.results : [];
        if (pageItems.length === 0) {
          break;
        }

        allResults.push(...pageItems);

        if (totalOrders === null) {
          totalOrders = (pageData.paging && typeof pageData.paging.total === 'number')
            ? pageData.paging.total
            : pageItems.length;
        }

        offset += pageItems.length;
      }

      let savedCount = 0;
      const unregisteredMap = {};
      const shipmentCache = new Map();

      const stmtInsert = db.prepare(`
        INSERT OR REPLACE INTO pedidos_vendas 
        (order_id, ml_item_id, titulo, quantidade, comprador, data_venda, envio_tipo, envio_status, status_picking, separado_em)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'ready_to_ship', ?, ?)
      `);

      db.exec('BEGIN TRANSACTION');
      try {
        for (const order of allResults) {
          const orderId = String(order.id).replace(/[^0-9]/g, '');
          const shipping = order.shipping || {};
          const shippingId = String(shipping.id || '');
          let envioTipo = (shipping.shipping_mode && (shipping.shipping_mode.includes('self_service') || shipping.shipping_mode.includes('turbo'))) ? 'flex' : 'coleta';

          // Verificação de modalidade real de logística com cache por shipping_id
          if (shippingId) {
            if (shipmentCache.has(shippingId)) {
              envioTipo = shipmentCache.get(shippingId);
            } else {
              try {
                const shipRes = await fetch(`https://api.mercadolibre.com/shipments/${shippingId}`, {
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'User-Agent': `DfastOnline-WMS/1.0 (AppId: ${appId || 'Pending'}; Local-Dev)`
                  }
                });
                if (shipRes.ok) {
                  const shipData = await shipRes.json();
                  if (shipData.logistic_type === 'self_service' || (shipData.logistic_type && shipData.logistic_type.includes('turbo'))) {
                    envioTipo = 'flex';
                  } else {
                    envioTipo = 'coleta';
                  }
                  shipmentCache.set(shippingId, envioTipo);
                }
              } catch (e) {
                // mantém fallback seguro
              }
            }
          }

          const items = order.order_items || [];
          const firstName = (order.buyer && order.buyer.first_name) ? String(order.buyer.first_name).replace(/[^\p{L}\s]/gu, '') : '';
          const lastName = (order.buyer && order.buyer.last_name) ? String(order.buyer.last_name).replace(/[^\p{L}\s]/gu, '') : '';
          const buyerClean = `${firstName} ${lastName}`.trim() || 'Cliente Mercado Livre';
          const dateCreated = order.date_created || new Date().toISOString();

          for (const itemObj of items) {
            const mlItemId = String((itemObj.item && itemObj.item.id) || '').replace(/[^0-9]/g, '');
            const rawTitle = String((itemObj.item && itemObj.item.title) || 'Item ML').replace(/<[^>]*>?/gm, '');
            const titleClean = rawTitle.slice(0, 150);
            const quantity = Math.max(1, Math.min(1000, parseInt(itemObj.quantity || 1, 10)));

            // Identificar se o anúncio já está cadastrado como Produção Local (kit = 'N')
            const adCheck = db.prepare("SELECT kit FROM anuncios WHERE id_ml = ?").get(mlItemId);
            const initialStatus = (adCheck && adCheck.kit === 'N') ? 'separado' : 'pendente';
            const separadoEm = (initialStatus === 'separado') ? new Date().toISOString() : null;

            stmtInsert.run(
              orderId,
              mlItemId,
              titleClean,
              quantity,
              buyerClean.slice(0, 80),
              dateCreated,
              envioTipo,
              initialStatus,
              separadoEm
            );
            savedCount++;

            // Identificar se o anúncio do Mercado Livre não está cadastrado no banco
            const isRegistered = db.prepare("SELECT 1 FROM anuncios WHERE id_ml = ?").get(mlItemId);
            if (!isRegistered && !unregisteredMap[mlItemId]) {
              unregisteredMap[mlItemId] = {
                id_ml: mlItemId,
                titulo: titleClean,
                quantidade: quantity,
              };
            }
          }
        }
        db.exec('COMMIT');
      } catch (errDb) {
        db.exec('ROLLBACK');
        throw errDb;
      }

      const unregisteredList = Object.values(unregisteredMap);
      const totalPages = Math.ceil((totalOrders || allResults.length) / 50);

      logSecurityEvent(
        'ORDERS_SYNCED_SUCCESS',
        `Sincronização paginada em tempo real: ${allResults.length} pedidos oficiais analisados em ${totalPages} página(s), ${savedCount} itens processados e ${unregisteredList.length} anúncios sem cadastro identificados.`,
        req.socket.remoteAddress
      );

      return sendJson(res, 200, {
        success: true,
        orders_found: allResults.length,
        total_orders: totalOrders || allResults.length,
        total_pages: Math.max(1, totalPages),
        items_imported: savedCount,
        unregistered_count: unregisteredList.length,
        unregistered_items: unregisteredList,
        message: allResults.length > 0
          ? (unregisteredList.length > 0
              ? `Sincronização concluída! ${savedCount} itens importados (${totalPages} página(s)). ⚠️ Atenção: ${unregisteredList.length} anúncio(s) do Mercado Livre não possuem cadastro no banco de dados!`
              : `Sincronização concluída! ${savedCount} itens reais atualizados na lista de expedição (${totalPages} página(s) analisadas).`)
          : 'API Mercado Livre conectada com sucesso. Nenhum novo pedido pendente de expedição no momento.'
      });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 7.5 /api/mercadolivre/audit-logs (Trilha de Auditoria de Segurança)
  if (pathname === '/api/mercadolivre/audit-logs' && req.method === 'GET') {
    try {
      const logs = db.prepare("SELECT * FROM ml_audit_log ORDER BY id DESC LIMIT 50").all();
      return sendJson(res, 200, { success: true, total: logs.length, logs });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 9. /api/orders/reset
  if (pathname === '/api/orders/reset' && req.method === 'POST') {
    try {
      db.prepare("DELETE FROM pedidos_vendas").run();
      return sendJson(res, 200, { success: true, message: 'Fila de pedidos limpa com sucesso!' });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // ==========================================
  // SERVIR ARQUIVOS ESTÁTICOS DO FRONTEND
  // ==========================================
  let filePath = path.join(__dirname, 'frontend', 'dist', pathname === '/' ? 'index.html' : pathname);

  if (!fs.existsSync(filePath)) {
    // Fallback para SPA (Single Page Application)
    filePath = path.join(__dirname, 'frontend', 'dist', 'index.html');
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // Se o frontend ainda não foi compilado, exibe tela de boas-vindas do backend
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Dfast Online - API Ativa</title>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #1e293b; padding: 2.5rem; border-radius: 1rem; border: 1px solid #334155; max-width: 550px; text-align: center; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
          h1 { color: #38bdf8; margin-top: 0; }
          .badge { background: #0369a1; color: #e0f2fe; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.8rem; font-weight: bold; }
          p { color: #94a3b8; font-size: 0.95rem; line-height: 1.5; }
          code { background: #0f172a; padding: 0.2rem 0.5rem; border-radius: 0.25rem; color: #38bdf8; }
        </style>
      </head>
      <body>
        <div class="card">
          <span class="badge">API NATIVA OPERACIONAL</span>
          <h1>Dfast Online</h1>
          <p>Servidor do Sistema de Gestão de Estoque e Picking conectado com sucesso ao banco SQLite:</p>
          <p><code>${DB_PATH}</code></p>
          <p>Para abrir a interface web moderna, o frontend está sendo compilado.</p>
        </div>
      </body>
    </html>
  `);
});

server.listen(PORT, () => {
  console.log(`[Dfast Online] Servidor rodando em: http://localhost:${PORT}`);
});
