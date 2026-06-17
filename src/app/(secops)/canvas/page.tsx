"use client";

import { Layout } from "lucide-react";
import dynamic from "next/dynamic";

const HackerCanvas = dynamic(
  () => import("@/components/hacker-canvas").then((mod) => mod.HackerCanvas),
  { ssr: false }
);

export default function CanvasPage() {
  return (
    <div className="p-6 md:p-10 max-w-[1600px] mx-auto space-y-6 h-screen flex flex-col">
      <div className="space-y-2 shrink-0">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Layout className="size-8 text-cyan-600 dark:text-cyan-400" />
          Evidence Hacker Canvas
        </h1>
          <p className="text-muted-foreground max-w-3xl">
            Pega capturas (Ctrl+V), marca hallazgos con flechas y rectángulos, censura datos sensibles y exporta
            en PNG o al portapapeles.
          </p>
      </div>
      <HackerCanvas />
    </div>
  );
}
