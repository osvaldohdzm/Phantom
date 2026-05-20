import { Layout } from "lucide-react";
import { HackerCanvas } from "@/components/hacker-canvas";

export default function CanvasPage() {
  return (
    <div className="p-6 md:p-10 max-w-[1600px] mx-auto space-y-6 h-screen flex flex-col">
      <div className="space-y-2 shrink-0">
        <h1 className="text-3xl font-bold text-slate-50 flex items-center gap-2">
          <Layout className="size-8 text-cyan-400" />
          Evidence Hacker Canvas
        </h1>
        <p className="text-slate-400 max-w-3xl">
          Lienzo profesional para apilar, organizar y redimensionar evidencias. 
          Pega capturas directamente desde tu portapapeles y exporta composiciones de alta calidad.
        </p>
      </div>
      <HackerCanvas />
    </div>
  );
}
