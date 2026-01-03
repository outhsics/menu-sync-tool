import { Menu, DiffNode } from "@/types";
import { isMenuEqual } from "./menu-utils";

/**
 * Compare two menu trees and return a unified Diff Tree.
 * Matching is done primarily by Name.
 */
export function buildDiffTree(
    sourceMenus: Menu[], 
    targetMenus: Menu[], 
    level: number = 0
): DiffNode[] {
    const diffNodes: DiffNode[] = [];

    // Map target menus by name for easy lookup
    const targetMap = new Map<string, Menu>();
    targetMenus.forEach(m => targetMap.set(m.name, m));

    // 1. Process Source Menus (Find NEW, UPDATE, SAME)
    sourceMenus.forEach(sMenu => {
        const tMenu = targetMap.get(sMenu.name);
        
        // Remove from map to track what's left (MISSING_IN_SOURCE)
        if (tMenu) targetMap.delete(sMenu.name);

        let status: DiffNode['status'] = 'NEW';
        let diffFields: string[] = [];

        if (tMenu) {
            if (isMenuEqual(sMenu, tMenu)) {
                status = 'SAME';
            } else {
                status = 'UPDATE';
                // Calculate simple field diffs
                if (sMenu.sort !== tMenu.sort) diffFields.push('sort');
                if (sMenu.icon !== tMenu.icon) diffFields.push('icon');
                if (sMenu.permission !== tMenu.permission) diffFields.push('permission');
                if (sMenu.component !== tMenu.component) diffFields.push('component');
                if (sMenu.path !== tMenu.path) diffFields.push('path');
                if (sMenu.status !== tMenu.status) diffFields.push('status');
                if (sMenu.type !== tMenu.type) diffFields.push('type');
            }
        }

        // Exclude children from spread to avoid type mismatch (Menu[] vs DiffNode[])
        // Also status (number) will be overwritten by status (string) below
        const { children: _unusedChildren, ...sMenuProps } = sMenu;

        const node: DiffNode = {
            ...sMenuProps,
            level,
            status,
            targetId: tMenu?.id,
            diffFields,
            sourceMenu: sMenu,
            targetMenu: tMenu,
            expanded: true // Expand by default if there are changes? Maybe config later.
        };

        // Recursively process children
        const sChildren = sMenu.children || [];
        const tChildren = tMenu?.children || [];
        
        if (sChildren.length > 0 || tChildren.length > 0) {
            node.children = buildDiffTree(sChildren, tChildren, level + 1);
        }

        diffNodes.push(node);
    });

    // 2. Process Remaining Target Menus (MISSING_IN_SOURCE / EXTRA)
    // currently we might not want to show these or maybe show them as read-only
    // For now, let's skip them to keep the tree focused on Source -> Target flow
    // If user wants to see what to delete, we can add that later.
    
    return diffNodes;
}

/**
 * Count stats from diff tree
 */
export function countDiffStats(nodes: DiffNode[]) {
    let added = 0;
    let updated = 0;
    let same = 0;

    const traverse = (list: DiffNode[]) => {
        list.forEach(n => {
            if (n.status === 'NEW') added++;
            else if (n.status === 'UPDATE') updated++;
            else same++;
            
            if (n.children) traverse(n.children);
        });
    };

    traverse(nodes);
    return { added, updated, same };
}
