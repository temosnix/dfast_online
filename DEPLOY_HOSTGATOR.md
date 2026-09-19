# 🚀 Guia Prático de Publicação no HostGator (Plano Turbo)

Este guia orienta passo a passo como colocar o **Dfast Online** no ar no seu **Plano Turbo da HostGator** utilizando o pacote automatizado gerado pela squad.

---

### 📦 1. Pacote de Publicação Pronto

Já geramos o arquivo ZIP completo pronto para upload no cPanel:
📁 **Localização no seu computador:**
`C:\Users\User\projetos\dfast_online\dfast_online_hostgator.zip`

> **O que já está incluído dentro desse ZIP:**
> - Frontend moderno compilado (`index.html` e pasta `assets/`).
> - Backend PHP nativo e seguro (`api/index.php`, `api/crypto.php`, `api/db.php`, `api/mercadolivre.php`).
> - Banco de dados SQLite oficial com todas as tabelas, componentes e usuários (`api/database/db_app.db`).
> - Arquivos de segurança e roteamento Apache (`.htaccess` na raiz e `api/database/.htaccess`).
> - Variáveis de ambiente otimizadas para produção (`.env`).

---

### 🌐 2. Definir a Pasta no cPanel (Plano Turbo)

O Plano Turbo da HostGator suporta múltiplos domínios:
* **Se for usar no domínio principal:** a pasta de destino é `public_html/`
* **Se for usar em um domínio adicional (ex: `dfastonline.com.br`):**
  1. No cPanel, abra **Domínios** (ou **Domínios Adicionais**).
  2. Veja qual pasta está atribuída ao domínio (geralmente `public_html/dfast_online` ou `dfast_online`).

---

### 📤 3. Passo a Passo do Envio via cPanel

1. **Acesse o cPanel da HostGator:**
   - Entre pelo painel do cliente HostGator ou direto em `https://seudominio.com.br:2083`.
2. **Abra o Gerenciador de Arquivos (File Manager):**
   - No cPanel, clique no ícone **Gerenciador de Arquivos**.
   - Navegue até a pasta do seu domínio (ex: `public_html` ou a pasta do domínio adicional).
3. **Fazer Upload do ZIP:**
   - No menu superior, clique em **Carregar (Upload)**.
   - Selecione o arquivo `C:\Users\User\projetos\dfast_online\dfast_online_hostgator.zip`.
4. **Extrair os Arquivos:**
   - Volte ao Gerenciador de Arquivos e clique em **Atualizar (Reload)**.
   - Clique com o botão direito no arquivo `dfast_online_hostgator.zip` e escolha **Extrair (Extract)**.
   - Confirme a extração na pasta atual.
   - Após extrair, você pode excluir o arquivo `.zip` para economizar espaço.

---

### ⚙️ 4. Ajustar a Versão do PHP (Recomendado PHP 8.2 ou 8.3)

O sistema utiliza os recursos mais modernos de criptografia (AES-256-GCM) e SQLite do PHP 8.2+:
1. No cPanel, pesquise por **Gerenciador MultiPHP** (ou **MultiPHP Manager**).
2. Na lista de domínios, marque a caixinha do seu domínio.
3. No campo "Versão do PHP", selecione **PHP 8.2** (ou **PHP 8.3**) e clique em **Aplicar**.

---

### 🔒 5. Certificado SSL / HTTPS (Cadeado Verde Gratuito)

No Plano Turbo da HostGator, o SSL gratuito é emitido automaticamente:
1. No cPanel, pesquise por **Status do SSL/TLS**.
2. Verifique se o domínio possui o certificado ativo.
3. Caso ainda não tenha sido emitido, marque o domínio e clique em **Executar AutoSSL**. O certificado é emitido em poucos minutos.

---

### 🔑 6. Primeiro Acesso e Login

Acesse seu site no navegador (`https://seudominio.com.br`):
1. Você verá a **Tela de Login** do Dfast Online.
2. Acesse com sua conta Master:
   - **Usuário:** `daniloivanoff`
   - **Senha:** `D4n1l002!@!`
3. O painel abrirá com acesso total liberado!

---

### 🤝 7. Configuração do Mercado Livre em Produção

1. Com o login Master ativo, clique no botão **Config** (ícone de engrenagem) no topo.
2. Preencha seu **App ID**, **Secret Key** e **Seller ID** da sua conta do Mercado Livre.
3. No portal de desenvolvedores do Mercado Livre ([developers.mercadolivre.com.br](https://developers.mercadolivre.com.br)):
   - Abra o seu aplicativo.
   - Na opção **Redirect URI**, cadastre:
     `https://seudominio.com.br/api/mercadolivre/callback`
   - Salve as alterações.
4. No Dfast Online, clique em **Sincronizar ML** para puxar as vendas reais e os SLAs de expedição do dia!

---

### 🔄 Como Gerar um Novo Pacote de Atualização no Futuro

Sempre que fizer alterações no código e quiser enviar uma nova versão para a HostGator, basta executar no terminal:
```bash
node package_hostgator.js
```
O script recompila e gera um novo `dfast_online_hostgator.zip` em 2 segundos!
