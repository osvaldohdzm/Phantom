'use client';

import type { UiMessageKey } from '@/lib/ui-locale';
import type { PentestMapNode, PentestTargetMapDocument } from '@/lib/pentest-target-map-schema';
import { collectLootInventory } from '@/lib/pentest-map-attack-graph';
import { getMapNodeIconDataUri } from '@/lib/pentest-target-map-icons';

type Props = {
  doc: PentestTargetMapDocument;
  isDark: boolean;
  t: (key: UiMessageKey) => string;
  onSelectNode: (id: string) => void;
};

function LootGroup({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section className="space-y-1">
      <h4 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title} ({count})
      </h4>
      <ul className="space-y-1">{children}</ul>
    </section>
  );
}

export function MapLootPanel({ doc, isDark, t, onSelectNode }: Props) {
  const inv = collectLootInventory(doc);
  const total =
    inv.credentials.length +
    inv.hashes.length +
    inv.sshKeys.length +
    inv.flags.length +
    inv.loot.length +
    inv.sessions.length;

  const renderItem = (n: PentestMapNode) => (
    <li key={n.id}>
      <button
        type="button"
        onClick={() => onSelectNode(n.id)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted/40"
      >
        <img src={getMapNodeIconDataUri(n.kind, isDark)} alt="" className="size-5 shrink-0" />
        <span className="min-w-0 truncate">{n.label}</span>
      </button>
    </li>
  );

  return (
    <div className="space-y-3 p-3">
      <div>
        <p className="text-xs font-semibold text-foreground">{t('phantomMapLootInventory')}</p>
        <p className="text-[10px] text-muted-foreground">{t('phantomMapLootHint')}</p>
      </div>

      {total === 0 ? (
        <p className="text-[11px] text-muted-foreground">{t('phantomMapLootEmpty')}</p>
      ) : (
        <div className="space-y-3">
          <LootGroup title={t('phantomMapLootSessions')} count={inv.sessions.length}>
            {inv.sessions.map(renderItem)}
          </LootGroup>
          <LootGroup title={t('phantomMapLootCreds')} count={inv.credentials.length}>
            {inv.credentials.map(renderItem)}
          </LootGroup>
          <LootGroup title={t('phantomMapLootHashes')} count={inv.hashes.length}>
            {inv.hashes.map(renderItem)}
          </LootGroup>
          <LootGroup title={t('phantomMapLootKeys')} count={inv.sshKeys.length}>
            {inv.sshKeys.map(renderItem)}
          </LootGroup>
          <LootGroup title={t('phantomMapLootFlags')} count={inv.flags.length}>
            {inv.flags.map(renderItem)}
          </LootGroup>
          <LootGroup title={t('phantomMapLootItems')} count={inv.loot.length}>
            {inv.loot.map(renderItem)}
          </LootGroup>
        </div>
      )}
    </div>
  );
}
