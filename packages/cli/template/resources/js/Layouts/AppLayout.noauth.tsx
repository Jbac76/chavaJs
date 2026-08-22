import { Link, usePage } from '@inertiajs/react';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { ThemeToggle } from '@/Components/theme-toggle';
import { cn } from '@/lib/utils';
import { useInertiaTransition } from '@/hooks/use-inertia-transition';

interface SharedProps {
  hasDocs?: boolean;
}

export default function AppLayout({ children }: { children?: ReactNode }) {
  const { url, props } = usePage<{ hasDocs?: boolean }>();
  const hasDocs = props.hasDocs ?? false;
  const transition = useInertiaTransition();

  const NAV_ITEMS = [
    { href: '/', label: 'Home' },
    { href: '/about', label: 'About' },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-mono text-sm font-bold text-primary-foreground shadow-sm">
              L
            </span>
            <span className="font-display text-lg font-bold tracking-tight">
              chava<span className="text-primary">Js</span>
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  url === item.href
                    ? 'bg-secondary text-secondary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                {item.label}
              </Link>
            ))}

            {hasDocs && (
              <Link
                href="/docs"
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  url.startsWith('/docs')
                    ? 'bg-secondary text-secondary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                Docs
              </Link>
            )}

            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <motion.div {...transition}>{children}</motion.div>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <p>chavaJs — the Laravel framework for Node.js.</p>
          <p className="font-mono text-xs">100% JS/TS · 0% PHP</p>
        </div>
      </footer>
    </div>
  );
}
