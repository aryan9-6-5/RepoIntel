import { GitHubUser } from '@/types/github';
import { ExternalLink, Users, BookOpen, Calendar, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { GitHubRepository } from '@/types/github';

interface UserProfileProps {
  user: GitHubUser;
  repositories: GitHubRepository[];
}

export function UserProfile({ user, repositories }: UserProfileProps) {
  const [profileSummary, setProfileSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const joinDate = new Date(user.created_at).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });

  const generateProfileSummary = async () => {
    setLoadingSummary(true);
    try {
      const { data, error } = await supabase.functions.invoke('summarize-repo', {
        body: {
          type: 'profile-summary',
          profileData: {
            user: {
              login: user.login,
              name: user.name,
              bio: user.bio,
              public_repos: user.public_repos,
              followers: user.followers,
            },
            repositories: repositories.map(r => ({
              name: r.name,
              description: r.description,
              language: r.language,
              stargazers_count: r.stargazers_count,
              topics: r.topics,
            }))
          }
        }
      });

      if (error) throw error;
      setProfileSummary(data.summary);
    } catch (err) {
      console.error('Failed to generate profile summary:', err);
      toast.error('Failed to generate profile summary');
    } finally {
      setLoadingSummary(false);
    }
  };

  return (
    <div className="glass-card p-6 animate-fade-in space-y-4">
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
        <img
          src={user.avatar_url}
          alt={`${user.login}'s avatar`}
          className="w-20 h-20 rounded-full ring-2 ring-primary/20"
        />
        <div className="flex-1 text-center sm:text-left">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <h2 className="text-xl font-semibold text-foreground">
              {user.name || user.login}
            </h2>
            <span className="text-muted-foreground font-mono text-sm">@{user.login}</span>
          </div>
          {user.bio && (
            <p className="text-muted-foreground mt-2 text-sm max-w-lg">{user.bio}</p>
          )}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" />
              <span className="font-medium text-foreground">{user.public_repos}</span> repos
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              <span className="font-medium text-foreground">{user.followers.toLocaleString()}</span> followers
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              Joined {joinDate}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild>
            <a href={user.html_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" />
              View Profile
            </a>
          </Button>
          <Button 
            variant="default" 
            size="sm" 
            onClick={generateProfileSummary}
            disabled={loadingSummary}
          >
            {loadingSummary ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-1" />
            )}
            AI Analysis
          </Button>
        </div>
      </div>

      {/* AI Profile Summary */}
      {profileSummary && (
        <div className="bg-secondary/30 rounded-lg p-4 border border-primary/20 mt-4 animate-fade-in">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Developer Profile Analysis</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{profileSummary}</p>
        </div>
      )}
    </div>
  );
}
