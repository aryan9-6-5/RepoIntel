import { FolderOpen, Search, AlertTriangle } from 'lucide-react';

interface EmptyStateProps {
  type: 'no-repos' | 'no-results' | 'error';
  message?: string;
}

export function EmptyState({ type, message }: EmptyStateProps) {
  const configs = {
    'no-repos': {
      icon: FolderOpen,
      title: 'No Repositories Found',
      description: "This user doesn't have any public repositories yet.",
    },
    'no-results': {
      icon: Search,
      title: 'No Matching Repositories',
      description: 'Try adjusting your search or filter criteria.',
    },
    'error': {
      icon: AlertTriangle,
      title: 'Something Went Wrong',
      description: message || 'An error occurred while fetching data.',
    },
  };

  const { icon: Icon, title, description } = configs[type];

  return (
    <div className="glass-card p-12 text-center animate-fade-in">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-secondary mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-md mx-auto">{description}</p>
    </div>
  );
}
