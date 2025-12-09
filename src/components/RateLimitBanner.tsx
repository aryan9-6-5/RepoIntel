import { RateLimitInfo } from '@/types/github';
import { AlertCircle, Clock } from 'lucide-react';

interface RateLimitBannerProps {
  rateLimit: RateLimitInfo;
}

export function RateLimitBanner({ rateLimit }: RateLimitBannerProps) {
  const resetDate = new Date(rateLimit.reset * 1000);
  const percentage = (rateLimit.remaining / rateLimit.limit) * 100;
  const isLow = percentage < 20;

  if (!isLow) return null;

  return (
    <div className="glass-card p-4 border-amber-500/30 bg-amber-500/5 animate-fade-in">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-medium text-foreground">API Rate Limit Warning</p>
          <p className="text-sm text-muted-foreground mt-1">
            You have <span className="font-medium text-amber-500">{rateLimit.remaining}</span> of{' '}
            {rateLimit.limit} requests remaining.
          </p>
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>Resets at {resetDate.toLocaleTimeString()}</span>
          </div>
        </div>
      </div>
      <div className="mt-3 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-amber-500 to-red-500 transition-all duration-500"
          style={{ width: `${100 - percentage}%` }}
        />
      </div>
    </div>
  );
}
