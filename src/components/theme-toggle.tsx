'use client';

import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/theme-provider';

type ThemeToggleProps = {
  className?: string;
  compact?: boolean;
};

export function ThemeToggle({ className, compact }: ThemeToggleProps) {
  const { theme, toggleTheme, mounted } = useTheme();
  const isDark = theme === 'dark';

  const sizeClass = compact ? 'h-9 w-[4.25rem]' : 'h-11 w-[5.25rem]';
  const thumbClass = compact ? 'size-7' : 'size-9';
  const thumbOffset = compact ? 'translate-x-[2.125rem]' : 'translate-x-[2.625rem]';
  const iconClass = compact ? 'size-3.5' : 'size-4';

  if (!mounted) {
    return (
      <div
        className={cn(
          'inline-flex shrink-0 items-center rounded-full border border-border bg-muted/60 p-1',
          sizeClass,
          className
        )}
        aria-hidden
      />
    );
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={isDark ? 'Modo claro' : 'Modo oscuro'}
      onClick={toggleTheme}
      className={cn(
        'group relative inline-flex items-center rounded-full border border-border bg-muted/60 p-1 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40',
        sizeClass,
        className
      )}
    >
      <span
        className={cn(
          'pointer-events-none absolute rounded-full bg-card shadow-sm border border-border transition-transform duration-300 ease-out',
          thumbClass,
          isDark ? thumbOffset : 'translate-x-0'
        )}
      />
      <span className="relative z-10 flex w-full items-center justify-between px-2">
        <Sun
          className={cn(
            'shrink-0 transition-colors duration-200',
            iconClass,
            !isDark ? 'text-amber-500' : 'text-muted-foreground/50'
          )}
          strokeWidth={2}
        />
        <Moon
          className={cn(
            'shrink-0 transition-colors duration-200',
            iconClass,
            isDark ? 'text-primary' : 'text-muted-foreground/50'
          )}
          strokeWidth={2}
        />
      </span>
    </button>
  );
}
