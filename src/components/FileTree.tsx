import { ChevronRight, FileCode2 } from 'lucide-react';
import type { TreeNode } from '../../supabase/functions/_shared/overview';

interface Props {
  nodes: TreeNode[];
  selected: string | null;
  onSelect: (path: string) => void;
  depth?: number;
}

// Native <details>/<summary> + <button>: keyboard and screen-reader support (and correct expanded state) come from the platform.
// Rows are >=28px tall (40px on touch widths) to meet WCAG 2.2 target-size guidance.
const ROW = 'flex min-h-[40px] w-full items-center gap-1 rounded md:min-h-[28px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary';

export function FileTree({ nodes, selected, onSelect, depth = 0 }: Props) {
  return (
    <ul className="text-sm">
      {nodes.map((n) =>
        n.children ? (
          <li key={n.path}>
            <details open={depth < 1}>
              <summary className={`${ROW} cursor-pointer text-foreground`} style={{ paddingLeft: depth * 12 }}>
                <ChevronRight className="h-3 w-3 shrink-0" aria-hidden="true" />
                {n.name}
              </summary>
              <FileTree nodes={n.children} selected={selected} onSelect={onSelect} depth={depth + 1} />
            </details>
          </li>
        ) : (
          <li key={n.path}>
            <button
              type="button"
              onClick={() => onSelect(n.path)}
              aria-current={selected === n.path ? 'true' : undefined}
              className={`${ROW} text-left hover:text-primary ${selected === n.path ? 'text-primary' : 'text-muted-foreground'}`}
              style={{ paddingLeft: depth * 12 + 16 }}
            >
              <FileCode2 className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{n.name}</span>
            </button>
          </li>
        ),
      )}
    </ul>
  );
}
