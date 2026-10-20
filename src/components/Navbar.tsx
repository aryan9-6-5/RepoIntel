import { Link, useLocation } from 'react-router-dom';

const TABS = [
  { to: '/', label: 'Profile explorer' },
  { to: '/import', label: 'Code analysis' },
];

export function Navbar() {
  const { pathname } = useLocation();
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link to="/" className="font-semibold text-foreground">RepoPilot</Link>
        <nav aria-label="Main" className="flex gap-1">
          {TABS.map(({ to, label }) => {
            const active = to === '/' ? pathname === '/' : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex min-h-[40px] items-center rounded-md px-3 text-sm md:min-h-[32px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${active ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
