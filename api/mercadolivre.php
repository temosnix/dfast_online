<?php
// ================================================================
// DFAST ONLINE - CLIENTE OFICIAL DA API MERCADO LIVRE (PHP cURL)
// Compatível com HostGator Plano Turbo
// ================================================================

class MercadoLivreClient {
    private PDO $pdo;
    private string $appId;
    private string $secretKey;
    private string $redirectUri;

    public function __construct(PDO $pdo) {
        $this->pdo = $pdo;
        $configs = $this->pdo->query("SELECT chave, valor FROM ml_config")->fetchAll(PDO::FETCH_KEY_PAIR);
        
        $this->appId = $configs['ml_app_id'] ?? getenv('ML_APP_ID') ?: '';
        $this->secretKey = $configs['ml_secret_key'] ?? getenv('ML_SECRET_KEY') ?: '';
        $this->redirectUri = $configs['ml_redirect_uri'] ?? getenv('ML_REDIRECT_URI') ?: '';
    }

    public function getAuthUrl(): string {
        $encodedUri = urlencode($this->redirectUri);
        return "https://auth.mercadolivre.com.br/authorization?response_type=code&client_id={$this->appId}&redirect_uri={$encodedUri}";
    }

    public function exchangeCode(string $code): array {
        $url = 'https://api.mercadolibre.com/oauth/token';
        $data = [
            'grant_type' => 'authorization_code',
            'client_id' => $this->appId,
            'client_secret' => $this->secretKey,
            'code' => $code,
            'redirect_uri' => $this->redirectUri,
        ];

        return $this->executeCurlPost($url, $data);
    }

    public function refreshToken(string $refreshToken): array {
        $url = 'https://api.mercadolibre.com/oauth/token';
        $data = [
            'grant_type' => 'refresh_token',
            'client_id' => $this->appId,
            'client_secret' => $this->secretKey,
            'refresh_token' => $refreshToken,
        ];

        return $this->executeCurlPost($url, $data);
    }

    public function syncTodayOrders(string $accessToken, string $sellerId): array {
        // Data de hoje no início do dia (00:00:00)
        $todayFrom = date('Y-m-d\T00:00:00.000-03:00');
        $url = "https://api.mercadolibre.com/orders/search?seller={$sellerId}&order.date_created.from={$todayFrom}&order.status=paid";

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            "Authorization: Bearer {$accessToken}",
            "Content-Type: application/json"
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200 || !$response) {
            return ['error' => "Falha na sincronização do Mercado Livre (HTTP {$httpCode})"];
        }

        $data = json_decode($response, true);
        $results = $data['results'] ?? [];
        $savedCount = 0;

        $stmt = $this->pdo->prepare("
            INSERT OR REPLACE INTO pedidos_vendas 
            (order_id, ml_item_id, titulo, quantidade, comprador, data_venda, envio_tipo, envio_status, status_picking)
            VALUES (:order_id, :ml_item_id, :titulo, :quantidade, :comprador, :data_venda, :envio_tipo, :envio_status, 'pendente')
        ");

        foreach ($results as $order) {
            $orderId = $order['id'];
            $items = $order['order_items'] ?? [];
            $buyer = $order['buyer']['first_name'] . ' ' . ($order['buyer']['last_name'] ?? '');
            $dateCreated = $order['date_created'] ?? date('Y-m-d H:i:s');
            $shippingMode = $order['shipping']['shipping_mode'] ?? 'normal';
            $envioTipo = (str_contains($shippingMode, 'self_service') || str_contains($shippingMode, 'turbo')) ? 'flex' : 'coleta';

            foreach ($items as $itemObj) {
                $mlItemId = str_replace('MLB', '', $itemObj['item']['id'] ?? '');
                $title = $itemObj['item']['title'] ?? 'Item ML';
                $quantity = $itemObj['quantity'] ?? 1;

                $stmt->execute([
                    'order_id' => $orderId,
                    'ml_item_id' => $mlItemId,
                    'titulo' => $title,
                    'quantidade' => $quantity,
                    'comprador' => trim($buyer) ?: 'Cliente ML',
                    'data_venda' => $dateCreated,
                    'envio_tipo' => $envioTipo,
                    'envio_status' => 'ready_to_ship'
                ]);
                $savedCount++;
            }
        }

        return [
            'success' => true,
            'orders_found' => count($results),
            'items_imported' => $savedCount
        ];
    }

    private function executeCurlPost(string $url, array $data): array {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        $res = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $json = json_decode($res, true);
        if ($code >= 400 || !$json) {
            return ['error' => $json['message'] ?? "Erro na requisição Mercado Livre (HTTP {$code})"];
        }
        return $json;
    }
}
