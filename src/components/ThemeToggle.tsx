import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const next = resolvedTheme === 'dark' ? 'light' : 'dark';

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setTheme(next)}
      className="h-9 w-9 rounded-full"
      title={`Switch to ${next} mode`}
      aria-label={`Switch to ${next} mode`}
    >
      <Sun className="h-4 w-4 dark:hidden" />
      <Moon className="hidden h-4 w-4 dark:block" />
    </Button>
  );
}
