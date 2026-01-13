"use client";

import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { EnvironmentCard } from '@/components/EnvironmentCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  RefreshCw, 
  ListTree, 
  Zap,
  Search,
  ArrowRightLeft,
  Terminal
} from 'lucide-react';
import { DiffNode } from '@/types';
import { fetchMenusAction, createMenuAction, updateMenuAction } from '@/actions/menu';
import { buildMenuTree } from '@/lib/menu-utils';
import { buildDiffTree, countDiffStats } from '@/lib/diff-engine';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { MenuDiffTable } from '@/components/MenuDiffTable';
import { LoginModal } from '@/components/LoginModal';

// 日志条目接口
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
  const [analyzing, setAnalyzing] = useState(false);
  
  // 数据状态
  const [diffTree, setDiffTree] = useState<DiffNode[]>([]);
  const [selectedSystem, setSelectedSystem] = useState<string>('');
  const [selectedMenus, setSelectedMenus] = useState<Set<number>>(new Set());
  const [stats, setStats] = useState({ added: 0, updated: 0, same: 0 });

  // 添加日志函数
  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [{ id: Math.random().toString(), message, type, timestamp: new Date() }, ...prev].slice(0, 100));
  };

  // 分析差异逻辑
  const handleAnalyze = async () => {
    if (!source.isConnected || !target.isConnected) {
        addLog('请先连接两个环境', 'warn');
        return;
    }
    
    setAnalyzing(true);
    setDiffTree([]);
    setSelectedSystem('');
    setStats({ added: 0, updated: 0, same: 0 });
    
    try {
        if (source.apiBase === target.apiBase && source.tenantId === target.tenantId) {
            addLog('⚠️ 警告: 来源环境与目标环境配置完全一致！请确认您是否连接了正确的环境。', 'warn');
        }

        addLog('📥 正在并行获取双端数据...', 'info');
        
        const [sourceMenus, targetMenus] = await Promise.all([
            fetchMenusAction(source),
            fetchMenusAction(target)
        ]);

        addLog(`📊 数据获取成功: 来源(${sourceMenus.length}) / 目标(${targetMenus.length})`, 'success');
        addLog('🔄 正在计算差异树...', 'info');

        // 1. 构建标准树
        const sTree = buildMenuTree(sourceMenus);
        const tTree = buildMenuTree(targetMenus);

        // 2. 构建差异树 (根层级)
        const diff = buildDiffTree(sTree, tTree);
        
        setDiffTree(diff);
        
        // 3. 统计差异
        const counts = countDiffStats(diff);
        setStats(counts);

        if (counts.added === 0 && counts.updated === 0) {
            addLog('✅ 两个环境完全一致，无需同步', 'success');
        } else {
            addLog(`⚠️ 发现差异: ${counts.added} 个新增, ${counts.updated} 个变更`, 'warn');
        }

    } catch (error) {
        addLog(`❌ 分析失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
    } finally {
        setAnalyzing(false);
    }
  };

  // 同步执行逻辑
    const handleSync = async () => {
    if (!source.isConnected || !target.isConnected || diffTree.length === 0) return;
    setSyncing(true);
    
    // Auto Backup
    try {
        addLog('💾 正在备份目标环境菜单...', 'info');
        const backupData = await fetchMenusAction(target);
        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `menu_backup_target_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        addLog('✅ 备份文件已下载', 'success');
    } catch (e) {
        addLog('❌ 备份失败，但继续执行同步', 'warn');
        console.error(e);
    }

    addLog('🚀 启动增量同步...', 'info');

    try {
        const rootNode = diffTree.find(m => m.name === selectedSystem);
        if (!rootNode) throw new Error('未找到选中的系统');

        let successCount = 0;

        // 递归同步函数
        const syncRecursive = async (nodes: DiffNode[], parentId: number) => {
            for (const node of nodes) {
                const isSelected = selectedMenus.has(node.id);
                // 默认使用该节点已有的目标ID（如果存在）
                let currentTargetId = node.targetId;

                if (isSelected) {
                    // 构造请求数据：使用白名单模式，严防 Source ID 混入
                    const s = node.sourceMenu || node;
                    
                    const payload = {
                        name: s.name,
                        permission: s.permission,
                        type: s.type,
                        sort: s.sort,
                        parentId: parentId, // 使用递归上下文中的 parentId (目标环境的父ID)
                        path: s.path,
                        icon: s.icon,
                        component: s.component,
                        componentName: s.componentName,
                        status: s.status, // 原始状态 (number)
                        visible: s.visible,
                        keepAlive: s.keepAlive,
                        alwaysShow: s.alwaysShow,
                        systemType: s.systemType ?? 0
                    };

                    if (node.status === 'NEW') {
                         addLog(`正在创建: ${node.name}`, 'info');
                         currentTargetId = await createMenuAction(payload, target);
                         successCount++;
                    } else if (node.status === 'UPDATE' && node.targetId) {
                         addLog(`正在更新: ${node.name}`, 'warn');
                         // 更新时，必须传入目标环境的 ID (node.targetId)，绝对不能传 source.id
                         await updateMenuAction({ ...payload, id: node.targetId }, target);
                         successCount++;
                    }
                }

                // 如果当前节点在该环境已有有效ID（无论是刚创建的还是已存在的），则继续递归处理子节点
                if (currentTargetId && node.children && node.children.length > 0) {
                    await syncRecursive(node.children, currentTargetId);
                }
            }
        };

        // 处理根节点同步
        // 如果根节点在目标端不存在，且未被选中，则无法继续挂载子节点
        if (!rootNode.targetId && !selectedMenus.has(rootNode.id)) {
            throw new Error(`根节点 [${rootNode.name}] 不存在且未选中同步，无法同步子节点`);
        }

        let rootTargetId = rootNode.targetId;
        
        // 如果选中了根节点，先处理根节点
        if (selectedMenus.has(rootNode.id)) {
             const s = rootNode.sourceMenu || rootNode;
             const payload = {
                 name: s.name,
                 permission: s.permission,
                 type: s.type,
                 sort: s.sort,
                 parentId: 0,
                 path: s.path,
                 icon: s.icon,
                 component: s.component,
                 componentName: s.componentName,
                 status: s.status,
                 visible: s.visible,
                 keepAlive: s.keepAlive,
                 alwaysShow: s.alwaysShow,
                 systemType: s.systemType ?? 0
             };

             if (rootNode.status === 'NEW') {
                 addLog(`创建根节点: ${rootNode.name}`, 'info');
                 rootTargetId = await createMenuAction(payload, target);
                 successCount++;
             } else if (rootNode.status === 'UPDATE' && rootNode.targetId) {
                 addLog(`更新根节点: ${rootNode.name}`, 'warn');
                 await updateMenuAction({ ...payload, id: rootNode.targetId }, target);
                 successCount++;
             }
        }
        
        // 递归处理子树
        if (rootTargetId && rootNode.children) {
            await syncRecursive(rootNode.children, rootTargetId);
        }

        addLog(`✅ 同步完成! 成功处理: ${successCount} 项`, 'success');
        
        // 重新分析以刷新状态
        await handleAnalyze();

    } catch (error) {
        addLog(`❌ 同步失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
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

  // 级联勾选：点击父级时，同时勾选/取消所有子级
  const toggleMenuWithChildren = (id: number, allDescendantIds: number[]) => {
    setSelectedMenus(prev => {
        const next = new Set(prev);
        const isCurrentlySelected = allDescendantIds.every(childId => prev.has(childId));
        
        if (isCurrentlySelected) {
            // 当前全选 -> 取消全部
            allDescendantIds.forEach(childId => next.delete(childId));
        } else {
            // 未全选 -> 全选
            allDescendantIds.forEach(childId => next.add(childId));
        }
        return next;
    });
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-slate-900 font-sans selection:bg-blue-100">
      
      <nav className="sticky top-0 z-50 bg-[#141414] px-6 py-4 shadow-sm border-b border-white/5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Zap className="text-white w-6 h-6 fill-white" />
            </div>
            <div>
                <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                    MenuSync Pro <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">v3.1 DIFF</span>
                </h1>
                <p className="text-[10px] text-slate-400 font-mono">Next.js 15 + React 19 + Diff Engine</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <LoginModal />
            <Badge variant="outline" className="border-white/10 bg-white/5 text-slate-400 font-mono text-[10px]">RUNTIME: BUN 1.3.5</Badge>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 space-y-8 pb-20">
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 hidden md:block">
            <div className="bg-white border border-slate-200 p-2 rounded-full shadow-lg text-slate-400">
                <ArrowRightLeft className="w-5 h-5" />
            </div>
          </div>
          <EnvironmentCard 
            title="来源环境" 
            config={source} 
            onUpdate={setSource} 
            onConnected={(c) => setSourceConnected(c)}
          />
          <EnvironmentCard 
            title="目标环境" 
            config={target} 
            onUpdate={setTarget} 
            onConnected={(c) => setTargetConnected(c)}
          />
        </section>

        {/* 全局操作栏 */}
        <section className="flex justify-center">
             <Button 
                size="lg" 
                className={cn(
                    "w-full max-w-md h-12 text-lg shadow-xl shadow-blue-200/50 transition-all",
                    analyzing 
                        ? "bg-slate-300 cursor-not-allowed text-slate-500" 
                        : "bg-blue-600 hover:bg-blue-500 hover:scale-105 active:scale-95"
                )}
                disabled={!source.isConnected || !target.isConnected || analyzing}
                onClick={handleAnalyze}
             >
                {analyzing ? (
                    <>
                        <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                        正在分析差异...
                    </>
                ) : (
                    <>
                        <Search className="mr-2 h-5 w-5" />
                        开始对比分析 (Diff Analysis)
                    </>
                )}
             </Button>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Card className="lg:col-span-8 bg-white border-slate-200 shadow-xl shadow-slate-200/50">
                <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-slate-100">
                    <div>
                        <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-800">
                            <ListTree className="text-blue-600 w-5 h-5" /> 差异对比面板
                            {diffTree.length > 0 && (
                                <span className="ml-2 flex gap-2 text-xs font-normal">
                                    <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">+{stats.added} 新增</Badge>
                                    <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">~{stats.updated} 变更</Badge>
                                </span>
                            )}
                        </CardTitle>
                        <CardDescription className="text-slate-500">对比结果预览，请勾选需要同步的项目</CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                    {/* 系统选择器 */}
                     <div className="relative">
                        <select 
                            className="w-full h-10 pl-4 pr-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:ring-2 ring-blue-500/20 focus:border-blue-500 appearance-none disabled:opacity-50 transition-all cursor-pointer hover:border-blue-300"
                            value={selectedSystem}
                            disabled={diffTree.length === 0}
                            onChange={(e) => {
                                setSelectedSystem(e.target.value);
                                setSelectedMenus(new Set()); // 切换系统时清空选择
                            }}
                        >
                            <option value="">{diffTree.length === 0 ? "请先执行分析..." : "选择需要同步的系统模块..."}</option>
                            {diffTree.map(m => (
                                <option key={m.id} value={m.name} className="bg-white text-slate-900">
                                    {m.name} ({m.status === 'SAME' ? '无变更' : `${m.status}`})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="min-h-[400px] bg-slate-50 p-4 border border-slate-100 rounded-xl">
                        {selectedSystem ? (
                            <MenuDiffTable 
                                data={diffTree.find(m => m.name === selectedSystem)?.children || []} // 显示选中系统的子节点
                                selectedMenus={selectedMenus}
                                onToggle={toggleMenu}
                                onToggleWithChildren={toggleMenuWithChildren}
                                onSelectAll={setSelectedMenus}
                                disabled={syncing}
                            />
                        ) : (
                            <div className="h-[360px] flex flex-col items-center justify-center text-slate-400 space-y-3 opacity-60">
                                <Search className="w-12 h-12 stroke-[1]" />
                                <p className="text-sm font-medium">请先执行分析，并选择一个系统以查看差异</p>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end pt-4 gap-4 items-center border-t border-slate-100">
                         <div className="text-xs text-slate-500">
                            已选择 {selectedMenus.size} 个同步项
                         </div>
                        <Button 
                            size="lg"
                            className="w-full md:w-auto min-w-[200px] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/30 border-0 py-6 text-base font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
                            disabled={!selectedSystem || selectedMenus.size === 0 || syncing}
                            onClick={handleSync}
                        >
                            {syncing ? (
                                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                            ) : (
                                <Zap className="w-5 h-5 mr-2 fill-current" />
                            )}
                            {syncing ? '正在同步...' : '执行选中同步'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="lg:col-span-4 bg-[#0f172a] border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[850px] group">
                <CardHeader className="bg-slate-900/50 p-4 border-b border-white/5">
                    <CardTitle className="text-[10px] font-bold font-mono flex items-center gap-2 text-slate-500 tracking-widest uppercase">
                        <Terminal className="w-3.5 h-3.5" /> SYNC_OPERATION_LOGS
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 p-4 font-mono text-[11px] leading-relaxed space-y-2 overflow-y-auto overflow-x-hidden scrollbar-none">
                    <AnimatePresence>
                        {logs.length === 0 && <div className="text-slate-700 text-center py-20 italic font-sans">等待操作指令...</div>}
                        {logs.map((log) => (
                            <motion.div 
                                key={log.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className={cn(
                                    "border-b border-white/5 pb-1.5 flex gap-2 transition-all",
                                    log.type === 'error' ? "text-red-400 bg-red-400/5 px-1 rounded" : 
                                    log.type === 'success' ? "text-green-400 bg-green-400/5 px-1 rounded" : 
                                    log.type === 'warn' ? "text-amber-400" : "text-slate-400"
                                )}
                            >
                                <span className="text-slate-600 shrink-0 font-medium">[{log.timestamp.toLocaleTimeString()}]</span>
                                <span className="flex-1 break-all">{log.message}</span>
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
