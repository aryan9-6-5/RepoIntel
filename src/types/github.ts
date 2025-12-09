export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  open_issues_count: number;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  size: number;
  default_branch: string;
  topics: string[];
  fork: boolean;
  archived: boolean;
  visibility: string;
  license: {
    name: string;
    spdx_id: string;
  } | null;
}

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  name: string | null;
  bio: string | null;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
}

export type SortOption = 'stars' | 'updated' | 'name' | 'created';
export type SortDirection = 'asc' | 'desc';

export interface FilterState {
  search: string;
  language: string;
  sortBy: SortOption;
  sortDirection: SortDirection;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}
