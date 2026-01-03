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
  systemType: number; // 0: 榜样教育系统, 1: BI系统
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


export type DiffStatus = 'NEW' | 'UPDATE' | 'SAME';

export interface DiffNode extends Omit<Menu, 'status' | 'children'> {
  status: DiffStatus;
  targetId?: number; // ID in the target system if it exists
  diffFields: string[]; // List of fields that are different
  sourceMenu?: Menu;
  targetMenu?: Menu;
  children?: DiffNode[];
  expanded?: boolean;
  level?: number;
}
