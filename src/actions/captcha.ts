
import { EnvConfig } from "@/types";

interface CaptchaResponse {
    repCode: string;
    repMsg: string;
    repData: {
        originalImageBase64: string;
        jigsawImageBase64: string;
        token: string;
        secretKey: string;
        result?: boolean;
    };
    success: boolean;
}

export async function getCaptchaCode(config: EnvConfig, data: { captchaType: string }) {
    try {
        const response = await fetch(`${config.apiBase}/admin-api/system/captcha/get`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'tenant-id': String(config.tenantId || 1)
            },
            body: JSON.stringify(data)
        });
        
        const res = await response.json();
        return res;
    } catch (error) {
        console.error('Get captcha error:', error);
        throw error;
    }
}

export async function checkCaptcha(config: EnvConfig, data: { captchaType: string; pointJson: string; token: string }) {
    try {
        const response = await fetch(`${config.apiBase}/admin-api/system/captcha/check`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                 'tenant-id': String(config.tenantId || 1)
            },
            body: JSON.stringify(data)
        });
        
        const res = await response.json();
        return res;
    } catch (error) {
         console.error('Check captcha error:', error);
         throw error;
    }
}
