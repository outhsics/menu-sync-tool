// ============================================
// 菜单同步工具 - 测试版本
// ============================================

// 获取当前配置（直接从输入框读取，不使用缓存）
function getConfig() {
  return {
    apiBase: document.getElementById('apiBase').value,
    token: document.getElementById('token').value.trim(),
    tenantId: document.getElementById('tenantId').value
  };
}

// 全局菜单数据
let allMenuData = null;
let crmMenuTree = null;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('apiBase').value = 'https://dev-api.bangyangjia.com';
  document.getElementById('tenantId').value = '1';
});

// 清空输入框
function clearConfig() {
  document.getElementById('apiBase').value = 'https://dev-api.bangyangjia.com';
  document.getElementById('token').value = '';
  document.getElementById('tenantId').value = '1';

  log('🗑️  配置已清除');
  showStatus('configStatus', '✅ 配置已清除', 'success');
}

// 保存配置（仅用于验证，不存储到缓存）
function saveConfig() {
  const config = getConfig();

  log('💾 配置已验证');
  log('   API 地址: ' + config.apiBase);
  log('   Token: ' + config.token.substring(0, 10) + '...' + config.token.substring(config.token.length - 4));
  log('   Token 长度: ' + config.token.length);
  log('   租户 ID: ' + config.tenantId);

  showStatus('configStatus', '✅ 配置已验证', 'success');
}

// 显示状态消息
function showStatus(elementId, message, type) {
  const element = document.getElementById(elementId);
  element.textContent = message;
  element.className = 'status ' + type;
  element.style.display = 'block';
}

// 添加日志
function log(message) {
  const logDiv = document.getElementById('log');
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.textContent = message;
  logDiv.appendChild(entry);
  logDiv.scrollTop = logDiv.scrollHeight;
  console.log(message);
}

// 清空日志
function clearLog() {
  document.getElementById('log').innerHTML = '';
}

// 测试连接
async function testConnection() {
  const config = getConfig();

  log('🔍 测试连接到: ' + config.apiBase);
  log('🔑 配置中的 Token: ' + config.token.substring(0, 10) + '...' + config.token.substring(config.token.length - 4));
  log('🔑 Token 长度: ' + config.token.length + ' 个字符');
  log('🏢 租户 ID: ' + config.tenantId);
  showStatus('configStatus', '正在测试连接...', 'info');

  try {
    const requestHeaders = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + config.token,
      'tenant-id': config.tenantId
    };

    log('📤 请求头 Authorization: ' + requestHeaders.Authorization.substring(0, 20) + '...');

    const response = await fetch(config.apiBase + '/admin-api/system/menu/list', {
      method: 'GET',
      headers: requestHeaders
    });

    if (response.ok) {
      const result = await response.json();
      if (result.code === 0) {
        const allMenus = result.data;

        function buildTree(parentId = 0) {
          return allMenus
            .filter(m => m.parentId === parentId)
            .sort((a, b) => a.sort - b.sort)
            .map(m => ({ ...m, children: buildTree(m.id) }));
        }

        const tree = buildTree(0);
        const crm = tree.find(m => m.name === 'CRM 系统');

        if (crm) {
          log('✅ 连接成功');
          log('📊 系统菜单统计');
          log('   全部菜单总数: ' + allMenus.length + ' 个（包括所有系统）');
          log('   ✅ 找到 CRM 系统');
          log('   📦 CRM 下菜单总数: ' + countAllMenus(crm.children) + ' 个（包括所有层级）');
          log('   📋 CRM 直接子菜单: ' + crm.children.length + ' 个');
          showStatus('configStatus', '✅ 连接成功！找到 CRM 系统', 'success');
        } else {
          log('✅ 连接成功，但未找到 CRM 系统');
          log('📊 系统菜单总数: ' + allMenus.length + ' 个');
          log('⚠️  未找到【CRM 系统】菜单，无法继续导出');
          showStatus('configStatus', '⚠️ 未找到 CRM 系统', 'error');
        }
      } else {
        showStatus('configStatus', '❌ 错误: ' + result.msg, 'error');
        log('❌ 错误: ' + result.msg);
        log('💡 提示：请检查 Token 是否正确');
        log('💡 Token 长度应为 32 个字符，当前长度: ' + config.token.length);
      }
    } else {
      showStatus('configStatus', '❌ HTTP ' + response.status, 'error');
      log('❌ HTTP ' + response.status);
      log('💡 提示：请检查 Token 是否正确或是否已过期');
    }
  } catch (error) {
    showStatus('configStatus', '❌ 连接失败: ' + error.message, 'error');
    log('❌ 连接失败: ' + error.message);
  }
}

// 统计所有菜单数量
function countAllMenus(menuList) {
  let count = 0;
  menuList.forEach(m => {
    count++;
    if (m.children && m.children.length > 0) {
      count += countAllMenus(m.children);
    }
  });
  return count;
}

// 加载菜单树
async function loadMenuTree() {
  const config = getConfig();

  log('🌳 加载菜单树...');
  showStatus('configStatus', '正在加载菜单...', 'info');

  try {
    const response = await fetch(config.apiBase + '/admin-api/system/menu/list', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + config.token,
        'tenant-id': config.tenantId
      }
    });

    if (!response.ok) {
      throw new Error('HTTP ' + response.status);
    }

    const result = await response.json();

    if (result.code !== 0) {
      throw new Error(result.msg || '获取菜单失败');
    }

    allMenuData = result.data;
    log('✅ 获取到 ' + allMenuData.length + ' 个菜单');

    function buildTree(parentId = 0) {
      return allMenuData
        .filter(m => m.parentId === parentId)
        .sort((a, b) => a.sort - b.sort)
        .map(m => ({ ...m, children: buildTree(m.id) }));
    }

    const tree = buildTree(0);
    const crm = tree.find(m => m.name === 'CRM 系统');

    if (!crm) {
      throw new Error('未找到 CRM 系统菜单');
    }

    crmMenuTree = crm;
    log('✅ 找到 CRM 系统');

    renderMenuTree(crm);
    document.getElementById('menuTreeSection').style.display = 'block';
    showStatus('configStatus', '✅ 菜单树加载成功', 'success');

  } catch (error) {
    showStatus('configStatus', '❌ 加载失败: ' + error.message, 'error');
    log('❌ 加载失败: ' + error.message);
  }
}

// 渲染菜单树
function renderMenuTree(crm) {
  const container = document.getElementById('menuTree');
  container.innerHTML = '';

  function getTypeName(type) {
    const types = { 1: '目录', 2: '菜单', 3: '按钮' };
    return types[type] || '未知';
  }

  function createMenuItem(menu, level = 0) {
    const hasChildren = menu.children && menu.children.length > 0;

    const itemDiv = document.createElement('div');
    itemDiv.className = 'menu-item';

    // 展开/收起图标
    if (hasChildren) {
      const toggleIcon = document.createElement('span');
      toggleIcon.className = 'toggle-icon';
      toggleIcon.textContent = '▼';
      toggleIcon.style.cursor = 'pointer';
      toggleIcon.style.marginRight = '6px';
      toggleIcon.style.fontSize = '10px';
      toggleIcon.style.transition = 'transform 0.2s';
      toggleIcon.onclick = (e) => {
        e.stopPropagation();
        const childrenDiv = itemDiv.nextElementSibling;
        if (childrenDiv && childrenDiv.classList.contains('menu-children')) {
          const isHidden = childrenDiv.style.display === 'none';
          childrenDiv.style.display = isHidden ? 'block' : 'none';
          toggleIcon.textContent = isHidden ? '▼' : '▶';
          toggleIcon.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(-90deg)';
        }
      };
      itemDiv.appendChild(toggleIcon);
    } else {
      // 占位符，保持对齐
      const spacer = document.createElement('span');
      spacer.style.display = 'inline-block';
      spacer.style.width = '16px';
      spacer.style.marginRight = '6px';
      itemDiv.appendChild(spacer);
    }

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    checkbox.dataset.menuId = menu.id;
    checkbox.dataset.menuName = menu.path || menu.name;
    checkbox.addEventListener('change', updateSelectedSummary);
    itemDiv.appendChild(checkbox);

    const label = document.createElement('span');
    label.className = 'menu-item-label';
    label.textContent = menu.name;
    itemDiv.appendChild(label);

    const typeBadge = document.createElement('span');
    typeBadge.className = 'menu-type-badge type-' + menu.type;
    typeBadge.textContent = getTypeName(menu.type);
    itemDiv.appendChild(typeBadge);

    const countSpan = document.createElement('span');
    countSpan.className = 'menu-item-count';
    const childCount = countAllMenus(menu.children || []);
    if (childCount > 0) {
      countSpan.textContent = '(' + childCount + ' 项)';
    }
    itemDiv.appendChild(countSpan);

    const container = document.createElement('div');
    container.appendChild(itemDiv);

    if (hasChildren) {
      const childrenDiv = document.createElement('div');
      childrenDiv.className = 'menu-children';
      menu.children.forEach(child => {
        childrenDiv.appendChild(createMenuItem(child, level + 1));
      });
      container.appendChild(childrenDiv);
    }

    return container;
  }

  if (crm.children && crm.children.length > 0) {
    crm.children.forEach(child => {
      container.appendChild(createMenuItem(child));
    });
  }

  updateSelectedSummary();
}

// 更新选中摘要
function updateSelectedSummary() {
  const checkboxes = document.querySelectorAll('#menuTree input[type="checkbox"]');
  const checked = Array.from(checkboxes).filter(cb => cb.checked);

  const summary = document.getElementById('selectedSummary');
  if (checked.length > 0) {
    summary.style.display = 'block';
    summary.textContent = '已选择 ' + checked.length + ' 个菜单';
  } else {
    summary.style.display = 'none';
  }
}

// 全选菜单
function selectAllMenus() {
  const checkboxes = document.querySelectorAll('#menuTree input[type="checkbox"]');
  checkboxes.forEach(cb => cb.checked = true);
  updateSelectedSummary();
}

// 取消全选菜单
function deselectAllMenus() {
  const checkboxes = document.querySelectorAll('#menuTree input[type="checkbox"]');
  checkboxes.forEach(cb => cb.checked = false);
  updateSelectedSummary();
}

// 展开所有菜单
function expandAllMenus() {
  const childrenDivs = document.querySelectorAll('#menuTree .menu-children');
  childrenDivs.forEach(div => div.style.display = 'block');

  const toggleIcons = document.querySelectorAll('#menuTree .toggle-icon');
  toggleIcons.forEach(icon => {
    icon.textContent = '▼';
    icon.style.transform = 'rotate(0deg)';
  });
}

// 收起所有菜单
function collapseAllMenus() {
  const childrenDivs = document.querySelectorAll('#menuTree .menu-children');
  childrenDivs.forEach(div => div.style.display = 'none');

  const toggleIcons = document.querySelectorAll('#menuTree .toggle-icon');
  toggleIcons.forEach(icon => {
    icon.textContent = '▶';
    icon.style.transform = 'rotate(-90deg)';
  });
}

// 导出选中的菜单
function exportSelectedMenus() {
  log('🚀 开始导出选中的菜单...');
  showStatus('exportStatus', '正在导出...', 'info');

  try {
    const checkboxes = document.querySelectorAll('#menuTree input[type="checkbox"]:checked');

    if (checkboxes.length === 0) {
      showStatus('exportStatus', '⚠️ 请至少选择一个菜单', 'error');
      log('❌ 未选择任何菜单');
      return;
    }

    log('✅ 已选择 ' + checkboxes.length + ' 个菜单');

    const selectedIds = Array.from(checkboxes).map(cb => parseInt(cb.dataset.menuId));

    const exportData = {};
    let totalCount = 0;

    function extractMenusWithPath(menuList, parentId = null, parentPath = []) {
      let result = [];

      menuList.forEach(menu => {
        if (!selectedIds.includes(menu.id)) {
          // 如果当前菜单未选中，检查子菜单
          if (menu.children && menu.children.length > 0) {
            result = result.concat(extractMenusWithPath(menu.children, parentId, parentPath));
          }
          return;
        }

        const menuData = {
          name: menu.name,
          path: menu.path,
          component: menu.component,
          permission: menu.permission,
          type: menu.type,
          sort: menu.sort,
          icon: menu.icon,
          status: menu.status,
          visible: menu.visible,
          keepAlive: menu.keepAlive,
          alwaysShow: menu.alwaysShow,
          children: []
        };

        if (menu.children && menu.children.length > 0) {
          menuData.children = extractMenusWithPath(menu.children, menu.id, [...parentPath, menu.name]);
        }

        result.push(menuData);
      });

      return result;
    }

    // 按工作台分组
    if (crmMenuTree && crmMenuTree.children) {
      crmMenuTree.children.forEach(workbench => {
        const menus = extractMenusWithPath(workbench.children || []);
        const count = countAllMenus(menus);

        if (count > 0) {
          exportData[workbench.name] = { subMenus: menus };
          totalCount += count;

          const topCount = menus.length;
          const subCount = count - topCount;

          log('📦 【' + workbench.name + '】');
          log('   顶级菜单: ' + topCount + ' 个');
          log('   子菜单总数: ' + subCount + ' 个');
          log('   累计: ' + count + ' 个菜单');
          log('');
        }
      });
    }

    const dataStr = 'const MENU_DATA = ' + JSON.stringify(exportData, null, 2);
    document.getElementById('exportData').value = dataStr;

    showStatus('exportStatus', '✅ 导出成功！共 ' + totalCount + ' 个菜单', 'success');
    log('✅ 导出完成，共 ' + totalCount + ' 个菜单');

  } catch (error) {
    showStatus('exportStatus', '❌ 导出失败: ' + error.message, 'error');
    log('❌ 导出失败: ' + error.message);
  }
}

// 复制导出数据
function copyExportData() {
  const exportData = document.getElementById('exportData');
  exportData.select();
  document.execCommand('copy');
  showStatus('exportStatus', '✅ 已复制到剪贴板！', 'success');
  log('✅ 数据已复制到剪贴板');
}

// 创建菜单
async function createMenu(menu, parentId, config) {
  const newMenu = {
    name: menu.name,
    path: menu.path,
    component: menu.component,
    permission: menu.permission,
    type: menu.type,
    sort: menu.sort,
    icon: menu.icon,
    status: menu.status,
    visible: menu.visible,
    keepAlive: menu.keepAlive,
    alwaysShow: menu.alwaysShow,
    parentId: parentId
  };

  delete newMenu.children;

  log('      ➕ ' + menu.name + ' (type=' + menu.type + ')');

  const response = await fetch(config.apiBase + '/admin-api/system/menu/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + config.token,
      'tenant-id': config.tenantId
    },
    body: JSON.stringify(newMenu)
  });

  const result = await response.json();

  if (result.code === 0) {
    const newId = result.data;
    log('      ✅ 成功! ID: ' + newId);

    if (menu.children && menu.children.length > 0) {
      for (const child of menu.children) {
        await createMenu(child, newId, config);
      }
    }

    return newId;
  } else {
    log('      ❌ 失败: ' + result.msg);
    log('      📄 请求参数: ' + JSON.stringify(newMenu, null, 2));
    throw new Error(result.msg);
  }
}

// 同步菜单
async function syncMenus(importingMenus, existingMenus, parentId, config) {
  let addedCount = 0;

  for (const importingMenu of importingMenus) {
    const existing = existingMenus.find(m => m.name === importingMenu.name);

    if (!existing) {
      log('   ➕ 创建新菜单: ' + importingMenu.name);
      const newId = await createMenu(importingMenu, parentId, config);
      if (newId) addedCount++;
    } else {
      const importingChildren = importingMenu.children || [];
      const existingChildren = existing.children || [];

      if (importingChildren.length > 0) {
        const missingChildren = importingChildren.filter(ic =>
          !existingChildren.some(ec => ec.name === ic.name)
        );

        if (missingChildren.length > 0) {
          log('   🔄 补充菜单【' + importingMenu.name + '】的子菜单');
          log('      已有: ' + existingChildren.map(c => c.name).join(', '));
          log('      待补充: ' + missingChildren.map(c => c.name).join(', '));

          for (const missingChild of missingChildren) {
            const newId = await createMenu(missingChild, existing.id, config);
            if (newId) addedCount++;
          }
        }

        for (const importingChild of importingChildren) {
          const existingChild = existingChildren.find(ec => ec.name === importingChild.name);
          if (existingChild && importingChild.children && importingChild.children.length > 0) {
            const childAddedCount = await syncMenus(importingChild.children, existingChild.children || [], existingChild.id, config);
            addedCount += childAddedCount;
          }
        }
      }
    }
  }

  return addedCount;
}

// 导入菜单
async function importMenus() {
  const config = getConfig();
  const importData = document.getElementById('importData').value.trim();

  if (!importData) {
    showStatus('importStatus', '❌ 请先粘贴要导入的数据', 'error');
    return;
  }

  log('🚀 开始导入菜单...');
  showStatus('importStatus', '正在导入...', 'info');

  try {
    let jsonStr = importData;
    if (importData.includes('const MENU_DATA = ')) {
      jsonStr = importData.split('const MENU_DATA = ')[1];
    }
    jsonStr = jsonStr.trim().replace(/;$/, '');
    const menuData = JSON.parse(jsonStr);

    log('✅ 数据解析成功');
    log('📦 包含工作台: ' + Object.keys(menuData).join(', '));

    const response = await fetch(config.apiBase + '/admin-api/system/menu/list', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + config.token,
        'tenant-id': config.tenantId
      }
    });

    if (!response.ok) {
      throw new Error('HTTP ' + response.status);
    }

    const result = await response.json();

    if (result.code !== 0) {
      throw new Error(result.msg);
    }

    const currentMenus = result.data;
    log('✅ 当前环境已有 ' + currentMenus.length + ' 个菜单');

    function buildTree(parentId = 0) {
      return currentMenus
        .filter(m => m.parentId === parentId)
        .sort((a, b) => a.sort - b.sort)
        .map(m => ({ ...m, children: buildTree(m.id) }));
    }

    const tree = buildTree(0);
    const crm = tree.find(m => m.name === 'CRM 系统');

    if (!crm) {
      throw new Error('当前环境未找到 CRM 系统');
    }

    log('✅ 找到 CRM 系统');

    let totalAdded = 0;
    let totalFailed = 0;

    for (const workbenchName of Object.keys(menuData)) {
      const data = menuData[workbenchName];

      log('\n📋 处理【' + workbenchName + '】');

      const workbench = crm.children.find(m => m.name === workbenchName);

      if (!workbench) {
        log('⚠️  未找到工作台: ' + workbenchName);
        continue;
      }

      log('📌 工作台 ID: ' + workbench.id);

      const existingSubMenus = workbench.children || [];
      log('✅ 已有 ' + existingSubMenus.length + ' 个子菜单');
      log('📦 需要导入 ' + data.subMenus.length + ' 个菜单');

      try {
        const addedCount = await syncMenus(data.subMenus, existingSubMenus, workbench.id, config);
        totalAdded += addedCount;

        if (addedCount === 0) {
          log('✅ 所有菜单已存在');
        } else {
          log('✅ 本次同步添加了 ' + addedCount + ' 个菜单');
        }
      } catch (error) {
        log('❌ 同步失败: ' + error.message);
        totalFailed++;
      }
    }

    log('\n' + '='.repeat(70));
    log('📊 同步结果');
    log('='.repeat(70));
    log('✅ 成功添加: ' + totalAdded + ' 个菜单');
    log('❌ 失败: ' + totalFailed + ' 个菜单');
    log('='.repeat(70));

    if (totalAdded > 0) {
      showStatus('importStatus', '✅ 成功添加 ' + totalAdded + ' 个菜单！', 'success');
    } else if (totalFailed === 0) {
      showStatus('importStatus', '✅ 所有菜单已存在，无需添加', 'success');
    } else {
      showStatus('importStatus', '❌ 添加失败：' + totalFailed + ' 个菜单', 'error');
    }

  } catch (error) {
    showStatus('importStatus', '❌ 导入失败: ' + error.message, 'error');
    log('❌ 导入失败: ' + error.message);
  }
}
