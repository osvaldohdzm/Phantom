'use client';

import type { Finding } from '@/lib/secops-api';
import { FindingHistoryTimeline } from '@/components/finding-history-timeline';
import { FindingMasterCatalogMeta } from '@/components/finding-master-catalog-meta';

type FindingDetailExtrasProps = {
  finding: Finding;
};

export function FindingDetailExtras({ finding }: FindingDetailExtrasProps) {
  return (
    <div className="space-y-3 border-t border-slate-800/60 pt-3">
      <FindingMasterCatalogMeta finding={finding} />
      <FindingHistoryTimeline finding={finding} />
    </div>
  );
}
