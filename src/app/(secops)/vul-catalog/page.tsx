import { Database } from "lucide-react";
import { VulnerabilityCatalog } from "@/components/vulnerability-catalog";

export default function VulnerabilityCatalogPage() {
  return (
    <div className="p-6 md:p-10 max-w-[1400px] mx-auto space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-50 flex items-center gap-2">
          <Database className="size-7 text-cyan-300" />
          Catálogo de vulnerabilidades
        </h1>
        <p className="text-slate-400 max-w-3xl">
          Edición y búsqueda profesional sobre <code className="text-slate-300">core.vulnerabilities</code> en
          PostgreSQL local. Usa filtros, paginación y editor de campos permitidos.
        </p>
      </div>
      <VulnerabilityCatalog />
    </div>
  );
}
