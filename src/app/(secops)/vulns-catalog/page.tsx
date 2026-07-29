'use client';

import { Suspense } from "react";
import { BookOpen } from "lucide-react";
import { VulnsCatalog } from "@/components/vulns-catalog";

export default function VulnsCatalogPage() {
  return (
    <div className="p-6 md:p-10 max-w-[1400px] mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2.5">
            <BookOpen className="size-8 text-emerald-500" />
            Catálogo Operativo de Vulnerabilidades
          </h1>
          <p className="text-muted-foreground max-w-3xl text-sm">
            Gestión de <code className="rounded bg-muted px-1.5 py-0.5 text-foreground/90 font-mono text-xs">core.vulns_catalog</code>: importar/exportar CSV, editar entradas y alimentar la ingesta Nessus (nombre, severidad, descripción, amenaza y remediación por Plugin ID).
          </p>
        </div>
      </div>

      {/* Operational Catalog & Nessus Ingest */}
      <div className="space-y-4 animate-in fade-in duration-150">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando catálogo operativo…</p>}>
          <VulnsCatalog />
        </Suspense>
      </div>
    </div>
  );
}
