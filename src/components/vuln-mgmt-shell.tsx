'use client';

import { type ReactNode } from 'react';
import { useUiT } from '@/lib/use-ui-locale';
import { VulnMgmtNav } from '@/components/vuln-mgmt-nav';

export function VulnMgmtShell({ children }: { children: ReactNode }) {
  const { t } = useUiT();

  return (
    <div className="p-6 md:p-10 max-w-[min(100%,1440px)] mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t('vulMgmtTitle')}</h1>
        <p className="text-muted-foreground mt-2 max-w-3xl">{t('vulMgmtSubtitle')}</p>
      </div>
      <VulnMgmtNav />
      {children}
    </div>
  );
}
