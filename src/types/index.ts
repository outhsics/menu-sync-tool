export interface Menu {
  id: number;
  name: string;
  path: string;
  component: string;
  componentName?: string;
  permission: string;
  type: number; // 1: 目录, 2: 菜单, 3: 按钮
  sort: number;
  icon: string;
  status: number;
  visible: boolean;
  keepAlive: boolean;
  alwaysShow: boolean;
  parentId: number;
  children?: Menu[];
  createTime?: number;
}

export interface ApiConfig {
  apiBase: string;
  token: string;
  tenantId: string;
}

export interface ApiResponse<T = any> {
  code: number;
  data: T;
  msg: string;
}

export interface EnvConfig extends ApiConfig {
  name: string;
  isConnected: boolean;
}

export interface SyncResult {
  added: number;
  updated: number;
}
