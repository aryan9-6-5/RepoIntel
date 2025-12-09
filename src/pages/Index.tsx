import { useState, useMemo, useCallback } from 'react';
import { Github } from 'lucide-react';
import { ProfileInput } from '@/components/ProfileInput';
import { UserProfile } from '@/components/UserProfile';
import { RepoFilters } from '@/components/RepoFilters';
import { RepoCard } from '@/components/RepoCard';
import { RepoDetailModal } from '@/components/RepoDetailModal';
import { RateLimitBanner } from '@/components/RateLimitBanner';
import { EmptyState } from '@/components/EmptyState';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { useGitHubApi } from '@/hooks/useGitHubApi';
import { GitHubRepository, GitHubUser, FilterState } from '@/types/github';
import { toast } from 'sonner';

const REPOS_PER_PAGE = 12;

export default function Index() {
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepository | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    language: 'all',
    sortBy: 'stars',
    sortDirection: 'desc',
  });

  const {
    loading,
    error,
    rateLimit,
    extractUsername,
    fetchUser,
    fetchAllRepositories,
    setError,
  } = useGitHubApi();

  const handleSearch = async (input: string) => {
    const username = extractUsername(input);
    if (!username) {
      toast.error('Invalid GitHub username or URL');
      return;
    }

    setError(null);
    setUser(null);
    setRepositories([]);
    setCurrentPage(1);
    setFilters({
      search: '',
      language: 'all',
      sortBy: 'stars',
      sortDirection: 'desc',
    });

    try {
      const [userData, repos] = await Promise.all([
        fetchUser(username),
        fetchAllRepositories(username),
      ]);

      if (userData) {
        setUser(userData);
        setRepositories(repos);
        toast.success(`Found ${repos.length} repositories`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch data';
      toast.error(message);
    }
  };

  const languages = useMemo(() => {
    const langSet = new Set<string>();
    repositories.forEach((repo) => {
      if (repo.language) langSet.add(repo.language);
    });
    return Array.from(langSet).sort();
  }, [repositories]);

  const filteredAndSortedRepos = useMemo(() => {
    let result = [...repositories];

    // Filter by search
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(
        (repo) =>
          repo.name.toLowerCase().includes(searchLower) ||
          repo.description?.toLowerCase().includes(searchLower) ||
          repo.topics?.some((t) => t.toLowerCase().includes(searchLower))
      );
    }

    // Filter by language
    if (filters.language && filters.language !== 'all') {
      result = result.filter((repo) => repo.language === filters.language);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (filters.sortBy) {
        case 'stars':
          comparison = a.stargazers_count - b.stargazers_count;
          break;
        case 'updated':
          comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
          break;
        case 'created':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
      }
      return filters.sortDirection === 'desc' ? -comparison : comparison;
    });

    return result;
  }, [repositories, filters]);

  const paginatedRepos = useMemo(() => {
    const start = (currentPage - 1) * REPOS_PER_PAGE;
    return filteredAndSortedRepos.slice(start, start + REPOS_PER_PAGE);
  }, [filteredAndSortedRepos, currentPage]);

  const totalPages = Math.ceil(filteredAndSortedRepos.length / REPOS_PER_PAGE);

  const handleFilterChange = useCallback((newFilters: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    setCurrentPage(1);
  }, []);

  const handleExport = useCallback(() => {
    const data = JSON.stringify(filteredAndSortedRepos, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${user?.login || 'github'}-repositories.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Repositories exported successfully');
  }, [filteredAndSortedRepos, user]);

  const handleRepoClick = (repo: GitHubRepository) => {
    setSelectedRepo(repo);
    setModalOpen(true);
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative py-16 md:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl opacity-20" />
        
        <div className="container relative z-10 px-4 mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6 animate-pulse-glow">
              <Github className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
              <span className="text-gradient">GitHub</span> Repo Explorer
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Discover and explore public repositories from any GitHub profile. 
              Search, filter, sort, and export repository data with ease.
            </p>
          </div>

          <ProfileInput onSubmit={handleSearch} loading={loading} />
        </div>
      </section>

      {/* Content Section */}
      <section className="container px-4 mx-auto pb-16">
        {rateLimit && <RateLimitBanner rateLimit={rateLimit} />}

        {loading && <LoadingSkeleton />}

        {error && !loading && (
          <EmptyState type="error" message={error} />
        )}

        {!loading && !error && user && (
          <div className="space-y-6">
            <UserProfile user={user} repositories={repositories} />

            {repositories.length > 0 ? (
              <>
                <RepoFilters
                  filters={filters}
                  languages={languages}
                  onFilterChange={handleFilterChange}
                  onExport={handleExport}
                  totalRepos={repositories.length}
                  filteredCount={filteredAndSortedRepos.length}
                />

                {filteredAndSortedRepos.length > 0 ? (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      {paginatedRepos.map((repo, index) => (
                        <RepoCard
                          key={repo.id}
                          repo={repo}
                          onClick={() => handleRepoClick(repo)}
                          index={index}
                        />
                      ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-center gap-2 pt-6">
                        <button
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="px-4 py-2 text-sm font-medium rounded-lg bg-secondary text-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-secondary/80 transition-colors"
                        >
                          Previous
                        </button>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum: number;
                            if (totalPages <= 5) {
                              pageNum = i + 1;
                            } else if (currentPage <= 3) {
                              pageNum = i + 1;
                            } else if (currentPage >= totalPages - 2) {
                              pageNum = totalPages - 4 + i;
                            } else {
                              pageNum = currentPage - 2 + i;
                            }
                            return (
                              <button
                                key={pageNum}
                                onClick={() => setCurrentPage(pageNum)}
                                className={`w-10 h-10 text-sm font-medium rounded-lg transition-colors ${
                                  currentPage === pageNum
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-secondary text-foreground hover:bg-secondary/80'
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          })}
                        </div>
                        <button
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="px-4 py-2 text-sm font-medium rounded-lg bg-secondary text-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-secondary/80 transition-colors"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <EmptyState type="no-results" />
                )}
              </>
            ) : (
              <EmptyState type="no-repos" />
            )}
          </div>
        )}
      </section>

      <RepoDetailModal
        repo={selectedRepo}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </main>
  );
}
