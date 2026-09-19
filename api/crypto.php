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
        $key = getenv('APP_ENCRYPTION_KEY') ?: 'dfast_online_master_aes256_key_sec_2026_hostgator';
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
}
