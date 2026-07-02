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
import { ThemeToggle } from '@/components/ThemeToggle';

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
    <div className="min-h-screen bg-background text-foreground font-sans">

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-blue-700 flex items-center justify-center shadow-lg shadow-primary/25">
              <Zap className="text-primary-foreground w-5 h-5 fill-primary-foreground" />
              <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/20" />
            </div>
            <div className="flex flex-col">
                <h1 className="text-base font-bold text-foreground tracking-tight leading-none flex items-center gap-2">
                    MenuSync Pro
                    <span className="bg-muted text-muted-foreground text-[10px] px-1.5 py-0.5 rounded-md font-mono font-medium border border-border">v3.1 DIFF</span>
                </h1>
                <p className="text-xs text-muted-foreground font-mono mt-1">Next.js 16 · React 19 · Diff Engine</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <LoginModal />
            <Badge variant="outline" className="hidden sm:inline-flex border-border bg-muted/60 text-muted-foreground font-mono text-[10px]">RUNTIME · BUN 1.3.5</Badge>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 pb-20">
        {/* Environment Section */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-5 relative">
          {/* Center connector */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 hidden md:block">
            <div className="bg-card border border-border p-2.5 rounded-full shadow-lg text-primary">
                <ArrowRightLeft className="w-4 h-4" />
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

        {/* Primary CTA - Analyze */}
        <section className="flex justify-center">
             <Button
                size="lg"
                className={cn(
                    "w-full max-w-md h-12 text-base font-semibold shadow-lg shadow-primary/20 transition-all cursor-pointer",
                    analyzing
                        ? "bg-muted cursor-not-allowed text-muted-foreground shadow-none"
                        : "bg-primary hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0"
                )}
                disabled={!source.isConnected || !target.isConnected || analyzing}
                onClick={handleAnalyze}
             >
                {analyzing ? (
                    <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        正在分析差异...
                    </>
                ) : (
                    <>
                        <Search className="mr-2 h-4 w-4" />
                        开始对比分析
                    </>
                )}
             </Button>
        </section>

        {/* Diff + Logs */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <Card className="lg:col-span-8 bg-card border-border shadow-md">
                <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-border">
                    <div className="min-w-0">
                        <CardTitle className="text-base font-bold flex items-center gap-2 text-card-foreground">
                            <ListTree className="text-primary w-5 h-5 shrink-0" /> 差异对比面板
                            {diffTree.length > 0 && (
                                <span className="ml-1 flex gap-1.5 text-xs font-normal">
                                    <Badge variant="outline" className="text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/50">+{stats.added} 新增</Badge>
                                    <Badge variant="outline" className="text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50">~{stats.updated} 变更</Badge>
                                </span>
                            )}
                        </CardTitle>
                        <CardDescription className="text-muted-foreground mt-1">对比结果预览，请勾选需要同步的项目</CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="space-y-5 p-5">
                    {/* System selector */}
                     <div className="relative">
                        <select
                            className="w-full h-10 pl-4 pr-10 bg-muted/40 border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 ring-primary/20 focus:border-primary appearance-none disabled:opacity-50 transition-all cursor-pointer hover:border-primary/60"
                            value={selectedSystem}
                            disabled={diffTree.length === 0}
                            onChange={(e) => {
                                setSelectedSystem(e.target.value);
                                setSelectedMenus(new Set());
                            }}
                        >
                            <option value="">{diffTree.length === 0 ? "请先执行分析..." : "选择需要同步的系统模块..."}</option>
                            {diffTree.map(m => (
                                <option key={m.id} value={m.name} className="bg-card text-card-foreground">
                                    {m.name} ({m.status === 'SAME' ? '无变更' : `${m.status}`})
                                </option>
                            ))}
                        </select>
                        <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    </div>

                    <div className="min-h-[400px] p-4 border border-border rounded-xl bg-muted/20">
                        {selectedSystem ? (
                            <MenuDiffTable
                                data={diffTree.find(m => m.name === selectedSystem)?.children || []}
                                selectedMenus={selectedMenus}
                                onToggle={toggleMenu}
                                onToggleWithChildren={toggleMenuWithChildren}
                                onSelectAll={setSelectedMenus}
                                disabled={syncing}
                            />
                        ) : (
                            <div className="h-[360px] flex flex-col items-center justify-center text-muted-foreground space-y-3">
                                <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                                    <Search className="w-7 h-7 stroke-[1.5] opacity-60" />
                                </div>
                                <p className="text-sm font-medium">请先执行分析，并选择一个系统以查看差异</p>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end pt-1 gap-4 items-center border-t border-border">
                         <div className="text-xs text-muted-foreground mr-auto">
                            已选择 <span className="font-semibold text-foreground">{selectedMenus.size}</span> 个同步项
                         </div>
                        <Button
                            size="lg"
                            className="min-w-[200px] bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-500 shadow-lg shadow-primary/30 border-0 h-11 text-sm font-semibold transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                            disabled={!selectedSystem || selectedMenus.size === 0 || syncing}
                            onClick={handleSync}
                        >
                            {syncing ? (
                                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                                <Zap className="w-4 h-4 mr-2 fill-current" />
                            )}
                            {syncing ? '正在同步...' : '执行选中同步'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Log console */}
            <Card className="lg:col-span-4 bg-card border-border shadow-md overflow-hidden flex flex-col max-h-[850px] group">
                <CardHeader className="bg-muted/40 p-4 border-b border-border flex-row justify-between items-center space-y-0">
                    <CardTitle className="text-xs font-bold font-mono flex items-center gap-2 text-muted-foreground tracking-widest uppercase">
                        <Terminal className="w-3.5 h-3.5" /> SYNC_OPERATION_LOGS
                    </CardTitle>
                    <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
                        <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" /></span>
                        LIVE
                    </span>
                </CardHeader>
                <CardContent className="flex-1 p-3 font-mono text-xs leading-relaxed space-y-1 overflow-y-auto overflow-x-hidden">
                    <AnimatePresence initial={false}>
                        {logs.length === 0 && <div className="text-muted-foreground/60 text-center py-20 italic font-sans text-[13px]">等待操作指令...</div>}
                        {logs.map((log) => (
                            <motion.div
                                key={log.id}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                className={cn(
                                    "flex gap-2 transition-all py-0.5",
                                    log.type === 'error' ? "text-red-600 dark:text-red-400" :
                                    log.type === 'success' ? "text-green-600 dark:text-green-400" :
                                    log.type === 'warn' ? "text-amber-600 dark:text-amber-400" : "text-foreground/75"
                                )}
                            >
                                <span className="text-muted-foreground/70 shrink-0 select-none">{log.timestamp.toLocaleTimeString()}</span>
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
