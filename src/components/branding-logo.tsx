'use client';

import { cn } from '@/lib/utils';
import { pickLogoUrl, type TenantBranding } from '@/lib/tenant-branding';
import { useTheme } from '@/components/theme-provider';

type BrandingLogoProps = {
  branding: TenantBranding;
  className?: string;
  /** Texto si no hay imagen */
  fallback?: string;
  size?: 'sm' | 'md' | 'lg';
};

const SIZE = {
  sm: { box: 'h-7 w-7', text: 'text-xs' },
  md: { box: 'h-9 w-9', text: 'text-sm' },
  lg: { box: 'h-12 w-12', text: 'text-base' },
};

export function BrandingLogo({ branding, className, fallback, size = 'md' }: BrandingLogoProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const src = pickLogoUrl(branding, isDark);
  const dims = SIZE[size];

  if (src) {
    return (
      <span
        className={cn('relative inline-flex shrink-0 overflow-hidden rounded-md bg-background/50', dims.box, className)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="h-full w-full object-contain" />
      </span>
    );
  }

  const label = fallback?.trim() || branding.workspace_name?.[0] || branding.product_name?.[0] || 'P';
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md bg-primary/15 font-semibold text-primary uppercase',
        dims.box,
        dims.text,
        className
      )}
    >
      {label.slice(0, 2)}
    </span>
  );
}
