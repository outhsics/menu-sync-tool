"use client";

import { useMemo, useState } from 'react';
import { Menu } from '@/types';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  FileText, 
  MousePointerClick,
  LayoutGrid,
  Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from './ui/input';

interface MenuTreeTableProps {
  data: Menu[];
  selectedMenus: Set<number>;
  onToggle: (id: number) => void;
  onSelectAll: (ids: Set<number>) => void;
  disabled?: boolean;
}

// Flatten tree to list for table rendering
// We still need to know level and visible status
interface FlatNode extends Menu {
  level: number;
  hasChildren: boolean;
  expanded: boolean;
  parentExpanded: boolean;
}

export function MenuTreeTable({ data, selectedMenus, onToggle, onSelectAll, disabled }: MenuTreeTableProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  // Auto-expand all by default or on load
  useState(() => {
    const allIds = new Set<number>();
    const collectIds = (nodes: Menu[]) => {
      nodes.forEach(n => {
        if (n.children && n.children.length > 0) {
          allIds.add(n.id);
          collectIds(n.children);
        }
      });
    };
    collectIds(data);
    setExpandedNodes(allIds);
  });

  const flatData = useMemo(() => {
    const result: FlatNode[] = [];
    
    // Search filter logic
    const matchesSearch = (node: Menu): boolean => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      if (node.name.toLowerCase().includes(term)) return true;
      if (node.permission?.toLowerCase().includes(term)) return true;
      // Also match if any child matches (keep parent visible)
      return node.children ? node.children.some(matchesSearch) : false;
    };

    const processNode = (node: Menu, level: number, parentExpanded: boolean) => {
        if (!matchesSearch(node)) return;

        const isExpanded = expandedNodes.has(node.id);
        const hasChildren = node.children && node.children.length > 0;

        result.push({
            ...node,
            level,
            hasChildren: !!hasChildren,
            expanded: isExpanded,
            parentExpanded
        });

        if (hasChildren && node.children) {
            node.children.forEach(child => {
                processNode(child, level + 1, isExpanded && parentExpanded);
            });
        }
    };

    data.forEach(node => processNode(node, 0, true));
    return result;
  }, [data, expandedNodes, searchTerm]);

  const toggleExpand = (id: number) => {
    setExpandedNodes(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });
  };

  const visibleRows = flatData.filter(node => node.parentExpanded);

  return (
    <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4">
            <div className="relative max-w-sm flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input 
                    placeholder="搜索菜单名称、权限标识..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-8 bg-white border-gray-200 focus:border-blue-500"
                />
            </div>
            <div className="flex gap-2 text-xs">
                <Button variant="outline" size="sm" onClick={() => {
                    const allIds = new Set<number>();
                    const collect = (nodes: Menu[]) => nodes.forEach(n => {
                        if(n.children?.length) allIds.add(n.id);
                        if(n.children) collect(n.children);
                    });
                    collect(data);
                    setExpandedNodes(allIds);
                }}>全部展开</Button>
                <Button variant="outline" size="sm" onClick={() => setExpandedNodes(new Set())}>全部折叠</Button>
            </div>
        </div>

        <div className="border rounded-md border-gray-200 bg-white overflow-hidden shadow-sm">
            <Table>
                <TableHeader className="bg-gray-50/80">
                    <TableRow className="border-gray-200 hover:bg-transparent">
                        <TableHead className="w-[50px] text-center">
                            <Checkbox 
                                id="select-all"
                                checked={flatData.length > 0 && flatData.every(d => selectedMenus.has(d.id))}
                                onCheckedChange={(checked) => {
                                    if (checked) {
                                        const all = new Set<number>();
                                        flatData.forEach(d => all.add(d.id));
                                        onSelectAll(all);
                                    } else {
                                        onSelectAll(new Set());
                                    }
                                }}
                                disabled={disabled}
                                className="border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                            />
                        </TableHead>
                        <TableHead className="min-w-[200px]">菜单名称</TableHead>
                        <TableHead className="w-[60px] text-center">图标</TableHead>
                        <TableHead className="w-[60px] text-center">排序</TableHead>
                        <TableHead>权限标识</TableHead>
                        <TableHead>组件路径</TableHead>
                        <TableHead className="w-[80px] text-center">状态</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {visibleRows.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center text-gray-500">
                                没有找到匹配的菜单
                            </TableCell>
                        </TableRow>
                    ) : (
                        visibleRows.map((menu) => {
                            const isSelected = selectedMenus.has(menu.id);
                            
                            return (
                                <TableRow 
                                    key={menu.id} 
                                    className={cn(
                                        "border-gray-100 transition-colors",
                                        isSelected ? "bg-blue-50 hover:bg-blue-50/80" : "hover:bg-gray-50"
                                    )}
                                >
                                    <TableCell className="text-center">
                                        <Checkbox 
                                            checked={isSelected}
                                            onCheckedChange={() => onToggle(menu.id)}
                                            disabled={disabled}
                                            className="border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <div 
                                            className="flex items-center gap-2 select-none"
                                            style={{ paddingLeft: `${menu.level * 20}px` }}
                                        >
                                            {menu.hasChildren ? (
                                                <button 
                                                    onClick={() => toggleExpand(menu.id)}
                                                    className="p-0.5 hover:bg-gray-100 rounded transition-colors"
                                                >
                                                    {menu.expanded ? (
                                                        <ChevronDown className="w-4 h-4 text-gray-400" />
                                                    ) : (
                                                        <ChevronRight className="w-4 h-4 text-gray-400" />
                                                    )}
                                                </button>
                                            ) : <span className="w-5" />}
                                            
                                            <span className={cn(
                                                "text-sm font-medium truncate max-w-[200px]",
                                                isSelected ? "text-blue-600 font-semibold" : "text-gray-700"
                                            )}>
                                                {menu.name}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex justify-center">
                                            {menu.type === 1 ? <Folder className="w-4 h-4 text-amber-500" /> :
                                             menu.type === 2 ? <LayoutGrid className="w-4 h-4 text-blue-500" /> :
                                             <MousePointerClick className="w-4 h-4 text-green-500" />}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center text-xs font-mono text-gray-500">
                                        {menu.sort}
                                    </TableCell>
                                    <TableCell>
                                        {menu.permission ? (
                                            <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-500 font-mono text-[10px] px-1.5 py-0 h-5">
                                                {menu.permission}
                                            </Badge>
                                        ) : <span className="text-gray-400 text-xs">-</span>}
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-xs text-gray-500 font-mono truncate max-w-[150px] block" title={menu.component}>
                                            {menu.component || '-'}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex justify-center">
                                            <Switch 
                                                checked={menu.status === 0} 
                                                disabled 
                                                className="scale-75 data-[state=checked]:bg-green-600"
                                            />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })
                    )}
                </TableBody>
            </Table>
        </div>
        <div className="text-xs text-gray-500 px-2 flex justify-between">
            <span>共显示 {visibleRows.length} 项</span>
            <span>由于是跨环境同步，状态和排序仅供参考</span>
        </div>
    </div>
  );
}
