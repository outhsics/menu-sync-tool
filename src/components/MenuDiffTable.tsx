"use client";

import { useMemo, useState } from 'react';
import { DiffNode } from '@/types';
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
  LayoutGrid, 
  MousePointerClick,
  ArrowRight,
  Search,
  Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from './ui/input';

interface MenuDiffTableProps {
  data: DiffNode[];
  selectedMenus: Set<number>;
  onToggle: (id: number) => void;
  onToggleWithChildren: (id: number, childIds: number[]) => void; // New prop for cascade
  onSelectAll: (ids: Set<number>) => void;
  disabled?: boolean;
}

// Helper to flatten diff tree for table
interface FlatDiffNode extends DiffNode {
  hasChildren: boolean;
  expanded: boolean;
  parentExpanded: boolean;
}

export function MenuDiffTable({ data, selectedMenus, onToggle, onToggleWithChildren, onSelectAll, disabled }: MenuDiffTableProps) {
  // Helper to collect all descendant IDs (深度优先)
  const getAllDescendantIds = (node: DiffNode): number[] => {
    const ids: number[] = [];
    const collect = (n: DiffNode) => {
      ids.push(n.id);
      n.children?.forEach(collect);
    };
    collect(node);
    return ids;
  };

  // Helper to check if a node is indeterminate (some but not all children selected)
  const getCheckboxState = (node: DiffNode): 'checked' | 'unchecked' | 'indeterminate' => {
    const allIds = getAllDescendantIds(node);
    const selectedCount = allIds.filter(id => selectedMenus.has(id)).length;
    if (selectedCount === 0) return 'unchecked';
    if (selectedCount === allIds.length) return 'checked';
    return 'indeterminate';
  };
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [showSame, setShowSame] = useState(false); // Toggle to show/hide unchanged items

  // Auto-expand Logic on Mount
  useState(() => {
    const allIds = new Set<number>();
    const collectIds = (nodes: DiffNode[]) => {
      nodes.forEach(n => {
        if (n.children?.length) {
            // Auto expand if it contains changes
            const hasChanges = n.children.some(c => c.status !== 'SAME' || (c.children && c.children.some(gc => gc.status !== 'SAME')));
            if(hasChanges) allIds.add(n.id);
            collectIds(n.children);
        }
      });
    };
    collectIds(data);
    setExpandedNodes(allIds);
  });

  const flatData = useMemo(() => {
    const result: FlatDiffNode[] = [];
    
    // Search & Filter Logic
    const matchesFilter = (node: DiffNode): boolean => {
      // 1. Status Filter
      if (!showSame && node.status === 'SAME') {
          // Only show SAME if it has children that are NOT SAME (and matching search)
          // Use 'some' recursively for deep check? For simple UI:
          // Just hide leaves that are SAME if showSame is false.
          // But directories should show if they have changed children.
          const hasChangedChildren = node.children?.some(c => c.status !== 'SAME' || (c.children?.some(gc => gc.status !== 'SAME')));
          if (!hasChangedChildren) return false;
      }
      
      // 2. Text Search
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      if (node.name.toLowerCase().includes(term)) return true;
      return node.children ? node.children.some(matchesFilter) : false;
    };

    const processNode = (node: DiffNode, parentExpanded: boolean) => {
        if (!matchesFilter(node)) return;

        const isExpanded = expandedNodes.has(node.id);
        const hasChildren = node.children && node.children.length > 0;

        result.push({
            ...node,
            hasChildren: !!hasChildren,
            expanded: isExpanded,
            parentExpanded
        });

        if (hasChildren && node.children) {
            node.children.forEach(child => {
                processNode(child, isExpanded && parentExpanded);
            });
        }
    };

    data.forEach(node => processNode(node, true));
    return result;
  }, [data, expandedNodes, searchTerm, showSame]);

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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1">
                <div className="relative max-w-sm flex-1">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="搜索菜单..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-8 bg-background border-border h-9 text-sm focus:border-primary focus:ring-primary/20"
                    />
                </div>
                <Button
                    variant={showSame ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setShowSame(!showSame)}
                    className={cn(
                        "h-9 gap-2 cursor-pointer",
                        showSame ? "bg-muted hover:bg-muted/80" : "bg-background border-border text-card-foreground"
                    )}
                >
                    <Filter className="w-3.5 h-3.5" />
                    {showSame ? '隐藏无变更' : '显示全部'}
                </Button>
            </div>

            <div className="flex gap-2">
                 <div className="flex items-center gap-2 text-[10px] uppercase font-mono mr-4 bg-muted/50 px-3 py-1 rounded border border-border text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> New</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Update</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-muted-foreground"></span> Same</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setExpandedNodes(new Set())} className="h-9 text-xs text-muted-foreground hover:text-card-foreground hover:bg-muted/50 cursor-pointer">全部折叠</Button>
            </div>
        </div>

        <div className="border rounded-lg border-border bg-card overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow className="border-border bg-muted/40 hover:bg-muted/40">
                        <TableHead className="w-[40px] text-center px-0 h-10">
                            <Checkbox
                                checked={visibleRows.length > 0 && visibleRows.every(d => selectedMenus.has(d.id))}
                                onCheckedChange={(checked) => {
                                    if(checked) {
                                        const all = new Set<number>();
                                        visibleRows.forEach(d => all.add(d.id));
                                        onSelectAll(all);
                                    } else {
                                        onSelectAll(new Set());
                                    }
                                }}
                                disabled={disabled}
                                className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                            />
                        </TableHead>
                        <TableHead className="w-[80px] text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">状态</TableHead>
                        <TableHead className="min-w-[250px] text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">菜单名称</TableHead>
                        <TableHead className="w-[50px] text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">图标</TableHead>
                        <TableHead className="w-[50px] text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">排序</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">权限标识</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">组件路径</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {visibleRows.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                <div className="flex flex-col items-center gap-2">
                                    <Search className="w-8 h-8 opacity-20" />
                                    <span>未发现匹配的差异项</span>
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : (
                        visibleRows.map((node) => {
                            const isSelected = selectedMenus.has(node.id);
                            const isNew = node.status === 'NEW';
                            const isUpdate = node.status === 'UPDATE';
                            const isSame = node.status === 'SAME';

                            return (
                                <TableRow
                                    key={node.id}
                                    className={cn(
                                        "border-border transition-colors",
                                        isNew && "bg-green-50 dark:bg-green-950/30 hover:bg-green-100/50 dark:hover:bg-green-950/50",
                                        isUpdate && "bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100/50 dark:hover:bg-amber-950/50",
                                        isSame && "text-muted-foreground hover:bg-muted/30",
                                        !isSame && isSelected && "bg-primary/5"
                                    )}
                                >
                                    <TableCell className="text-center px-0">
                                        {(() => {
                                            const checkState = getCheckboxState(node);
                                            return (
                                                <Checkbox
                                                    checked={checkState === 'checked'}
                                                    ref={(el) => {
                                                        if (el) {
                                                            (el as HTMLButtonElement).dataset.state =
                                                                checkState === 'indeterminate' ? 'indeterminate' :
                                                                checkState === 'checked' ? 'checked' : 'unchecked';
                                                        }
                                                    }}
                                                    onCheckedChange={(checked) => {
                                                        const allIds = getAllDescendantIds(node);
                                                        onToggleWithChildren(node.id, allIds);
                                                    }}
                                                    disabled={disabled || isSame}
                                                    className={cn(
                                                        "border-border",
                                                        isNew && "data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600",
                                                        isUpdate && "data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600",
                                                        checkState === 'indeterminate' && "data-[state=indeterminate]:bg-primary/50 data-[state=indeterminate]:border-primary"
                                                    )}
                                                />
                                            );
                                        })()}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline" className={cn(
                                            "font-mono text-[10px] px-1.5 h-5 border-0 shadow-none",
                                            isNew && "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400 font-bold",
                                            isUpdate && "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 font-bold",
                                            isSame && "bg-muted text-muted-foreground"
                                        )}>
                                            {isNew ? 'NEW' : isUpdate ? 'MOD' : 'SAME'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div
                                            className="flex items-center gap-2 select-none"
                                            style={{ paddingLeft: `${(node.level ?? 0) * 20}px` }}
                                        >
                                            {node.hasChildren ? (
                                                <button
                                                    onClick={() => toggleExpand(node.id)}
                                                    className="p-0.5 hover:bg-muted rounded transition-colors cursor-pointer"
                                                >
                                                    {node.expanded ? (
                                                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                                    ) : (
                                                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                                    )}
                                                </button>
                                            ) : <span className="w-5" />}

                                            <span className={cn(
                                                "text-sm font-medium truncate max-w-[200px]",
                                                isSelected && !isSame ? "text-card-foreground" : "text-muted-foreground",
                                                (isNew || isUpdate) && "text-card-foreground"
                                            )}>
                                                {node.name}
                                            </span>
                                        </div>
                                    </TableCell>

                                    {/* Icon Column */}
                                    <TableCell className="text-center">
                                         <div className="flex justify-center items-center gap-1">
                                            {node.type === 1 ? <Folder className="w-4 h-4 text-amber-500" /> :
                                             node.type === 2 ? <LayoutGrid className="w-4 h-4 text-primary" /> :
                                             <MousePointerClick className="w-4 h-4 text-green-500" />}
                                         </div>
                                    </TableCell>

                                    {/* Sort Column with Diff */}
                                    <TableCell className="text-center font-mono text-xs">
                                        <DiffField
                                            label="Sort"
                                            original={node.sourceMenu?.sort}
                                            target={node.targetMenu?.sort}
                                            isDiff={node.diffFields?.includes('sort')}
                                        />
                                    </TableCell>

                                    {/* Permission Column with Diff */}
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            <span className={cn("text-xs font-mono", node.diffFields?.includes('permission') && "text-amber-600 dark:text-amber-400 font-bold")}>
                                                {node.permission || '-'}
                                            </span>
                                            {node.diffFields?.includes('permission') && node.targetMenu && (
                                                <span className="text-[10px] text-muted-foreground line-through">
                                                    {node.targetMenu.permission || 'EMPTY'}
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>

                                    {/* Component Column with Diff */}
                                    <TableCell>
                                         <DiffField
                                            label="path"
                                            original={node.component}
                                            target={node.targetMenu?.component}
                                            isDiff={node.diffFields?.includes('component')}
                                            className="max-w-[150px] truncate"
                                        />
                                    </TableCell>
                                </TableRow>
                            );
                        })
                    )}
                </TableBody>
            </Table>
        </div>
        <div className="text-xs text-muted-foreground px-2">
            <span>显示 {visibleRows.length} 项 (共 {data.length} 项)</span>
        </div>
    </div>
  );
}

// Simple helper to show Old -> New if different
function DiffField({ original, target, isDiff, className }: { original: any, target: any, isDiff?: boolean, className?: string, label: string }) {
    if (!isDiff || target === undefined) {
        return <span className={cn("text-muted-foreground", className)} title={String(original)}>{original || '-'}</span>;
    }
    return (
        <div className="flex flex-col items-start text-xs group cursor-help">
            <span className={cn("text-amber-700 dark:text-amber-400 font-bold bg-amber-100 dark:bg-amber-950 px-1 rounded", className)} title="New Value">
                {original || 'EMPTY'}
            </span>
            <span className="text-[10px] text-muted-foreground line-through mt-0.5" title="Current Value on Target">
                {target || 'EMPTY'}
            </span>
        </div>
    );
}
