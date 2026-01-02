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

// 获取所有菜单
export async function fetchAllMenus(config: ApiConfig): Promise<Menu[]> {
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

// 构建菜单树
export function buildMenuTree(menus: Menu[], parentId: number = 0): Menu[] {
  return menus
    .filter(m => m.parentId === parentId)
    .sort((a, b) => a.sort - b.sort)
    .map(m => ({ ...m, children: buildMenuTree(menus, m.id) }));
}

// 统计所有菜单数量（包括子菜单）
export function countAllMenus(menuList: Menu[]): number {
  let count = 0;
  menuList.forEach(m => {
    count++;
    if (m.children && m.children.length > 0) {
      count += countAllMenus(m.children);
    }
  });
  return count;
}

// 创建菜单
export async function createMenu(menu: Omit<Menu, 'id' | 'parentId' | 'children' | 'createTime'> & { parentId: number }, config: ApiConfig): Promise<number> {
  const response = await fetch(`${config.apiBase}/admin-api/system/menu/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.token}`,
      'tenant-id': config.tenantId
    },
    body: JSON.stringify(menu)
  });

  const result: ApiResponse<number> = await response.json();

  if (result.code !== 0) {
    throw new Error(result.msg);
  }

  return result.data;
}

// 更新菜单
export async function updateMenu(menu: Omit<Menu, 'children' | 'createTime'>, config: ApiConfig): Promise<boolean> {
  const response = await fetch(`${config.apiBase}/admin-api/system/menu/update`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.token}`,
      'tenant-id': config.tenantId
    },
    body: JSON.stringify(menu)
  });

  const result: ApiResponse<boolean> = await response.json();

  if (result.code !== 0) {
    throw new Error(result.msg);
  }

  return true;
}

// 深度比较两个菜单对象（忽略 ID、parentId、children）
function isMenuEqual(source: Menu, target: Menu): boolean {
  return (
    source.name === target.name &&
    source.path === target.path &&
    source.component === target.component &&
    source.permission === target.permission &&
    source.type === target.type &&
    source.sort === target.sort &&
    source.icon === target.icon &&
    source.status === target.status &&
    source.visible === target.visible &&
    source.keepAlive === target.keepAlive &&
    source.alwaysShow === target.alwaysShow
  );
}

// 同步菜单（新增或更新）
export async function syncMenus(
  sourceMenus: Menu[],
  targetMenus: Menu[],
  targetParentId: number,
  config: ApiConfig,
  onLog?: (message: string) => void
): Promise<{ added: number; updated: number }> {
  let added = 0;
  let updated = 0;

  for (const sourceMenu of sourceMenus) {
    // 在目标中查找是否存在同名菜单
    const targetMenu = targetMenus.find(m => m.name === sourceMenu.name);

    let targetMenuId = targetMenu?.id;

    if (!targetMenu) {
      // 不存在，创建
      if (onLog) onLog(`   ➕ 创建: ${sourceMenu.name}`);
      const { id, parentId, children, createTime, ...menuData } = sourceMenu;
      targetMenuId = await createMenu({ ...menuData, parentId: targetParentId }, config);
      added++;
    } else {
      // 存在，检查是否需要更新
      if (!isMenuEqual(sourceMenu, targetMenu)) {
        if (onLog) onLog(`   📝 更新: ${sourceMenu.name}`);
        const { id, parentId, children, createTime, ...menuData } = sourceMenu;
        await updateMenu({ ...menuData, id: targetMenu.id, parentId: targetParentId }, config);
        updated++;
      }
      // 即使不更新，也要继续处理子菜单
    }

    // 递归处理子菜单
    if (sourceMenu.children && sourceMenu.children.length > 0) {
      // 获取当前目标菜单的最新子菜单列表（如果是刚创建的，列表为空；如果是已存在的，使用其子菜单）
      // 注意：这里如果是刚创建的，targetMenuId 是新的，但我们在内存中没有它的子菜单
      // 如果是已存在的，targetMenu.children可能有值
      
      let currentTargetChildren: Menu[] = [];
      if (targetMenu) {
        currentTargetChildren = targetMenu.children || [];
      }
      
      // 注意：如果是新创建的菜单，我们需要在递归时传递空数组作为 existingMenus
      // 但这里有一个问题：我们刚刚创建了菜单，还需要去 fetch 一次吗？
      // 为了简单起见，我们假设新创建的菜单没有子菜单。
      // 对于已存在的菜单，我们使用传入的 targetMenus 中的 children。
      
      if (targetMenuId) {
         const result = await syncMenus(
          sourceMenu.children,
          currentTargetChildren,
          targetMenuId,
          config,
          onLog
        );
        added += result.added;
        updated += result.updated;
      }
    }
  }

  return { added, updated };
}

