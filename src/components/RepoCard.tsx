import { GitHubRepository } from '@/types/github';
import { Star, GitFork, Eye, Calendar, Code2, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

interface RepoCardProps {
  repo: GitHubRepository;
  onClick: () => void;
  index: number;
}

const languageColors: Record<string, string> = {
  JavaScript: 'bg-yellow-500',
  TypeScript: 'bg-blue-500',
  Python: 'bg-emerald-500',
  Java: 'bg-orange-500',
  Go: 'bg-cyan-500',
  Rust: 'bg-amber-600',
  Ruby: 'bg-red-500',
  PHP: 'bg-purple-500',
  'C++': 'bg-pink-500',
  C: 'bg-gray-500',
  Shell: 'bg-green-600',
  Swift: 'bg-orange-400',
  Kotlin: 'bg-violet-500',
  Vue: 'bg-emerald-400',
  CSS: 'bg-indigo-500',
  HTML: 'bg-red-400',
};

export function RepoCard({ repo, onClick, index }: RepoCardProps) {
  const updatedAt = formatDistanceToNow(new Date(repo.updated_at), { addSuffix: true });
  const langColor = repo.language ? languageColors[repo.language] || 'bg-gray-400' : '';

  return (
    <div
      className="glass-card glow-border p-5 cursor-pointer group transition-all duration-300 hover:scale-[1.01] hover:bg-card/90 animate-slide-up"
      style={{ animationDelay: `${index * 50}ms` }}
      onClick={onClick}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                {repo.name}
              </h3>
              {repo.archived && (
                <Badge variant="outline" className="text-xs">Archived</Badge>
              )}
              {repo.fork && (
                <Badge variant="secondary" className="text-xs">Fork</Badge>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              window.open(repo.html_url, '_blank');
            }}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1">
          {repo.description || 'No description available'}
        </p>

        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          {repo.language && (
            <div className="flex items-center gap-1.5">
              <span className={`w-3 h-3 rounded-full ${langColor}`} />
              <span>{repo.language}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4" />
            <span>{repo.stargazers_count.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1">
            <GitFork className="h-4 w-4" />
            <span>{repo.forks_count.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1 ml-auto text-xs">
            <Calendar className="h-3.5 w-3.5" />
            <span>{updatedAt}</span>
          </div>
        </div>

        {repo.topics && repo.topics.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {repo.topics.slice(0, 4).map((topic) => (
              <Badge
                key={topic}
                variant="secondary"
                className="text-xs bg-primary/10 text-primary hover:bg-primary/20"
              >
                {topic}
              </Badge>
            ))}
            {repo.topics.length > 4 && (
              <Badge variant="secondary" className="text-xs">
                +{repo.topics.length - 4}
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
