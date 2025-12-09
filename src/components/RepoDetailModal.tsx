import { GitHubRepository } from '@/types/github';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Star, 
  GitFork, 
  Eye, 
  Calendar, 
  ExternalLink, 
  Scale, 
  GitBranch,
  AlertCircle,
  HardDrive,
  Sparkles,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RepoDetailModalProps {
  repo: GitHubRepository | null;
  open: boolean;
  onClose: () => void;
}

export function RepoDetailModal({ repo, open, onClose }: RepoDetailModalProps) {
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  useEffect(() => {
    if (open && repo) {
      setAiSummary(null);
      generateSummary();
    }
  }, [open, repo?.id]);

  const generateSummary = async () => {
    if (!repo) return;
    
    setLoadingSummary(true);
    try {
      const { data, error } = await supabase.functions.invoke('summarize-repo', {
        body: {
          type: 'repo-summary',
          repoData: {
            name: repo.name,
            description: repo.description,
            language: repo.language,
            stargazers_count: repo.stargazers_count,
            forks_count: repo.forks_count,
            topics: repo.topics,
            license: repo.license,
            updated_at: repo.updated_at,
          }
        }
      });

      if (error) throw error;
      setAiSummary(data.summary);
    } catch (err) {
      console.error('Failed to generate summary:', err);
      toast.error('Failed to generate AI summary');
    } finally {
      setLoadingSummary(false);
    }
  };

  if (!repo) return null;

  const formatDate = (dateStr: string) => 
    format(new Date(dateStr), 'MMM d, yyyy');

  const formatSize = (kb: number) => {
    if (kb < 1024) return `${kb} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <span className="text-foreground">{repo.name}</span>
            {repo.archived && <Badge variant="outline">Archived</Badge>}
            {repo.fork && <Badge variant="secondary">Fork</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {repo.description && (
            <p className="text-muted-foreground">{repo.description}</p>
          )}

          {/* AI Summary Section */}
          <div className="bg-secondary/30 rounded-lg p-4 border border-primary/20">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-foreground">AI Summary</h3>
            </div>
            {loadingSummary ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generating intelligent summary...</span>
              </div>
            ) : aiSummary ? (
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{aiSummary}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Unable to generate summary.</p>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard icon={Star} label="Stars" value={repo.stargazers_count.toLocaleString()} />
            <StatCard icon={GitFork} label="Forks" value={repo.forks_count.toLocaleString()} />
            <StatCard icon={Eye} label="Watchers" value={repo.watchers_count.toLocaleString()} />
            <StatCard icon={AlertCircle} label="Issues" value={repo.open_issues_count.toLocaleString()} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <InfoRow icon={GitBranch} label="Default Branch" value={repo.default_branch} />
            <InfoRow icon={HardDrive} label="Size" value={formatSize(repo.size)} />
            <InfoRow icon={Calendar} label="Created" value={formatDate(repo.created_at)} />
            <InfoRow icon={Calendar} label="Last Updated" value={formatDate(repo.updated_at)} />
            {repo.license && (
              <InfoRow icon={Scale} label="License" value={repo.license.name} />
            )}
            {repo.language && (
              <InfoRow icon={Star} label="Primary Language" value={repo.language} />
            )}
          </div>

          {repo.topics && repo.topics.length > 0 && (
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Topics</p>
              <div className="flex flex-wrap gap-2">
                {repo.topics.map((topic) => (
                  <Badge
                    key={topic}
                    variant="secondary"
                    className="bg-primary/10 text-primary"
                  >
                    {topic}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Button asChild className="w-full" size="lg">
            <a href={repo.html_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Open on GitHub
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="bg-secondary/50 rounded-lg p-3 text-center">
      <Icon className="h-5 w-5 mx-auto text-primary mb-1" />
      <p className="text-lg font-semibold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}:</span>
      <span className="font-medium text-foreground truncate">{value}</span>
    </div>
  );
}
