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
      const pedidosPendentes = db.prepare("SELECT COUNT(*) as c FROM pedidos_vendas WHERE status_picking = 'pendente'").get().c;
      const pedidosSeparados = db.prepare("SELECT COUNT(*) as c FROM pedidos_vendas WHERE status_picking = 'separado'").get().c;
      const pedidosFlex = db.prepare("SELECT COUNT(*) as c FROM pedidos_vendas WHERE envio_tipo = 'flex' AND status_picking = 'pendente'").get().c;
      const estoqueBaixo = db.prepare("SELECT COUNT(*) as c FROM estoque_saldos s WHERE s.saldo_atual <= s.estoque_minimo").get().c;

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
        }
      });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 2. /api/picking
  if (pathname === '/api/picking' && req.method === 'GET') {
    try {
      const pedidos = db.prepare(`
        SELECT p.*, a.kit, a.caixa
        FROM pedidos_vendas p
        LEFT JOIN anuncios a ON p.ml_item_id = a.id_ml
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
          d.local,
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

      return sendJson(res, 200, {
        success: true,
        pedidos,
        rota_consolidada: rotaConsolidada,
        caixas_necessarias: caixasNecessarias,
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
      `;
      const params = [];

      if (search) {
        query += " AND (d.id_nissi LIKE ? OR d.descricao LIKE ?)";
        params.push(`%${search}%`, `%${search}%`);
      }
      if (localFilter) {
        query += " AND d.local LIKE ?";
        params.push(`%${localFilter}%`);
      }

      query += " ORDER BY d.local ASC, d.id_nissi ASC LIMIT 300";
      const items = db.prepare(query).all(...params);

      return sendJson(res, 200, { success: true, stock: items });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 5. /api/stock/update
  if (pathname === '/api/stock/update' && req.method === 'POST') {
    try {
      const { id_nissi, saldo_atual, estoque_minimo, local } = body;
      if (!id_nissi) {
        return sendJson(res, 400, { error: 'id_nissi é obrigatório' });
      }

      if (saldo_atual !== undefined || estoque_minimo !== undefined) {
        db.prepare(`
          INSERT INTO estoque_saldos (id_nissi, saldo_atual, estoque_minimo, atualizado_em)
          VALUES (?, COALESCE(?, 10), COALESCE(?, 5), CURRENT_TIMESTAMP)
          ON CONFLICT(id_nissi) DO UPDATE SET
            saldo_atual = COALESCE(?, estoque_saldos.saldo_atual),
            estoque_minimo = COALESCE(?, estoque_saldos.estoque_minimo),
            atualizado_em = CURRENT_TIMESTAMP
        `).run(id_nissi, saldo_atual ?? 10, estoque_minimo ?? 5, saldo_atual ?? null, estoque_minimo ?? null);
      }

      if (local !== undefined) {
        db.prepare("UPDATE distribuidor SET local = ? WHERE id_nissi = ?").run(local.trim(), id_nissi);
      }

      return sendJson(res, 200, { success: true, message: `Item ${id_nissi} atualizado com sucesso!` });
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

  // 8. /api/mercadolivre/simulate (Gera vendas com base nos 767 anúncios reais do Danilo)
  if (pathname === '/api/mercadolivre/simulate' && req.method === 'POST') {
    try {
      const anuncios = db.prepare(`
        SELECT DISTINCT a.id_ml, a.kit, a.caixa
        FROM anuncios a
        JOIN kits_anuncio k ON a.id_ml = k.id_ml_anuncio
        ORDER BY RANDOM()
        LIMIT 8
      `).all();

      const nomes = [
        'Carlos Alberto Silva', 'Mariana Oliveira Souza', 'Roberto Ferreira Santos',
        'Juliana Costa Lima', 'Fernando Mendes Rocha', 'Patrícia Martins Ramos',
        'Lucas Henrique Dias', 'Amanda Ribeiro Duarte'
      ];

      const stmtInsert = db.prepare(`
        INSERT OR REPLACE INTO pedidos_vendas 
        (order_id, ml_item_id, titulo, quantidade, comprador, envio_tipo, envio_status, status_picking)
        VALUES (?, ?, ?, ?, ?, ?, 'ready_to_ship', 'pendente')
      `);

      const stmtDesc = db.prepare(`
        SELECT d.descricao FROM kits_anuncio k 
        JOIN distribuidor d ON k.id_kit_nissi = d.id_nissi 
        WHERE k.id_ml_anuncio = ? LIMIT 1
      `);

      let gerados = 0;
      anuncios.forEach((anuncio, idx) => {
        const descRow = stmtDesc.get(anuncio.id_ml);

        const descComponente = descRow ? descRow.descricao : 'Kit de Suspensão Automotiva';
        const orderId = '20000' + Math.floor(1000000 + Math.random() * 9000000);
        const tipoEnvio = idx % 2 === 0 ? 'flex' : 'coleta';
        const qtd = idx === 2 ? 2 : 1;

        stmtInsert.run(
          orderId,
          anuncio.id_ml,
          `MLB${anuncio.id_ml} - ${descComponente}`,
          qtd,
          nomes[idx % nomes.length],
          tipoEnvio
        );
        gerados++;
      });

      return sendJson(res, 200, {
        success: true,
        message: `${gerados} pedidos reais do Mercado Livre simulados com sucesso para expedição hoje!`,
        total_gerados: gerados,
      });
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
