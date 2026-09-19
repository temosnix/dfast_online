# 📦 Dfast Online - Gestão de Estoque, Picking & Mercado Livre

Sistema inteligente de **WMS (Warehouse Management System), Picking de Expedição Diária e Reposição de Estoque**, integrado com a **API do Mercado Livre** (Envios no mesmo dia / Flex / Coletas) e 100% compatível com a infraestrutura do **Plano Turbo da HostGator**.

---

## 🎯 Funcionalidades Principais

1. **Expedição & Picking no Mesmo Dia (Flex / Coleta)**:
   - Identificação automática de pedidos com envio prioritário (Flex).
   - **Cálculo da Rota Otimizada no Galpão**: organiza os itens por ordem física das prateleiras (`A01` ➔ `A13` ➔ `B19` ➔ `B26`), eliminando idas e vindas dos estoquistas.
   - **Resumo Inteligente de Caixas**: calcula exatamente quantas caixas de cada tamanho (Caixa 2, Caixa 3, Caixa 6, etc.) serão necessárias para embalar as vendas do dia com base no cadastro de anúncios.
   - Checklist interativo ("Item Separado") com barra de progresso.
   - **Impressão Térmica / A4**: botão de impressão com layout limpo e otimizado para pranchetas de separação.

2. **Gestão de Estoque & Localização Física**:
   - Conectado diretamente à base existente com **767 anúncios** e **264 peças cadastradas do Distribuidor Nissi**.
   - Consulta rápida por código do distribuidor, descrição da peça ou localização da gaveta.
   - Edição rápida de saldo físico, estoque mínimo de segurança e localização de estoque.

3. **Lista de Reposição & Compras (Distribuidor Nissi)**:
   - Geração automática da lista de pedidos de compra para peças em falta imediata (vendeu e não tem saldo) ou abaixo do estoque mínimo.
   - **Botão "Copiar para WhatsApp"**: formata a lista de compra pronta para envio direto ao vendedor do distribuidor.

4. **Integração com Mercado Livre**:
   - Conexão oficial via OAuth 2.0 (`/orders/search`).
   - Sincronização em tempo real das vendas do dia.
   - **Simulador Integrado**: permite gerar vendas de teste baseadas nos 767 anúncios reais para validar a operação antes de inserir as chaves de produção.

---

## 🛡️ Segurança e Privacidade (Crítico)

- **Credenciais e Banco de Dados Fora do Git**:
  - O arquivo `.env`, credenciais da API do Mercado Livre e arquivos de banco de dados (`*.db`, `*.sqlite`) estão estritamente listados no `.gitignore`.
  - O diretório `api/database/` possui proteção nativa `.htaccess` (`Require all denied`) para impedir qualquer download via navegador no servidor da HostGator.

---

## 🚀 Como Rodar Localmente (Windows)

O projeto possui um servidor integrado em Node.js (Node 24) que utiliza `node:sqlite` nativo, sem exigir nenhuma instalação de PHP na máquina local:

```bash
# 1. Instalar dependências do frontend
cd frontend
npm install
npm run build
cd ..

# 2. Iniciar o servidor local
npm start
```

Acesse no seu navegador: **[http://localhost:3001](http://localhost:3001)**

---

## 🌐 Como Publicar na HostGator (Plano Turbo cPanel)

O backend do Dfast Online foi construído em **PHP 8.2+ nativo com PDO SQLite**, exigindo **zero configurações de processos ou daemons** no cPanel da HostGator:

### Passo 1: Gerar o Pacote de Produção
No seu computador, o build do frontend já foi gerado em `frontend/dist/`.

### Passo 2: Enviar os Arquivos para o cPanel
1. Acesse o **cPanel da HostGator** e abra o **Gerenciador de Arquivos**.
2. Vá até a pasta do seu domínio (ex: `public_html` ou a pasta do seu domínio adicional).
3. Copie para lá:
   - Todo o conteúdo de `frontend/dist/` (`index.html`, pasta `assets/`).
   - A pasta `api/` (`index.php`, `db.php`, `mercadolivre.php`, `.htaccess`).
   - O arquivo `.htaccess` da raiz do projeto.
4. Faça o upload do seu arquivo de banco de dados SQLite (`db_app.db`) para uma pasta segura (ex: `api/database/db_app.db` ou fora da `public_html`).

### Passo 3: Configurar o Domínio no Registro.br
- Aponte os DNS do seu domínio no Registro.br para os nameservers da HostGator (`ns1.hostgator.com.br` e `ns2.hostgator.com.br`).
- O SSL (HTTPS) é ativado automaticamente pelo recurso **AutoSSL** da HostGator!

---

## 📁 Estrutura do Repositório

```
dfast_online/
├── .env.example          # Exemplo de variáveis de ambiente
├── .gitignore            # Proteção contra vazamento de credenciais e bancos
├── .htaccess             # Roteamento Apache no cPanel (SPA + PHP API)
├── server.js             # Servidor local Node 24 (node:sqlite)
├── package.json          # Scripts e comandos raiz
├── api/                  # Backend REST API em PHP (Nativo HostGator)
│   ├── .htaccess         # Segurança e reescrita de rotas
│   ├── index.php         # Roteador principal (/api/*)
│   ├── db.php            # Conexão PDO SQLite e inicializador de tabelas
│   ├── mercadolivre.php  # Cliente oficial OAuth e sincronização ML
│   └── database/         # Armazenamento protegido do SQLite (.htaccess deny)
└── frontend/             # Painel Web Moderno (React + Tailwind + Vite)
    ├── src/
    │   ├── components/   # Picking, Estoque, Compras, Configurações
    │   ├── types.ts      # Modelos de dados TypeScript
    │   └── App.tsx       # Controle geral de estado
    └── dist/             # Arquivos compilados prontos para a HostGator
```
