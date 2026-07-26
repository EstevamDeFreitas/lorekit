import { Document } from '../../models/document.model';

export interface TreeViewNode {
  id: string;
  title: string;
  SubDocuments?: TreeViewNode[];
  Personalization?: Document['Personalization'];
}

export function buildTreeViewNodes<T extends { id: string }>(
  items: readonly T[],
  getTitle: (item: T) => string,
  getParentId: (item: T) => string | null | undefined
): TreeViewNode[] {
  const nodeMap = new Map<string, TreeViewNode>();

  for (const item of items) {
    nodeMap.set(item.id, {
      ...item,
      title: getTitle(item),
      SubDocuments: [],
    });
  }

  const roots: TreeViewNode[] = [];

  for (const item of items) {
    const node = nodeMap.get(item.id)!;
    const parentId = getParentId(item);
    const parent = parentId ? nodeMap.get(parentId) : null;

    if (parent && parent.id !== node.id) {
      parent.SubDocuments!.push(node);
    } else {
      roots.push(node);
    }
  }

  sortTreeViewNodes(roots);
  return roots;
}

export function buildFlatTreeViewNodes<T extends { id: string }>(
  items: readonly T[],
  getTitle: (item: T) => string
): TreeViewNode[] {
  return buildTreeViewNodes(items, getTitle, () => null);
}

export function filterTreeViewNodes(
  nodes: readonly TreeViewNode[],
  searchTerm: string
): TreeViewNode[] {
  const normalizedSearch = searchTerm.trim().toLocaleLowerCase();

  if (!normalizedSearch) {
    return [...nodes];
  }

  const filtered: TreeViewNode[] = [];

  for (const node of nodes) {
    const filteredChildren = filterTreeViewNodes(node.SubDocuments || [], normalizedSearch);

    if (node.title.toLocaleLowerCase().includes(normalizedSearch) || filteredChildren.length > 0) {
      filtered.push({
        ...node,
        SubDocuments: filteredChildren,
      });
    }
  }

  return filtered;
}

export function filterFlatTreeViewNodes(
  nodes: readonly TreeViewNode[],
  searchTerm: string
): TreeViewNode[] {
  return filterTreeViewNodes(nodes, searchTerm);
}

function sortTreeViewNodes(nodes: TreeViewNode[]): void {
  nodes.sort((a, b) => a.title.localeCompare(b.title));

  for (const node of nodes) {
    if (node.SubDocuments?.length) {
      sortTreeViewNodes(node.SubDocuments);
    }
  }
}

export type TreeViewReparentRequest = {
  draggedId: string;
  newParentId: string | null;
};
