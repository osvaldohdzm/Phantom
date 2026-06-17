'use client';

import Link from 'next/link';
import { BrandingLogo } from '@/components/branding-logo';
import { useBranding } from '@/contexts/branding-context';

export function PortalBrandingHeader() {
  const { branding, workspaceName, productName } = useBranding();

  return (
    <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <BrandingLogo branding={branding} size="sm" />
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-muted-foreground truncate">{productName}</p>
          <h1 className="text-lg font-semibold truncate">{workspaceName}</h1>
        </div>
      </div>
      <Link href="/" className="text-sm text-primary hover:underline underline-offset-2 shrink-0">
        SecOps
      </Link>
    </div>
  );
}
