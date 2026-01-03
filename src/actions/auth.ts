"use client";

import { ApiConfig, ApiResponse } from "@/types";
import { aesEncryptLogin, getEncryptKeyForEnv, aesDecryptLogin } from "@/utils/apiEncrypt";

interface LoginResponse {
    accessToken: string;
    refreshToken: string;
    expiresTime: number;
    userId: number;
}

export async function loginAction(credentials: { username: string; password: string; tenantName: string; captchaVerification?: string }, config: ApiConfig): Promise<LoginResponse> {
    // 1. Get Tenant ID by Name
    let tenantId = config.tenantId;
    if (credentials.tenantName) {
        try {
            const tenantUrl = `${config.apiBase}/admin-api/system/tenant/get-id-by-name?name=${encodeURIComponent(credentials.tenantName)}`;
            const tenantRes = await fetch(tenantUrl);
            if (tenantRes.ok) {
                const tenantData: ApiResponse<number> = await tenantRes.json();
                if (tenantData.code === 0 && tenantData.data) {
                     tenantId = tenantData.data.toString();
                     console.log(`[Auth] Resolved tenant '${credentials.tenantName}' to ID: ${tenantId}`);
                }
            }
        } catch (e) {
            console.warn(`[Auth] Failed to resolve tenant name: ${credentials.tenantName}`, e);
        }
    }

    // 2. Prepare Login Payload
    const loginPayload = {
        username: credentials.username,
        password: credentials.password,
        captchaVerification: credentials.captchaVerification
    };

    // 3. Encrypt the payload using AES
    const encryptKey = getEncryptKeyForEnv(config.apiBase);
    const encryptedPayload = aesEncryptLogin(JSON.stringify(loginPayload), encryptKey);
    console.log(`[Auth] Encrypted login payload for ${config.apiBase}`);

    // 4. Login with encrypted body
    const loginUrl = `${config.apiBase}/admin-api/system/auth/login`;
    console.log(`[Auth] Attempting login to ${loginUrl} with tenant ${tenantId}`);

    const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'tenant-id': tenantId,
            'isEncrypt': 'true' // Required header for bs-web backend
        },
        body: encryptedPayload // Send encrypted string directly, not wrapped in JSON.stringify
    });

    if (!response.ok) {
        throw new Error(`Login failed with HTTP ${response.status}`);
    }

    // 5. Check if response is encrypted and decrypt
    const isResponseEncrypted = response.headers.get('X-Api-Encrypt') === 'true';
    let result: ApiResponse<LoginResponse>;

    if (isResponseEncrypted) {
        const encryptedResponse = await response.text();
        const decryptedText = aesDecryptLogin(encryptedResponse, encryptKey);
        result = JSON.parse(decryptedText);
    } else {
        result = await response.json();
    }

    if (result.code !== 0) {
        throw new Error(result.msg || 'Login failed');
    }

    return result.data;
}
