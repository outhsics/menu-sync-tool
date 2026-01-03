"use client";

import { ApiConfig, ApiResponse } from "@/types";

interface LoginResponse {
    accessToken: string;
    refreshToken: string;
    expiresTime: number;
    userId: number;
}

export async function loginAction(credentials: any, config: ApiConfig): Promise<LoginResponse> {
    // 假设标准登录接口
    const url = `${config.apiBase}/admin-api/system/auth/login`;
    
    // 如果需要 TenantID，通常在 Header 或 Body
    // 榜样系统通常在 Header: tenant-id
    
    console.log(`[Auth] Attempting login to ${url} with tenant ${config.tenantId}`);

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'tenant-id': config.tenantId 
        },
        body: JSON.stringify(credentials)
    });

    if (!response.ok) {
        throw new Error(`Login failed with HTTP ${response.status}`);
    }

    const result: ApiResponse<LoginResponse> = await response.json();

    if (result.code !== 0) {
        throw new Error(result.msg || 'Login failed');
    }

    return result.data;
}
