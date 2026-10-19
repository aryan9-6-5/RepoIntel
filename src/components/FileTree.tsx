import { ChevronRight, FileCode2 } from 'lucide-react';
import type { TreeNode } from '../../supabase/functions/_shared/overview';

interface Props {
  nodes: TreeNode[];
  selected: string | null;
  onSelect: (path: string) => void;
  depth?: number;
}

export function FileTree({ nodes, selected, onSelect, depth = 0 }: Props) {
  return (
    <ul role={depth === 0 ? 'tree' : 'group'} className="text-sm">
      {nodes.map((n) =>
        n.children ? (
          <li key={n.path} role="treeitem" aria-expanded={depth < 1}>
            <details open={depth < 1}>
              <summary className="flex cursor-pointer items-center gap-1 py-0.5 text-foreground" style={{ paddingLeft: depth * 12 }}>
                <ChevronRight className="h-3 w-3 shrink-0" />
                {n.name}
              </summary>
              <FileTree nodes={n.children} selected={selected} onSelect={onSelect} depth={depth + 1} />
            </details>
          </li>
        ) : (
          <li key={n.path} role="treeitem" aria-selected={selected === n.path}>
            <button
              type="button"
              onClick={() => onSelect(n.path)}
              className={`flex w-full items-center gap-1 py-0.5 text-left hover:text-primary ${selected === n.path ? 'text-primary' : 'text-muted-foreground'}`}
              style={{ paddingLeft: depth * 12 + 16 }}
            >
              <FileCode2 className="h-3 w-3 shrink-0" />
              <span className="truncate">{n.name}</span>
            </button>
          </li>
        ),
      )}
    </ul>
  );
}
