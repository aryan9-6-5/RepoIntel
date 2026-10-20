import { isAuxPath } from '../../supabase/functions/_shared/search';
import type { TreeNode } from '../../supabase/functions/_shared/overview';

/**
 * Display order for the file tree: source folders first, then files, then auxiliary folders
 * (dot-dirs, tests, docs, examples, fixtures, scripts, tools) so `src` is not buried under `.github`.
 */
export function sortTree(nodes: TreeNode[]): TreeNode[] {
  const tooling = (path: string) => /(^|\/)(scripts|tools|tasks)$/i.test(path);
  const rank = (n: TreeNode) => (!n.children ? 1 : isAuxPath(`${n.path}/x`) || tooling(n.path) ? 2 : 0);
  return nodes
    .map((n) => (n.children ? { ...n, children: sortTree(n.children) } : n))
    .sort((a, b) => rank(a) - rank(b) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}
