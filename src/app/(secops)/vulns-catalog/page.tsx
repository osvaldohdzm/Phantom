import { BookOpen } from "lucide-react";
import { VulnsCatalog } from "@/components/vulns-catalog";

export default function VulnsCatalogPage() {
  return (
    <div className="p-6 md:p-10 max-w-[1400px] mx-auto space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-50 flex items-center gap-2">
          <BookOpen className="size-8 text-emerald-400" />
          Catálogo Operativo de Vulnerabilidades
        </h1>
        <p className="text-slate-400 max-w-3xl">
          Gestión integral de la base <code className="text-slate-300">core.vulns_catalog</code> (v7.0.12). 
          Visualización y edición de definiciones estándar, severidades y traducciones técnicas.
        </p>
      </div>
      <VulnsCatalog />
    </div>
  );
}
