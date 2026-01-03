import CryptoJS from 'crypto-js';

/**
 * AES 加密 - 用于登录接口加密
 * 使用 ECB 模式 + PKCS7 填充 (与 bs-web 一致)
 */
export function aesEncryptLogin(data: string, key: string): string {
    if (!key || key.length !== 32) {
        console.warn('[AES Encrypt] Key must be 32 characters. Current length:', key?.length);
        throw new Error('AES 密钥必须为 32 位');
    }
    const keyUtf8 = CryptoJS.enc.Utf8.parse(key);
    const encrypted = CryptoJS.AES.encrypt(data, keyUtf8, {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7
    });
    return encrypted.toString();
}

/**
 * AES 解密 - 用于解密响应
 */
export function aesDecryptLogin(encryptedData: string, key: string): string {
    if (!key || key.length !== 32) {
        throw new Error('AES 密钥必须为 32 位');
    }
    const keyUtf8 = CryptoJS.enc.Utf8.parse(key);
    const decrypted = CryptoJS.AES.decrypt(encryptedData, keyUtf8, {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7
    });
    return decrypted.toString(CryptoJS.enc.Utf8);
}

// 环境配置 - 加密密钥
// DEV 环境
export const DEV_ENCRYPT_KEY = 'abcefg1234567890abcefg1234567890';
// PROD 环境
export const PROD_ENCRYPT_KEY = 'Kj9mN2pQ4rT6vX8zA1bC3dE5fG7hJ0lb';

/**
 * 根据 API Base URL 推断使用的加密密钥
 */
export function getEncryptKeyForEnv(apiBase: string): string {
    if (apiBase.includes('api.byjedu.com')) {
        return PROD_ENCRYPT_KEY;
    }
    // Default to DEV key for dev-api or local
    return DEV_ENCRYPT_KEY;
}
