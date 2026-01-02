"use client";

import { Menu, ApiConfig, ApiResponse } from "@/types";

/**
 * Client-side API calls - matching the old project (test.js)
 */
export async function fetchMenusAction(config: ApiConfig): Promise<Menu[]> {
  const response = await fetch(`${config.apiBase}/admin-api/system/menu/list`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.token}`,
      'tenant-id': config.tenantId
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const result: ApiResponse<Menu[]> = await response.json();

  if (result.code !== 0) {
    throw new Error(result.msg);
  }

  return result.data;
}

export async function createMenuAction(menu: any, config: ApiConfig): Promise<number> {
  const response = await fetch(`${config.apiBase}/admin-api/system/menu/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.token}`,
      'tenant-id': config.tenantId
    },
    body: JSON.stringify(menu)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const result: ApiResponse<number> = await response.json();
  if (result.code !== 0) throw new Error(result.msg);
  return result.data;
}

export async function updateMenuAction(menu: any, config: ApiConfig): Promise<boolean> {
  const response = await fetch(`${config.apiBase}/admin-api/system/menu/update`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.token}`,
      'tenant-id': config.tenantId
    },
    body: JSON.stringify(menu)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const result: ApiResponse<boolean> = await response.json();
  if (result.code !== 0) throw new Error(result.msg);
  return true;
}
