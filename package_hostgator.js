// ================================================================
// DFAST ONLINE - GERADOR DE PACOTE DE DEPLOY PARA HOSTGATOR TURBO
// ================================================================

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const baseDir = __dirname;
const stagingDir = path.join(baseDir, 'dist_hostgator');
const zipFile = path.join(baseDir, 'dfast_online_hostgator.zip');

console.log('[Deploy HostGator] 1. Preparando pasta temporária...');
if (fs.existsSync(stagingDir)) {
  fs.rmSync(stagingDir, { recursive: true, force: true });
}
if (fs.existsSync(zipFile)) {
  fs.unlinkSync(zipFile);
}
fs.mkdirSync(stagingDir, { recursive: true });

console.log('[Deploy HostGator] 2. Recompilando o Frontend React (Vite) idêntico ao localhost...');
execSync('npm run build', { cwd: path.join(baseDir, 'frontend'), stdio: 'inherit' });

console.log('[Deploy HostGator] 3. Copiando arquivos do Frontend compilado (Vite)...');
const distDir = path.join(baseDir, 'frontend', 'dist');
fs.cpSync(distDir, stagingDir, { recursive: true });

console.log('[Deploy HostGator] 4. Copiando pasta da API (PHP)...');
const apiDir = path.join(baseDir, 'api');
const targetApiDir = path.join(stagingDir, 'api');
fs.cpSync(apiDir, targetApiDir, { recursive: true });

console.log('[Deploy HostGator] 4. Sincronizando WAL e copiando banco de dados SQLite oficial...');
const sourceDb = 'C:/Users/User/projetos/banco de dados Dfast/db_app.db';
const { DatabaseSync } = require('node:sqlite');
const dbSync = new DatabaseSync(sourceDb);
const checkpointRes = dbSync.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();
console.log('   -> WAL Checkpoint executado:', checkpointRes);
const tokenCheck = dbSync.prepare("SELECT chave, substr(valor, 1, 20) as v FROM ml_config WHERE chave IN ('ml_access_token', 'ml_refresh_token')").all();
console.log(`   -> Tokens ativos verificados no banco: ${tokenCheck.length} chaves encontradas.`);
dbSync.close();

const targetDbDir = path.join(targetApiDir, 'database');
fs.mkdirSync(targetDbDir, { recursive: true });
fs.copyFileSync(sourceDb, path.join(targetDbDir, 'db_app.db'));

console.log('[Deploy HostGator] 5. Copiando arquivo .htaccess de roteamento da raiz...');
fs.copyFileSync(path.join(baseDir, '.htaccess'), path.join(stagingDir, '.htaccess'));

console.log('[Deploy HostGator] 6. Gerando arquivo .env de produção...');
const envContent = `APP_ENV=production
APP_DEBUG=false
APP_ENCRYPTION_KEY=dfast_online_master_aes256_key_sec_2026_hostgator
DATABASE_PATH=api/database/db_app.db
`;
fs.writeFileSync(path.join(stagingDir, '.env'), envContent, 'utf8');

console.log('[Deploy HostGator] 7. Compactando em arquivo ZIP...');
// Compactar usando PowerShell nativo
const psCommand = `powershell -NoProfile -Command "Compress-Archive -Path '${stagingDir}\\*' -DestinationPath '${zipFile}' -Force"`;
execSync(psCommand, { stdio: 'inherit' });

const stats = fs.statSync(zipFile);
console.log(`[Deploy HostGator] ✅ Pacote gerado com sucesso!`);
console.log(`Arquivo: ${zipFile}`);
console.log(`Tamanho: ${(stats.size / 1024 / 1024).toFixed(2)} MB (${stats.size} bytes)`);
