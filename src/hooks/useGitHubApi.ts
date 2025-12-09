import { useState, useCallback } from 'react';
import { GitHubRepository, GitHubUser, RateLimitInfo } from '@/types/github';

const GITHUB_API_BASE = 'https://api.github.com';

export function useGitHubApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);

  const extractUsername = useCallback((input: string): string | null => {
    const trimmed = input.trim();
    
    // Direct username
    if (/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(trimmed)) {
      return trimmed;
    }
    
    // GitHub URL patterns
    const urlPatterns = [
      /github\.com\/([a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38})/,
      /^@([a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38})$/,
    ];
    
    for (const pattern of urlPatterns) {
      const match = trimmed.match(pattern);
      if (match) return match[1];
    }
    
    return null;
  }, []);

  const updateRateLimit = useCallback((headers: Headers) => {
    const limit = headers.get('x-ratelimit-limit');
    const remaining = headers.get('x-ratelimit-remaining');
    const reset = headers.get('x-ratelimit-reset');
    
    if (limit && remaining && reset) {
      setRateLimit({
        limit: parseInt(limit, 10),
        remaining: parseInt(remaining, 10),
        reset: parseInt(reset, 10),
      });
    }
  }, []);

  const fetchUser = useCallback(async (username: string): Promise<GitHubUser | null> => {
    try {
      const response = await fetch(`${GITHUB_API_BASE}/users/${username}`);
      updateRateLimit(response.headers);
      
      if (response.status === 404) {
        throw new Error('User not found. Please check the username and try again.');
      }
      
      if (response.status === 403) {
        const resetTime = response.headers.get('x-ratelimit-reset');
        const resetDate = resetTime ? new Date(parseInt(resetTime, 10) * 1000) : null;
        throw new Error(
          `API rate limit exceeded.${resetDate ? ` Try again after ${resetDate.toLocaleTimeString()}.` : ''}`
        );
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch user data. Please try again.');
      }
      
      return await response.json();
    } catch (err) {
      throw err;
    }
  }, [updateRateLimit]);

  const fetchRepositories = useCallback(async (
    username: string,
    page: number = 1,
    perPage: number = 30
  ): Promise<{ repos: GitHubRepository[]; hasMore: boolean }> => {
    try {
      const response = await fetch(
        `${GITHUB_API_BASE}/users/${username}/repos?page=${page}&per_page=${perPage}&sort=updated`
      );
      updateRateLimit(response.headers);
      
      if (response.status === 404) {
        throw new Error('User not found.');
      }
      
      if (response.status === 403) {
        const resetTime = response.headers.get('x-ratelimit-reset');
        const resetDate = resetTime ? new Date(parseInt(resetTime, 10) * 1000) : null;
        throw new Error(
          `API rate limit exceeded.${resetDate ? ` Try again after ${resetDate.toLocaleTimeString()}.` : ''}`
        );
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch repositories.');
      }
      
      const repos: GitHubRepository[] = await response.json();
      const linkHeader = response.headers.get('link');
      const hasMore = linkHeader?.includes('rel="next"') ?? false;
      
      return { repos, hasMore };
    } catch (err) {
      throw err;
    }
  }, [updateRateLimit]);

  const fetchAllRepositories = useCallback(async (username: string): Promise<GitHubRepository[]> => {
    setLoading(true);
    setError(null);
    
    try {
      const allRepos: GitHubRepository[] = [];
      let page = 1;
      let hasMore = true;
      
      while (hasMore) {
        const { repos, hasMore: more } = await fetchRepositories(username, page, 100);
        allRepos.push(...repos);
        hasMore = more;
        page++;
        
        // Safety limit to prevent infinite loops
        if (page > 10) break;
      }
      
      return allRepos;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchRepositories]);

  return {
    loading,
    error,
    rateLimit,
    extractUsername,
    fetchUser,
    fetchRepositories,
    fetchAllRepositories,
    setError,
  };
}
