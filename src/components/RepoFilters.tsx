import { Search, SlidersHorizontal, ArrowUpDown, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FilterState, SortOption, SortDirection, GitHubRepository } from '@/types/github';

interface RepoFiltersProps {
  filters: FilterState;
  languages: string[];
  onFilterChange: (filters: Partial<FilterState>) => void;
  onExport: () => void;
  totalRepos: number;
  filteredCount: number;
}

export function RepoFilters({
  filters,
  languages,
  onFilterChange,
  onExport,
  totalRepos,
  filteredCount,
}: RepoFiltersProps) {
  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'stars', label: 'Stars' },
    { value: 'updated', label: 'Recently Updated' },
    { value: 'created', label: 'Recently Created' },
    { value: 'name', label: 'Name' },
  ];

  const toggleSortDirection = () => {
    onFilterChange({
      sortDirection: filters.sortDirection === 'desc' ? 'asc' : 'desc',
    });
  };

  return (
    <div className="glass-card p-4 animate-fade-in">
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search repositories..."
            value={filters.search}
            onChange={(e) => onFilterChange({ search: e.target.value })}
            className="pl-10 h-10"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={filters.language}
            onValueChange={(value) => onFilterChange({ language: value })}
          >
            <SelectTrigger className="w-[160px] h-10 bg-secondary/50">
              <SlidersHorizontal className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Languages</SelectItem>
              {languages.map((lang) => (
                <SelectItem key={lang} value={lang}>
                  {lang}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.sortBy}
            onValueChange={(value) => onFilterChange({ sortBy: value as SortOption })}
          >
            <SelectTrigger className="w-[180px] h-10 bg-secondary/50">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={toggleSortDirection}
            className="h-10 w-10"
            title={filters.sortDirection === 'desc' ? 'Descending' : 'Ascending'}
          >
            <ArrowUpDown className={`h-4 w-4 transition-transform ${filters.sortDirection === 'asc' ? 'rotate-180' : ''}`} />
          </Button>

          <Button variant="glass" size="sm" onClick={onExport} className="h-10">
            <Download className="h-4 w-4 mr-2" />
            Export JSON
          </Button>
        </div>
      </div>
      
      <div className="mt-3 text-sm text-muted-foreground">
        Showing <span className="font-medium text-foreground">{filteredCount}</span> of{' '}
        <span className="font-medium text-foreground">{totalRepos}</span> repositories
      </div>
    </div>
  );
}
