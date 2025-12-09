import { useState, FormEvent } from 'react';
import { Search, Github, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface ProfileInputProps {
  onSubmit: (input: string) => void;
  loading?: boolean;
}

export function ProfileInput({ onSubmit, loading }: ProfileInputProps) {
  const [input, setInput] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim() && !loading) {
      onSubmit(input.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="relative flex gap-3">
        <div className="relative flex-1">
          <Github className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Enter GitHub username or profile URL..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="pl-12 pr-4 h-14 text-base bg-card/60 border-border/60"
            disabled={loading}
          />
        </div>
        <Button
          type="submit"
          size="lg"
          disabled={!input.trim() || loading}
          className="h-14 px-8"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Search className="h-5 w-5" />
          )}
          <span className="hidden sm:inline ml-2">Fetch Repos</span>
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mt-3 text-center">
        Try: <button type="button" onClick={() => setInput('torvalds')} className="text-primary hover:underline">torvalds</button>,{' '}
        <button type="button" onClick={() => setInput('https://github.com/facebook')} className="text-primary hover:underline">facebook</button>, or{' '}
        <button type="button" onClick={() => setInput('vercel')} className="text-primary hover:underline">vercel</button>
      </p>
    </form>
  );
}
