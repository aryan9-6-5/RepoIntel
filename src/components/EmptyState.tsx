import { FolderOpen, Search, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  type: 'no-repos' | 'no-results' | 'error';
  message?: string;
  /** recovery action: clear filters (no-results) or retry (error) */
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ type, message, action }: EmptyStateProps) {
  const configs = {
    'no-repos': {
      icon: FolderOpen,
      title: 'No Repositories Found',
      description: "This user doesn't have any public repositories yet.",
    },
    'no-results': {
      icon: Search,
      title: 'No Matching Repositories',
      description: 'No repository matches the current search or language filter.',
    },
    'error': {
      icon: AlertTriangle,
      title: 'Could not load this',
      description: message || 'An error occurred while fetching data.',
    },
  };

  const { icon: Icon, title, description } = configs[type];

  return (
    <div role={type === 'error' ? 'alert' : 'status'} className="glass-card p-12 text-center animate-fade-in">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-secondary mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-md mx-auto">{description}</p>
      {action && (
        <Button variant="outline" size="sm" className="mt-5" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
