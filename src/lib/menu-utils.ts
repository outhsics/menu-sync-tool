import { Menu } from "@/types";

export function buildMenuTree(menus: Menu[], parentId: number = 0): Menu[] {
  return menus
    .filter(m => m.parentId === parentId)
    .sort((a, b) => a.sort - b.sort)
    .map(m => ({ ...m, children: buildMenuTree(menus, m.id) }));
}

export function isMenuEqual(source: Menu, target: Menu): boolean {
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
