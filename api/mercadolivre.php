<?php
// ================================================================
// DFAST ONLINE - CLIENTE OFICIAL MERCADO LIVRE DEVELOPERS (COMPLIANCE)
// Implementa todas as diretrizes de segurança da API oficial:
// 1. Prevenção de CSRF via parâmetro state dinâmico
// 2. Renovação preventiva de tokens de 6h (Auto-Refresh com AES-256-GCM)
// 3. Tratamento de Rate Limit com Exponential Backoff (HTTP 429)
// 4. Identificação de User-Agent estruturado
// 5. Trilha de Auditoria de Segurança (Security Audit Trail)
// 6. Sanitização de dados de compradores (LGPD / Privacy)
// ================================================================

require_once __DIR__ . '/crypto.php';

class MercadoLivreClient {
    private PDO $pdo;
    private string $appId;
    private string $secretKey;
    private string $redirectUri;
    private string $sellerId;

    public function __construct(PDO $pdo) {
        $this->pdo = $pdo;
        $configs = $this->pdo->query("SELECT chave, valor FROM ml_config")->fetchAll(PDO::FETCH_KEY_PAIR);
        
        $this->appId = CryptoService::decrypt($configs['ml_app_id'] ?? '') ?: getenv('ML_APP_ID') ?: '';
        $this->secretKey = CryptoService::decrypt($configs['ml_secret_key'] ?? '') ?: getenv('ML_SECRET_KEY') ?: '';
        $this->redirectUri = $configs['ml_redirect_uri'] ?? getenv('ML_REDIRECT_URI') ?: '';
        $this->sellerId = CryptoService::decrypt($configs['ml_seller_id'] ?? '') ?: getenv('ML_SELLER_ID') ?: '';
    }

    /**
     * Gera URL de autorização OAuth 2.0 com proteção contra CSRF (state randômico de 128-bit)
     */
    public function getAuthUrl(): string {
        if (empty($this->appId) || $this->appId === '12345678901234') {
            return '';
        }
        $state = bin2hex(random_bytes(16));
        $stmt = $this->pdo->prepare("INSERT OR REPLACE INTO ml_config (chave, valor, atualizado_em) VALUES ('ml_oauth_state', ?, CURRENT_TIMESTAMP)");
        $stmt->execute([$state]);

        $this->logSecurityEvent('OAUTH_AUTH_URL_GENERATED', "State CSRF gerado: {$state}");

        $encodedUri = urlencode($this->redirectUri);
        return "https://auth.mercadolivre.com.br/authorization?response_type=code&client_id={$this->appId}&redirect_uri={$encodedUri}&state={$state}";
    }

    /**
     * Valida o parâmetro state recebido no callback para impedir ataques de Login CSRF
     */
    public function validateState(string $receivedState): bool {
        $stmt = $this->pdo->prepare("SELECT valor FROM ml_config WHERE chave = 'ml_oauth_state'");
        $stmt->execute();
        $storedState = $stmt->fetchColumn();

        if (empty($storedState) || !hash_equals($storedState, $receivedState)) {
            $this->logSecurityEvent('OAUTH_CSRF_VALIDATION_FAILED', "State recebido não coincide com o esperado.");
            return false;
        }

        // State consumido com sucesso - remove para evitar reuso
        $this->pdo->exec("DELETE FROM ml_config WHERE chave = 'ml_oauth_state'");
        $this->logSecurityEvent('OAUTH_CSRF_VALIDATION_SUCCESS', "State CSRF validado com sucesso.");
        return true;
    }

    /**
     * Troca o authorization_code pelos tokens iniciais e salva criptografado com AES-256-GCM
     */
    public function exchangeCode(string $code): array {
        $url = 'https://api.mercadolibre.com/oauth/token';
        $data = [
            'grant_type' => 'authorization_code',
            'client_id' => $this->appId,
            'client_secret' => $this->secretKey,
            'code' => $code,
            'redirect_uri' => $this->redirectUri,
        ];

        $res = $this->executeCurlWithBackoff('POST', $url, $data);
        if (isset($res['access_token'])) {
            $this->persistTokens($res);
            $this->logSecurityEvent('OAUTH_TOKEN_EXCHANGED', "Tokens gerados e criptografados com sucesso.");
        }
        return $res;
    }

    /**
     * Renova o access_token usando o refresh_token (com rotação atômica de chaves)
     */
    public function refreshToken(): array {
        $configs = $this->pdo->query("SELECT chave, valor FROM ml_config")->fetchAll(PDO::FETCH_KEY_PAIR);
        $rawRefreshToken = CryptoService::decrypt($configs['ml_refresh_token'] ?? '');

        if (empty($rawRefreshToken)) {
            return ['error' => 'Nenhum refresh token cadastrado ou ativo.'];
        }

        $url = 'https://api.mercadolibre.com/oauth/token';
        $data = [
            'grant_type' => 'refresh_token',
            'client_id' => $this->appId,
            'client_secret' => $this->secretKey,
            'refresh_token' => $rawRefreshToken,
        ];

        $res = $this->executeCurlWithBackoff('POST', $url, $data);
        if (isset($res['access_token'])) {
            $this->persistTokens($res);
            $this->logSecurityEvent('TOKEN_AUTO_REFRESH_SUCCESS', "Access Token renovado com sucesso antes da expiração de 6h.");
        } else {
            $this->logSecurityEvent('TOKEN_AUTO_REFRESH_FAILED', "Erro ao renovar token: " . json_encode($res));
        }
        return $res;
    }

    /**
     * Obtém um token de acesso válido, renovando preventivamente se estiver a < 10min de expirar
     */
    public function getValidAccessToken(): ?string {
        $configs = $this->pdo->query("SELECT chave, valor FROM ml_config")->fetchAll(PDO::FETCH_KEY_PAIR);
        $accessToken = CryptoService::decrypt($configs['ml_access_token'] ?? '');
        $expiresAt = (int)($configs['ml_token_expires_at'] ?? 0);

        if (empty($accessToken)) {
            return null;
        }

        // Se o token expirar nos próximos 10 minutos (600s), renova preventivamente
        if ($expiresAt > 0 && (time() + 600 >= $expiresAt)) {
            $this->logSecurityEvent('TOKEN_PRE_EXPIRY_TRIGGERED', "Token próximo de expirar ({$expiresAt}). Disparando renovação automática.");
            $refreshResult = $this->refreshToken();
            if (isset($refreshResult['access_token'])) {
                return $refreshResult['access_token'];
            }
        }

        return $accessToken;
    }

    /**
     * Sincroniza pedidos em tempo real com dados reais da API oficial do Mercado Livre
     * Aplica regras de negócio extraídas do repositório BD-APP (tags.not=delivered,no_shipping, SLA e Modalidades)
     */
    public function syncTodayOrders(): array {
        $accessToken = $this->getValidAccessToken();
        if (!$accessToken) {
            return ['error' => 'Não autenticado no Mercado Livre ou token expirado. Configure suas credenciais em Configurações.'];
        }

        $sellerId = $this->sellerId ?: '34977269';

        // Busca pedidos reais pagos que ainda não foram entregues (regras do repositório BD-APP)
        $url = "https://api.mercadolibre.com/orders/search?seller={$sellerId}&order.status=paid&tags.not=delivered,no_shipping&sort=date_desc&limit=50";

        $response = $this->executeCurlWithBackoff('GET', $url, [], [
            "Authorization: Bearer {$accessToken}"
        ]);

        // Se retornar 401 (token expirado no ML), força renovação imediata e retenta
        if (isset($response['error']) && (str_contains($response['error'], '401') || str_contains($response['error'], 'invalid_token') || str_contains($response['error'], 'expired'))) {
            $this->logSecurityEvent('TOKEN_AUTO_REFRESH_ON_401', 'HTTP 401 interceptado durante sincronização. Renovando token via refresh_token.');
            $refreshRes = $this->refreshToken();
            if (isset($refreshRes['access_token'])) {
                $accessToken = $refreshRes['access_token'];
                $response = $this->executeCurlWithBackoff('GET', $url, [], [
                    "Authorization: Bearer {$accessToken}"
                ]);
            }
        }

        if (isset($response['error'])) {
            if ((isset($response['status']) && $response['status'] === 401) || str_contains($response['error'], '401') || str_contains($response['error'], 'unauthorized')) {
                return ['error' => 'Não autorizado (HTTP 401): As credenciais (Access Token ou App ID) gravadas no banco de dados são valores de exemplo ou expiraram. Atualize suas credenciais oficiais em "Trocar Seller".'];
            }
            if ((isset($response['status']) && $response['status'] === 403) || str_contains(json_encode($response), 'PA_UNAUTHORIZED_RESULT_FROM_POLICIES') || str_contains(json_encode($response), 'PolicyAgent')) {
                $this->logSecurityEvent('API_SYNC_POLICY_AGENT_BLOCK', 'Permissão de Vendas/Envios pendente no DevCenter do Mercado Livre (PA_UNAUTHORIZED_RESULT_FROM_POLICIES).');
                return ['error' => 'Permissão de Vendas pendente (HTTP 403): Seu aplicativo no Mercado Livre Developers foi autenticado com sucesso, mas precisa da permissão de "Vendas e Envios" (urn:ml:mktp:orders-shipments:/read-only) habilitada no DevCenter.'];
            }
            return $response;
        }

        $results = $response['results'] ?? [];
        $savedCount = 0;
        $todayStr = date('Y-m-d');

        $stmt = $this->pdo->prepare("
            INSERT OR REPLACE INTO pedidos_vendas 
            (order_id, ml_item_id, titulo, quantidade, comprador, data_venda, envio_tipo, envio_status, status_picking)
            VALUES (:order_id, :ml_item_id, :titulo, :quantidade, :comprador, :data_venda, :envio_tipo, :envio_status, 'pendente')
        ");

        foreach ($results as $order) {
            $orderId = preg_replace('/[^0-9]/', '', (string)$order['id']);
            $shipping = $order['shipping'] ?? [];
            $shippingId = (string)($shipping['id'] ?? '');

            // Determinar modalidade de envio (Flex vs Coleta)
            $shippingMode = $shipping['shipping_mode'] ?? 'normal';
            $envioTipo = (str_contains($shippingMode, 'self_service') || str_contains($shippingMode, 'turbo')) ? 'flex' : 'coleta';

            // Se possuir envio identificado, verifica logistic_type real na API de envios
            if (!empty($shippingId)) {
                $shipmentData = $this->executeCurlWithBackoff('GET', "https://api.mercadolibre.com/shipments/{$shippingId}", [], [
                    "Authorization: Bearer {$accessToken}"
                ]);

                if (!isset($shipmentData['error']) && !empty($shipmentData['logistic_type'])) {
                    $logisticType = $shipmentData['logistic_type'];
                    if ($logisticType === 'self_service' || str_contains($logisticType, 'turbo')) {
                        $envioTipo = 'flex';
                    } else {
                        $envioTipo = 'coleta';
                    }
                }
            }

            // Sanitização de dados de comprador (Minimização LGPD)
            $firstName = preg_replace('/[^\p{L}\s]/u', '', $order['buyer']['first_name'] ?? '');
            $lastName = preg_replace('/[^\p{L}\s]/u', '', $order['buyer']['last_name'] ?? '');
            $buyerClean = trim("{$firstName} {$lastName}");
            if (empty($buyerClean)) $buyerClean = 'Cliente Mercado Livre';

            $dateCreated = $order['date_created'] ?? date('Y-m-d H:i:s');
            $items = $order['order_items'] ?? [];

            foreach ($items as $itemObj) {
                $mlItemId = preg_replace('/[^0-9]/', '', str_replace('MLB', '', $itemObj['item']['id'] ?? ''));
                $rawTitle = strip_tags($itemObj['item']['title'] ?? 'Item ML');
                $titleClean = substr($rawTitle, 0, 150);
                $quantity = max(1, min(1000, (int)($itemObj['quantity'] ?? 1)));

                $stmt->execute([
                    'order_id' => $orderId,
                    'ml_item_id' => $mlItemId,
                    'titulo' => $titleClean,
                    'quantidade' => $quantity,
                    'comprador' => substr($buyerClean, 0, 80),
                    'data_venda' => $dateCreated,
                    'envio_tipo' => $envioTipo,
                    'envio_status' => 'ready_to_ship'
                ]);
                $savedCount++;

                // Verificar se o anúncio existe na tabela anuncios
                $chkStmt = $this->pdo->prepare("SELECT 1 FROM anuncios WHERE id_ml = ?");
                $chkStmt->execute([$mlItemId]);
                if (!$chkStmt->fetch() && !isset($unregisteredMap[$mlItemId])) {
                    $unregisteredMap[$mlItemId] = [
                        'id_ml' => $mlItemId,
                        'titulo' => $titleClean,
                        'quantidade' => $quantity,
                    ];
                }
            }
        }

        $unregisteredList = array_values($unregisteredMap ?? []);

        $this->logSecurityEvent(
            'ORDERS_SYNCED_SUCCESS', 
            "Sincronização em tempo real: " . count($results) . " pedidos oficiais analisados, {$savedCount} itens processados e " . count($unregisteredList) . " anúncios sem cadastro identificados."
        );

        return [
            'success' => true,
            'orders_found' => count($results),
            'items_imported' => $savedCount,
            'unregistered_count' => count($unregisteredList),
            'unregistered_items' => $unregisteredList,
            'message' => count($results) > 0 
                ? (count($unregisteredList) > 0 
                    ? "Sincronização concluída! {$savedCount} itens importados. ⚠️ Atenção: " . count($unregisteredList) . " anúncio(s) do Mercado Livre não possuem cadastro no banco de dados!"
                    : "Sincronização concluída! {$savedCount} itens reais atualizados na lista de expedição.")
                : "API Mercado Livre conectada com sucesso. Nenhum novo pedido pendente de expedição no momento."
        ];
    }

    /**
     * Persiste e criptografa os tokens com AES-256-GCM e calcula timestamp de expiração
     */
    private function persistTokens(array $tokenData): void {
        $stmt = $this->pdo->prepare("INSERT OR REPLACE INTO ml_config (chave, valor, atualizado_em) VALUES (?, ?, CURRENT_TIMESTAMP)");
        
        if (!empty($tokenData['access_token'])) {
            $stmt->execute(['ml_access_token', CryptoService::encrypt($tokenData['access_token'])]);
        }
        if (!empty($tokenData['refresh_token'])) {
            $stmt->execute(['ml_refresh_token', CryptoService::encrypt($tokenData['refresh_token'])]);
        }
        if (!empty($tokenData['user_id'])) {
            $stmt->execute(['ml_seller_id', CryptoService::encrypt((string)$tokenData['user_id'])]);
        }

        // Calcula expiração: padrão do ML é 21600s (6 horas)
        $expiresIn = isset($tokenData['expires_in']) ? (int)$tokenData['expires_in'] : 21600;
        $expiresAt = time() + $expiresIn;
        $stmt->execute(['ml_token_expires_at', (string)$expiresAt]);
    }

    /**
     * Executa chamada cURL com Exponential Backoff (regras oficiais de Rate Limit HTTP 429)
     * e identificação estruturada de User-Agent
     */
    private function executeCurlWithBackoff(string $method, string $url, array $data = [], array $headers = []): array {
        $maxRetries = 3;
        $retryCount = 0;
        $backoffDelay = 1; // 1 segundo inicial

        // Identificação obrigatória do aplicativo segundo regras do ML
        $userAgent = "DfastOnline-WMS/1.0 (AppId: " . ($this->appId ?: 'Pending') . "; HostGator-Production)";
        $defaultHeaders = [
            "User-Agent: {$userAgent}",
            "Accept: application/json"
        ];

        while ($retryCount <= $maxRetries) {
            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 30);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

            $mergedHeaders = array_merge($defaultHeaders, $headers);

            if ($method === 'POST') {
                curl_setopt($ch, CURLOPT_POST, true);
                if (!empty($data)) {
                    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
                    $mergedHeaders[] = "Content-Type: application/x-www-form-urlencoded";
                }
            }

            curl_setopt($ch, CURLOPT_HTTPHEADER, $mergedHeaders);

            $res = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlError = curl_error($ch);
            curl_close($ch);

            // Rate Limit atingido (HTTP 429) -> Aplica Exponential Backoff
            if ($httpCode === 429) {
                $retryCount++;
                if ($retryCount > $maxRetries) {
                    $this->logSecurityEvent('RATE_LIMIT_EXCEEDED', "Limite de requisições do Mercado Livre excedido após {$maxRetries} tentativas.");
                    return ['error' => 'Limite de requisições da API do Mercado Livre atingido (HTTP 429). Tente novamente em alguns instantes.'];
                }

                $this->logSecurityEvent('RATE_LIMIT_BACKOFF', "HTTP 429 detectado. Aguardando {$backoffDelay}s antes da tentativa {$retryCount}...");
                sleep($backoffDelay);
                $backoffDelay *= 2; // Dobra o tempo (1s -> 2s -> 4s)
                continue;
            }

            if ($curlError) {
                return ['error' => "Falha de conexão com a API do Mercado Livre: {$curlError}"];
            }

            $json = json_decode($res, true);
            if ($httpCode >= 400 || !$json) {
                return ['error' => $json['message'] ?? "Erro na API do Mercado Livre (HTTP {$httpCode})"];
            }

            return $json;
        }

        return ['error' => 'Falha após múltiplas tentativas de conexão com a API do Mercado Livre.'];
    }

    /**
     * Grava evento de auditoria de segurança no SQLite
     */
    private function logSecurityEvent(string $event, string $details): void {
        try {
            $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
            $stmt = $this->pdo->prepare("INSERT INTO ml_audit_log (evento, detalhes, ip_origem) VALUES (?, ?, ?)");
            $stmt->execute([$event, $details, $ip]);
        } catch (Exception $e) {
            // Silencioso para não interromper fluxo operacional
        }
    }
}
