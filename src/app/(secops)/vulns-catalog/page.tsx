import { Suspense } from "react";
import { BookOpen } from "lucide-react";
import { VulnsCatalog } from "@/components/vulns-catalog";

export default function VulnsCatalogPage() {
  return (
    <div className="p-6 md:p-10 max-w-[1400px] mx-auto space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <BookOpen className="size-8 text-emerald-600 dark:text-emerald-400" />
          Catálogo Operativo de Vulnerabilidades
        </h1>
        <p className="text-muted-foreground max-w-3xl">
          Gestión de <code className="rounded bg-muted px-1.5 py-0.5 text-foreground/90">core.vulns_catalog</code>: importar/exportar CSV, editar entradas
          y alimentar la ingesta Nessus (nombre, severidad, descripción, amenaza y remediación por Plugin ID).
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando catálogo…</p>}>
        <VulnsCatalog />
      </Suspense>
    </div>
  );
}
