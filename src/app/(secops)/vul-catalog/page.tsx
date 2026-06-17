import { Database } from "lucide-react";
import { VulnerabilityCatalog } from "@/components/vulnerability-catalog";

export default function VulnerabilityCatalogPage() {
  return (
    <div className="p-6 md:p-10 max-w-[1400px] mx-auto space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Database className="size-7 text-cyan-600 dark:text-cyan-400" />
          Catálogo de vulnerabilidades
        </h1>
        <p className="text-muted-foreground max-w-3xl">
          Edición y búsqueda profesional sobre{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-foreground/90">core.vulnerabilities</code> en
          PostgreSQL local. Usa filtros, paginación y editor de campos permitidos.
        </p>
      </div>
      <VulnerabilityCatalog />
    </div>
  );
}
