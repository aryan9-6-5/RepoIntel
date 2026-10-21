import { useState, FormEvent } from 'react';
import { Search, Github, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface ProfileInputProps {
  onSubmit: (input: string) => void;
  loading?: boolean;
  /** hide the example links (used while a repository analysis is open) */
  compact?: boolean;
}

export function ProfileInput({ onSubmit, loading, compact }: ProfileInputProps) {
  const [input, setInput] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim() && !loading) {
      onSubmit(input.trim());
    }
  };

  const handleQuickSelect = (val: string) => {
    setInput(val);
    if (!loading) {
      onSubmit(val);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="relative flex gap-3">
        <div className="relative flex-1">
          <Github className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Username or owner/repo"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="pl-12 pr-4 h-14 text-base bg-card border-border shadow-sm focus:border-primary/50"
            disabled={loading}
          />
        </div>
        <Button
          type="submit"
          size="lg"
          disabled={!input.trim() || loading}
          aria-label="Fetch repos"
          className="h-14 px-8 shadow-sm transition-transform active:scale-95"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Search className="h-5 w-5" />
          )}
          <span className="hidden sm:inline ml-2">Fetch Repos</span>
        </Button>
      </div>
      {!compact && (
        <p className="text-sm text-muted-foreground mt-3 text-center">
          Try:{' '}
          <button
            type="button"
            onClick={() => handleQuickSelect('torvalds')}
            className="text-primary hover:underline font-medium rounded px-1 transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            torvalds
          </button>
          ,{' '}
          <button
            type="button"
            onClick={() => handleQuickSelect('https://github.com/facebook')}
            className="text-primary hover:underline font-medium rounded px-1 transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            facebook
          </button>
          , or{' '}
          <button
            type="button"
            onClick={() => handleQuickSelect('vercel')}
            className="text-primary hover:underline font-medium rounded px-1 transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            vercel
          </button>
        </p>
      )}
    </form>
  );
}
