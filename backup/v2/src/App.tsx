import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { EnvironmentCard } from '@/components/EnvironmentCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRightLeft, RefreshCw, LayoutDashboard, Terminal, ListTree } from 'lucide-react';
import * as api from '@/lib/api';
import { Checkbox } from '@/components/ui/checkbox';

interface LogEntry {
  id: string;
  message: string;
  timestamp: Date;
}



function App() {
  const { source, target, setSource, setTarget, setSourceConnected, setTargetConnected } = useAppStore();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [sourceMenus, setSourceMenus] = useState<api.Menu[]>([]);
  const [targetMenus, setTargetMenus] = useState<api.Menu[]>([]);
  const [sourceTree, setSourceTree] = useState<api.Menu[]>([]);
  const [targetTree, setTargetTree] = useState<api.Menu[]>([]);

  // 选中的菜单ID集合
  const [selectedSystem, setSelectedSystem] = useState<string>('');
  const [selectedMenus, setSelectedMenus] = useState<Set<number>>(new Set());

  const addLog = (message: string) => {
    setLogs(prev => [...prev, { id: Math.random().toString(), message, timestamp: new Date() }]);
  };

  const loadSourceMenus = async () => {
    try {
      addLog('📥 读取来源环境菜单...');
      const menus = await api.fetchAllMenus({ apiBase: source.apiBase, token: source.token, tenantId: source.tenantId });
      const tree = api.buildMenuTree(menus);
      setSourceMenus(menus);
      setSourceTree(tree);
      addLog(`✅ 来源环境读取成功: ${menus.length} 个菜单`);
    } catch (error) {
      addLog(`❌ 读取来源环境失败: ${(error as Error).message}`);
    }
  };

  const loadTargetMenus = async () => {
    try {
      addLog('📥 读取目标环境菜单...');
      const menus = await api.fetchAllMenus({ apiBase: target.apiBase, token: target.token, tenantId: target.tenantId });
      const tree = api.buildMenuTree(menus);
      setTargetMenus(menus);
      setTargetTree(tree);
      addLog(`✅ 目标环境读取成功: ${menus.length} 个菜单`);
    } catch (error) {
      addLog(`❌ 读取目标环境失败: ${(error as Error).message}`);
    }
  };

  // 获取系统列表 (顶级菜单)
  const sourceSystems = sourceTree.map(m => m.name);

  const toggleMenu = (id: number) => {
    const newSelected = new Set(selectedMenus);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedMenus(newSelected);
  };

  const selectAllSystem = (sysName: string) => {
      const sys = sourceTree.find(m => m.name === sysName);
      if(!sys) return;
      
      const newSelected = new Set(selectedMenus);
      const collect = (m: api.Menu) => {
          newSelected.add(m.id);
          m.children?.forEach(collect);
      };
      
      // 也要选中系统本身
      newSelected.add(sys.id);
      sys.children?.forEach(collect);
      
      setSelectedMenus(newSelected);
  };

  const handleSync = async () => {
    if (!source.isConnected || !target.isConnected) {
      addLog('❌ 请先连接两个环境');
      return;
    }
    
    if (selectedMenus.size === 0) {
        addLog('⚠️ 请先选择要同步的菜单');
        return;
    }

    setSyncing(true);
    addLog('🚀 开始同步任务...');

    try {
       // 1. 过滤出选中的菜单树
       const selectedTree = sourceTree.map(root => {
           // 如果根节点没被选中，检查子节点
           // 这里简化逻辑：我们只处理 selectedSystem 下的菜单
           if (root.name !== selectedSystem) return null;
           
           // 深拷贝并过滤
           const filterNode = (node: api.Menu): api.Menu | null => {
               const isSelected = selectedMenus.has(node.id);
               const validChildren = node.children?.map(filterNode).filter(Boolean) as api.Menu[];
               
               if (isSelected || (validChildren && validChildren.length > 0)) {
                   return { ...node, children: validChildren };
               }
               return null;
           };
           
           return filterNode(root);
       }).filter(Boolean) as api.Menu[];
       
       if (selectedTree.length === 0) {
           addLog('⚠️ 有效选中菜单为空');
           setSyncing(false);
           return;
       }

       // 2. 查找目标环境对应的根节点（通常是 "CRM 系统" 等）
       // 我们假设同步的是根节点下的子树。
       // 特殊情况：如果根节点本身不存在于目标环境，需要创建根节点吗？
       // syncMenus 逻辑是：在 Target 找同名菜单，没有就创建。
       
       // 对于根节点 (parentID=0)，我们需要特别处理。syncMenus 的 parentID 参数是父级的 ID。
       // 顶层菜单 parentId = 0.
       
       addLog(`📦 准备同步 ${selectedTree.length} 个根系菜单树`);
       
       const { added, updated } = await api.syncMenus(
           selectedTree,
           targetTree, // 现有的目标树
           0, // 顶层 parentId
           { apiBase: target.apiBase, token: target.token, tenantId: target.tenantId },
           addLog
       );
       
       addLog(`🎉 同步完成! 新增: ${added}, 更新: ${updated}`);
       
       // 刷新目标菜单
       await loadTargetMenus();
       
    } catch (error) {
      addLog(`❌ 同步过程中发生错误: ${(error as Error).message}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">菜单同步工具 Pro</h1>
            <p className="text-xs text-muted-foreground">Environment Sync & Manager</p>
          </div>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setLogs([])}>清空日志</Button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-6 space-y-6">
        
        {/* Environment Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <EnvironmentCard 
            title={source.name} 
            config={source} 
            onUpdate={setSource} 
            onConnected={(isConnected) => {
                setSourceConnected(isConnected);
                if(isConnected) loadSourceMenus();
            }}
          />
          <EnvironmentCard 
            title={target.name} 
            config={target} 
            onUpdate={setTarget} 
            onConnected={(isConnected) => {
                setTargetConnected(isConnected);
                if(isConnected) loadTargetMenus();
            }}
          />
        </div>

        {/* Sync Controls */}
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <RefreshCw className={syncing ? "animate-spin" : ""} />
                    同步操作工作台
                </CardTitle>
                <CardDescription>选择来源菜单同步到目标环境</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
                    {/* Left: Source Menu Selection */}
                    <div className="border rounded-lg p-4 flex flex-col bg-white dark:bg-slate-800">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="font-semibold flex items-center gap-2">
                                <ListTree className="w-4 h-4" /> 来源菜单选择
                            </h3>
                            {sourceMenus.length > 0 && <Badge>{sourceMenus.length} items</Badge>}
                        </div>
                        
                        {sourceSystems.length > 0 ? (
                            <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                                <div className="flex gap-2">
                                    <select 
                                        className="w-full border rounded px-3 py-2 text-sm bg-background"
                                        value={selectedSystem}
                                        onChange={(e) => {
                                            setSelectedSystem(e.target.value);
                                            setSelectedMenus(new Set()); // 切换系统清空选择
                                        }}
                                    >
                                        <option value="">-- 选择系统模块 --</option>
                                        {sourceSystems.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    <Button variant="secondary" size="sm" onClick={() => selectedSystem && selectAllSystem(selectedSystem)} disabled={!selectedSystem}>全选</Button>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto border rounded p-2 bg-muted/20">
                                   {selectedSystem ? (
                                       sourceTree.find(m => m.name === selectedSystem)?.children?.map(menu => (
                                           <div key={menu.id} className="mb-1">
                                                <div className="flex items-center gap-2 hover:bg-muted p-1 rounded">
                                                    <Checkbox 
                                                        checked={selectedMenus.has(menu.id)}
                                                        onCheckedChange={() => toggleMenu(menu.id)}
                                                    />
                                                    <span className="text-sm font-medium">{menu.name}</span>
                                                    <Badge variant="outline" className="text-[10px]">{menu.children?.length || 0} 子项</Badge>
                                                </div>
                                                {/* 简单展示子级，实际应递归 Checkbox */}
                                                <div className="pl-6 text-xs text-muted-foreground">
                                                    {menu.children?.map(c => c.name).join(', ')}
                                                </div>
                                           </div>
                                       ))
                                   ) : (
                                       <div className="text-center text-muted-foreground p-10">请选择一个系统模块</div>
                                   )}
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground">
                                请先连接来源环境
                            </div>
                        )}
                    </div>

                    {/* Middle: Action Center */}
                    <div className="flex flex-col items-center justify-center space-y-4 p-4">
                        <ArrowRightLeft className="w-12 h-12 text-muted-foreground/50" />
                        <div className="text-center space-y-2">
                            <p className="text-sm text-muted-foreground">
                                已选择 <span className="font-bold text-primary">{selectedMenus.size}</span> 个菜单
                            </p>
                            <Button 
                                size="lg" 
                                className="w-full min-w-[200px]" 
                                onClick={handleSync}
                                disabled={syncing || selectedMenus.size === 0 || !target.isConnected}
                            >
                                {syncing ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> 
                                        同步中...
                                    </>
                                ) : (
                                    <>
                                        开始同步 <ArrowRightLeft className="w-4 h-4 ml-2" />
                                    </>
                                )}
                            </Button>
                            {!target.isConnected && <p className="text-xs text-red-500">目标环境未连接</p>}
                        </div>
                    </div>

                    {/* Right: Target Logs / Preview */}
                    <div className="border rounded-lg flex flex-col bg-slate-950 text-slate-50 overflow-hidden">
                        <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                            <h3 className="font-mono text-sm flex items-center gap-2">
                                <Terminal className="w-4 h-4" /> 
                                Execution Logs
                            </h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-2">
                            {logs.length === 0 && <div className="text-slate-500 italic">Ready to sync...</div>}
                            {logs.map(log => (
                                <div key={log.id} className="break-all border-b border-slate-800/50 pb-1">
                                    <span className="text-slate-500">[{log.timestamp.toLocaleTimeString()}]</span>{' '}
                                    <span className={log.message.includes('❌') ? 'text-red-400' : log.message.includes('✅') ? 'text-green-400' : 'text-slate-300'}>
                                        {log.message}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>

      </main>
    </div>
  );
}

export default App;
