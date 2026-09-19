# 🚀 Guia de Publicação no HostGator (Plano Turbo)

Este guia orienta passo a passo como colocar o **Dfast Online** no ar utilizando o seu **Plano Turbo da HostGator** e o domínio adquirido no **Registro.br**.

---

### 1. Como Funciona no Plano Turbo
O seu Plano Turbo permite até **3 domínios independentes**. No cPanel, cada domínio possui sua pasta:
- Domínio Principal: pasta `public_html`
- 2º Domínio (Domínio Adicional): pasta `public_html/dfast_online` (ou `dfast_online/`)
- 3º Domínio: pasta correspondente cadastrada no cPanel

---

### 2. Passo a Passo de Envio

#### Passo A: Preparar o Pacote Zip (Mais fácil para upload)
1. No seu computador, todos os arquivos já foram compilados.
2. Junte em um arquivo `.zip`:
   - Os arquivos de `frontend/dist/` (`index.html` e a pasta `assets/`).
   - A pasta `api/` completa.
   - O arquivo `.htaccess` da raiz.

#### Passo B: Upload pelo Gerenciador de Arquivos do cPanel
1. Acesse o **cPanel da HostGator**.
2. Abra a opção **Gerenciador de Arquivos**.
3. Navegue até a pasta do domínio escolhido (ex: `public_html`).
4. Clique no botão **Carregar** no topo e envie o arquivo `.zip`.
5. Clique com o botão direito sobre o arquivo enviado e selecione **Extrair (Extract)**.

#### Passo C: Enviar o Banco de Dados SQLite
1. No Gerenciador de Arquivos, dentro da pasta `api/database/`, faça o upload do seu arquivo `db_app.db`.
2. O arquivo `api/database/.htaccess` já existente bloqueia qualquer pessoa na internet de fazer download do seu banco, garantindo total segurança!

---

### 3. Apontar o Domínio no Registro.br

1. Acesse o painel do **Registro.br** (registro.br).
2. Clique no seu domínio.
3. Na seção **DNS**, clique em **Alterar Servidores DNS** e informe os nameservers da sua conta HostGator (normalmente):
   - **Servidor 1**: `ns1.hostgator.com.br` (ou o informado no e-mail de boas-vindas da HostGator)
   - **Servidor 2**: `ns2.hostgator.com.br`
4. Salve as alterações. Em poucos minutos o domínio passará a responder pelo seu plano da HostGator.

---

### 4. Certificado SSL / HTTPS
No cPanel da HostGator, o SSL gratuito é emitido automaticamente para todos os domínios via **AutoSSL (Let's Encrypt / Sectigo)** em até 1 hora após a propagação do DNS.

---

### 5. Configurar o Mercado Livre para Produção
Ao acessar o seu site no domínio definitivo:
1. Clique no ícone de engrenagem ⚙️ no topo do sistema.
2. Preencha seu **App ID**, **Secret Key** e **Seller ID**.
3. No painel de Desenvolvedores do Mercado Livre ([developers.mercadolivre.com.br](https://developers.mercadolivre.com.br)), configure a **URL de Redirecionamento (Redirect URI)** para:
   `https://seudominio.com.br/api/mercadolivre/callback`
4. Clique em **Sincronizar ML** para importar suas vendas em tempo real!
