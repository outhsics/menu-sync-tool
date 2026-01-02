"use client";

import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { EnvironmentCard } from '@/components/EnvironmentCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { 
  ArrowRightLeft, 
  RefreshCw, 
  Terminal, 
  ListTree, 
  Zap,
  Github,
  Search
} from 'lucide-react';
import { Menu } from '@/types';
import { fetchMenusAction, createMenuAction, updateMenuAction } from '@/actions/menu';
import { buildMenuTree, isMenuEqual } from '@/lib/menu-utils';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { MenuTreeTable } from '@/components/MenuTreeTable';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { downloadBackup } from "@/lib/backup";

interface LogEntry {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warn' | 'error';
  timestamp: Date;
}

export default function Home() {
  const { source, target, setSource, setTarget, setSourceConnected, setTargetConnected } = useAppStore();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [syncing, setSyncing] = useState(false);
  
  // Data State
  const [sourceTree, setSourceTree] = useState<Menu[]>([]);
  const [targetTree, setTargetTree] = useState<Menu[]>([]);
  const [selectedSystem, setSelectedSystem] = useState<string>('');
  const [selectedMenus, setSelectedMenus] = useState<Set<number>>(new Set());

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [{ id: Math.random().toString(), message, type, timestamp: new Date() }, ...prev].slice(0, 100));
  };

  const loadData = async (env: 'source' | 'target') => {
    const config = env === 'source' ? source : target;
    try {
      addLog(`正在从 ${config.name} 获取菜单数据...`);
      const menus = await fetchMenusAction(config);
      const tree = buildMenuTree(menus);
      if (env === 'source') setSourceTree(tree);
      else setTargetTree(tree);
      addLog(`${config.name} 数据获取成功: ${menus.length} 项`, 'success');
    } catch (error) {
      addLog(`获取 ${config.name} 数据失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
    }
  };

  // Sync Logic
  const handleSync = async () => {
    if (!source.isConnected || !target.isConnected) return;
    setSyncing(true);
    addLog('🚀 启动同步流水线 (Next.js Server Actions)...', 'info');

    try {
        // 📦 Step 1: 备份目标环境数据 (JSON 快照 下载到本地)
        addLog('📦 正在备份目标环境数据...', 'info');
        const targetMenusForBackup = await fetchMenusAction(target);
        downloadBackup(targetMenusForBackup, target.name || 'target');
        addLog(`✅ 备份完成! 已下载 ${targetMenusForBackup.length} 项菜单数据到本地`, 'success');

        // 🔀 Step 2: 正式同步流程
        const selectedRoot = sourceTree.find(m => m.name === selectedSystem);
        if (!selectedRoot) throw new Error('未找到选中的系统');

        // Recursive Sync Engine
        const syncRecursive = async (sourceMenus: Menu[], targetMenus: Menu[], pId: number) => {
            let added = 0;
            let updated = 0;

            for (const sMenu of sourceMenus) {
                const isSelected = selectedMenus.has(sMenu.id);
                
                // 🔒 核心匹配逻辑升级 (Match Logic v2)
                let tMenu = undefined;
                if (sMenu.permission) tMenu = targetMenus.find(m => m.permission === sMenu.permission);
                if (!tMenu && sMenu.path) {
                    if (sMenu.path !== '/' && !sMenu.path.startsWith('http')) {
                         tMenu = targetMenus.find(m => m.path === sMenu.path);
                    }
                }
                if (!tMenu) tMenu = targetMenus.find(m => m.name === sMenu.name);

                let currentId = tMenu?.id;
                let shouldRecurse = false;

                if (isSelected) {
                    // Case 1: 用户勾选了此菜单 -> 执行同步 (新增/更新)
                    if (!tMenu) {
                        addLog(`[CREATE] ${sMenu.name}`, 'info');
                        const { id, parentId, children, createTime, ...data } = sMenu;
                        currentId = await createMenuAction({ ...data, parentId: pId }, target);
                        added++;
                    } else if (!isMenuEqual(sMenu, tMenu)) {
                        addLog(`[UPDATE] ${sMenu.name}`, 'warn');
                        const { id, parentId, children, createTime, ...data } = sMenu;
                        await updateMenuAction({ ...data, id: tMenu.id, parentId: pId }, target);
                        updated++;
                    } else {
                        addLog(`[SKIP] ${sMenu.name} (内容一致)`, 'info');
                    }
                    shouldRecurse = true; 
                } else {
                     // Case 2: 用户没勾选 -> 只有当目标端存在此节点时，才允许同步其子节点
                     if (currentId) {
                         shouldRecurse = true;
                     } 
                     // else: 没勾选且目标端不存在 -> 无法挂载子节点 -> 跳过
                }

                if (shouldRecurse && sMenu.children && sMenu.children.length > 0 && currentId) {
                    const result = await syncRecursive(sMenu.children, tMenu?.children || [], currentId);
                    added += result.added;
                    updated += result.updated;
                }
            }
            return { added, updated };
        };

        // Fix: Don't wrap selectedRoot in array, use its children directly if we are syncing a subtree, 
        // OR better: handle the recursive logic to start FROM the selected items.
        
        // 修正逻辑：我们应该遍历 sourceTree 的顶层，找到 selectedRoot
        // 但是 syncRecursive 的 entry 需要调整。
        // 如果 selectedRoot 本身被选中了，我们得从它开始同步。
        
        // 查找目标环境对应的 Root 节点 (通常是 'CRM系统' 这种顶级目录)
        // 注意：顶级节点通常 parentId = 0
        
        let targetRootId = 0;
        const targetRoot = targetTree.find(m => m.name === selectedRoot.name); // 顶层只按名字/权限粗略匹配
        
        // Root level stats
        let rootAdded = 0;
        let rootUpdated = 0;

        if (targetRoot) {
             targetRootId = targetRoot.id;
             // 如果顶层节点本身也被勾选了，检查是否需要更新
             if (selectedMenus.has(selectedRoot.id) && !isMenuEqual(selectedRoot, targetRoot)) {
                 addLog(`[UPDATE ROOT] ${selectedRoot.name}`, 'warn');
                 const { id, parentId, children, createTime, ...data } = selectedRoot;
                 await updateMenuAction({ ...data, id: targetRoot.id, parentId: 0 }, target);
                 rootUpdated++; // Count root update
             }
        } else if (selectedMenus.has(selectedRoot.id)) {
             // 目标不存在顶层节点，且用户勾选了顶层，则创建
             addLog(`[CREATE ROOT] ${selectedRoot.name}`, 'info');
             const { id, parentId, children, createTime, ...data } = selectedRoot;
             targetRootId = await createMenuAction({ ...data, parentId: 0 }, target);
             rootAdded++;
        } else {
            // 目标不存在顶层，且用户没勾选顶层（这很奇怪，通常应该勾选），
            // 但如果只想同步子菜单，而父菜单不存在，是无法挂载的。
            // 这种情况下，我们假设用户希望同步到根目录下，或者报错提示。
            // 为了安全，如果父节点必选但没选，我们跳过或报错。
            // 现行逻辑：尝试在 target 找同名节点作为 parent。找不到就无法继续。
             if (!targetRoot) {
                 // 如果选了子节点但没选父节点，且目标不存在父节点，这会导致子节点无法挂载
                 // 为简化逻辑，我们强制要求：如果要同步，必须保证父节点存在（要么已存在，要么本次勾选同步）
                 throw new Error(`目标环境缺少顶级节点 "${selectedRoot.name}"。请先勾选该节点以创建它，或确保它已存在于目标环境！`);
             }
             targetRootId = targetRoot.id; // TS should be happy now as we handled !targetRoot
        }

        // 开始递归同步子节点
        // Fix: 即使父节点没被勾选，也需要进入递归，去检查有没有勾选的子节点 (的前提是父节点在目标端已存在)
        const result = await syncRecursive(selectedRoot.children || [], targetRoot?.children || [], targetRootId);
        
        // Add root stats
        result.added += rootAdded;
        result.updated += rootUpdated;
        addLog(`✅ 同步圆满完成! 新增: ${result.added}, 更新: ${result.updated}`, 'success');
        await loadData('target');
    } catch (error) {
        addLog(`❌ 同步中断: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
    } finally {
        setSyncing(false);
    }
  };

  const toggleMenu = (id: number) => {
    setSelectedMenus(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });
  };

  return (
    <div className="min-h-screen text-[var(--foreground)] bg-[var(--background)]">
      
      <nav className="sticky top-0 z-50 border-b border-[var(--border)] bg-white px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-md shadow-blue-200">
              <Zap className="text-white w-6 h-6 fill-white" />
            </div>
            <div>
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                    MenuSync Pro <span className="text-blue-600 text-xs font-mono ml-2 px-1.5 py-0.5 bg-blue-50 rounded-full">v3.0</span>
                </h1>
                <p className="text-[12px] text-gray-500">Enterprise Data Synchronization Tool</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-500 font-mono text-[10px]">BUN 1.3.5</Badge>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 space-y-8 pb-20">
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <EnvironmentCard 
            title="来源环境" 
            config={source} 
            onUpdate={setSource} 
            onConnected={(c) => { setSourceConnected(c); if(c) loadData('source'); }}
          />
          <EnvironmentCard 
            title="目标环境" 
            config={target} 
            onUpdate={setTarget} 
            onConnected={(c) => { setTargetConnected(c); if(c) loadData('target'); }}
          />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Card className="lg:col-span-8 bg-white border-[var(--border)] shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between border-b border-[var(--border)] pb-4">
                    <div>
                        <CardTitle className="text-lg font-bold flex items-center gap-2 text-gray-900">
                            <ListTree className="text-blue-600 w-5 h-5" /> 同步配置面板
                        </CardTitle>
                        <CardDescription className="text-gray-500">选择需要迁移的系统模块及具体菜单项</CardDescription>
                    </div>
                    {selectedMenus.size > 0 && <Badge className="bg-blue-600 text-white hover:bg-blue-600">{selectedMenus.size} 已选</Badge>}
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="relative col-span-2">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10 pointer-events-none" />
                            <Select 
                                value={selectedSystem} 
                                onValueChange={(val) => {
                                    setSelectedSystem(val);
                                    setSelectedMenus(new Set());
                                }}
                            >
                                <SelectTrigger className="w-full h-10 pl-9 bg-white border-gray-200 hover:border-blue-400 focus:ring-2 focus:ring-blue-500/20 data-[state=open]:border-blue-500 transition-all">
                                    <SelectValue placeholder="选择系统平台..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {sourceTree.length === 0 ? (
                                        <div className="p-2 text-sm text-gray-400 text-center">暂无数据，请先连接环境</div>
                                    ) : (
                                        sourceTree.map(m => (
                                            <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button 
                            className="bg-blue-600 hover:bg-blue-500 shadow-sm h-10"
                            disabled={!selectedSystem || syncing}
                            onClick={() => {
                                const sys = sourceTree.find(m => m.name === selectedSystem);
                                if (!sys) return;
                                const ids = new Set<number>();
                                const collect = (m: Menu) => { ids.add(m.id); m.children?.forEach(collect); };
                                ids.add(sys.id);
                                sys.children?.forEach(collect);
                                setSelectedMenus(ids);
                            }}
                        >
                            全选模块
                        </Button>
                    </div>

                  <div className="min-h-[400px] bg-gray-50/50 p-4 border border-dashed border-gray-200 rounded-xl">
                        {selectedSystem ? (
                            <MenuTreeTable 
                                data={sourceTree.find(m => m.name === selectedSystem)?.children || []}
                                selectedMenus={selectedMenus}
                                onToggle={toggleMenu}
                                onSelectAll={setSelectedMenus}
                                disabled={syncing}
                            />
                        ) : (
                            <div className="h-[360px] flex flex-col items-center justify-center text-slate-500 space-y-3 opacity-30">
                                <Search className="w-12 h-12 stroke-[1]" />
                                <p className="text-sm font-medium">请先选择一个来源系统以展示菜单树</p>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end pt-4">
                        <Button 
                            size="lg"
                            className="w-full md:w-auto min-w-[200px] bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 border-0 py-6 text-base font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
                            disabled={!selectedSystem || selectedMenus.size === 0 || syncing || !target.isConnected}
                            onClick={handleSync}
                        >
                            {syncing ? (
                                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                            ) : (
                                <Zap className="w-5 h-5 mr-2 fill-current" />
                            )}
                            {syncing ? '极速同步中...' : '开始执行双机同步'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="lg:col-span-4 bg-white border-[var(--border)] shadow-sm flex flex-col max-h-[750px] group">
                <CardHeader className="bg-gray-50 p-4 border-b border-[var(--border)]">
                    <CardTitle className="text-[12px] font-bold font-mono flex items-center gap-2 text-gray-500 tracking-widest uppercase">
                        <Terminal className="w-3.5 h-3.5" /> 操作日志
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 p-4 font-mono text-[12px] leading-relaxed space-y-2 overflow-y-auto overflow-x-hidden scrollbar-thin">
                    <AnimatePresence>
                        {logs.length === 0 && <div className="text-gray-400 text-center py-20 italic font-sans flex flex-col items-center gap-2"><div className="w-8 h-8 rounded-full bg-gray-100 mb-2" />等待操作指令...</div>}
                        {logs.map((log) => (
                            <motion.div 
                                key={log.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className={cn(
                                    "border-b border-gray-50 pb-1.5 flex gap-2 transition-all",
                                    log.type === 'error' ? "text-red-500 bg-red-50 px-1 rounded" : 
                                    log.type === 'success' ? "text-green-600 bg-green-50 px-1 rounded" : 
                                    log.type === 'warn' ? "text-orange-500" : "text-gray-600"
                                )}
                            >
                                <span className="text-slate-600 shrink-0 font-medium">[{log.timestamp.toLocaleTimeString()}]</span>
                                <span className="flex-1">{log.message}</span>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </CardContent>
            </Card>
        </section>
      </main>
    </div>
  );
}
