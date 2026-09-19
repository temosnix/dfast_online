<?php
// ================================================================
// DFAST ONLINE - MÓDULO CRIPTOGRÁFICO DE DADOS SENSÍVEIS (AES-256-GCM)
// Padrão de Criptografia Militar Autenticada (AEAD)
// Compatível com PHP 8.2+ no HostGator e interoperável com Node.js
// ================================================================

class CryptoService {
    private const CIPHER = 'aes-256-gcm';
    private const PREFIX = 'enc:v1:';

    private static function getMasterKey(): string {
        $key = $_ENV['APP_ENCRYPTION_KEY'] ?? $_SERVER['APP_ENCRYPTION_KEY'] ?? getenv('APP_ENCRYPTION_KEY') ?: 'dfast_online_master_aes256_key_sec_2026_hostgator';
        // Deriva uma chave de 256 bits (32 bytes) segura via SHA-256
        return hash('sha256', $key, true);
    }

    /**
     * Criptografa um dado sensível usando AES-256-GCM.
     * Retorna uma string no formato: enc:v1:<base64(IV + TAG + CIPHERTEXT)>
     */
    public static function encrypt(?string $plaintext): ?string {
        if ($plaintext === null || $plaintext === '') {
            return $plaintext;
        }

        // Se já estiver criptografado, não criptografa novamente
        if (str_starts_with($plaintext, self::PREFIX)) {
            return $plaintext;
        }

        $key = self::getMasterKey();
        $iv = random_bytes(12); // 12 bytes recomendado pelo NIST para GCM
        $tag = '';

        $ciphertext = openssl_encrypt(
            $plaintext,
            self::CIPHER,
            $key,
            OPENSSL_RAW_DATA,
            $iv,
            $tag,
            '', // dados adicionais autenticados (AAD opcional)
            16  // tag de autenticação de 128 bits
        );

        if ($ciphertext === false) {
            throw new RuntimeException('Falha ao criptografar dado sensível com AES-256-GCM.');
        }

        // Combina IV (12) + TAG (16) + CIPHERTEXT
        $combined = $iv . $tag . $ciphertext;
        return self::PREFIX . base64_encode($combined);
    }

    /**
     * Descriptografa um dado sensível criptografado.
     * Se for texto puro (legado), retorna o próprio valor para compatibilidade.
     */
    public static function decrypt(?string $payload): ?string {
        if ($payload === null || $payload === '') {
            return $payload;
        }

        // Se não possuir o prefixo de versão, retorna texto original
        if (!str_starts_with($payload, self::PREFIX)) {
            return $payload;
        }

        $raw = base64_decode(substr($payload, strlen(self::PREFIX)), true);
        if ($raw === false || strlen($raw) < 28) {
            // Mínimo de 12 bytes de IV + 16 bytes de TAG = 28 bytes
            return null;
        }

        $iv = substr($raw, 0, 12);
        $tag = substr($raw, 12, 16);
        $ciphertext = substr($raw, 28);

        $key = self::getMasterKey();

        $plaintext = openssl_decrypt(
            $ciphertext,
            self::CIPHER,
            $key,
            OPENSSL_RAW_DATA,
            $iv,
            $tag
        );

        return $plaintext !== false ? $plaintext : null;
    }

    public static function hashPassword(string $password): string {
        $salt = bin2hex(random_bytes(16));
        $iterations = 100000;
        $hash = hash_pbkdf2('sha256', $password, $salt, $iterations, 64);
        return "pbkdf2:sha256:{$iterations}:{$salt}:{$hash}";
    }

    public static function verifyPassword(string $password, ?string $stored): bool {
        if (empty($stored)) return false;
        $parts = explode(':', $stored);
        if (count($parts) === 5 && $parts[0] === 'pbkdf2') {
            $iterations = (int)$parts[2];
            $salt = $parts[3];
            $originalHash = $parts[4];
            $checkHash = hash_pbkdf2('sha256', $password, $salt, $iterations, 64);
            return hash_equals($originalHash, $checkHash);
        }
        return false;
    }

    public static function createSessionToken(array $user): string {
        $payload = [
            'id' => $user['id'],
            'username' => $user['username'],
            'nome' => $user['nome'],
            'role' => $user['role'],
            'exp' => (time() + 7 * 24 * 60 * 60) * 1000
        ];
        $json = json_encode($payload);
        $data = rtrim(strtr(base64_encode($json), '+/', '-_'), '=');
        $sigRaw = hash_hmac('sha256', $data, self::getMasterKey(), true);
        $sig = rtrim(strtr(base64_encode($sigRaw), '+/', '-_'), '=');
        return "{$data}.{$sig}";
    }

    public static function verifySessionToken(?string $token): ?array {
        if (empty($token) || !str_contains($token, '.')) return null;
        $parts = explode('.', $token, 2);
        if (count($parts) !== 2) return null;
        list($data, $sig) = $parts;

        $expectedSigRaw = hash_hmac('sha256', $data, self::getMasterKey(), true);
        $expectedSig = rtrim(strtr(base64_encode($expectedSigRaw), '+/', '-_'), '=');
        if (!hash_equals($expectedSig, $sig)) return null;

        $json = base64_decode(strtr($data, '-_', '+/'));
        if (!$json) return null;
        $payload = json_decode($json, true);
        if (!$payload || !isset($payload['exp'])) return null;
        if ((time() * 1000) > $payload['exp']) return null;

        return $payload;
    }

    public static function getAuthenticatedUser(): ?array {
        $headers = function_exists('getallheaders') ? getallheaders() : [];
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (empty($authHeader)) return null;
        $parts = explode(' ', $authHeader, 2);
        if (count($parts) === 2 && strtolower($parts[0]) === 'bearer') {
            return self::verifySessionToken($parts[1]);
        }
        return null;
    }

    public static function requireMaster(): ?array {
        $user = self::getAuthenticatedUser();
        if (!$user || ($user['role'] ?? '') !== 'master') {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'error' => 'Acesso negado: Operação permitida apenas para o perfil Master.'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
        return $user;
    }
}

