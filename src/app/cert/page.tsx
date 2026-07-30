'use client';

import React, { useState } from 'react';
import { ShieldCheck, Download, Check, ArrowLeft, HelpCircle } from 'lucide-react';
import Link from 'next/link';

export default function CertPage() {
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const handleDownload = () => {
    setDownloading(true);
    const link = document.createElement('a');
    link.href = '/api/cert';
    link.download = 'phantom-root.crt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      setDownloading(false);
      setDownloaded(true);
    }, 1500);
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 font-sans selection:bg-emerald-500/30">
      {/* Background Decorative Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-cyan-500/5 rounded-full blur-[100px]" />
      </div>

      <div className="relative w-full max-w-2xl bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md space-y-6 sm:space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="relative size-16 sm:size-20 flex items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/30 shadow-lg shadow-emerald-500/5 animate-pulse">
            <ShieldCheck className="size-10 sm:size-12 text-emerald-400" />
            <div className="absolute -top-1 -right-1 size-3 bg-emerald-400 rounded-full ring-4 ring-zinc-900" />
          </div>
          
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-50">
              Instalar Certificado Root CA
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
              Configura HTTPS seguro (candado verde) para acceder de forma confiable a la consola local y remota de Phantom.
            </p>
          </div>
        </div>

        {/* Action / Download Section */}
        <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <div className="text-xs sm:text-sm font-semibold text-zinc-200">
              Certificado Root de Seguridad (CA)
            </div>
            <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 font-mono">
              phantom-root.crt • Formato X509 (.pem/.crt)
            </div>
          </div>
          
          <button
            onClick={handleDownload}
            disabled={downloading}
            className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
              downloaded 
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white' 
                : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/10'
            }`}
          >
            {downloading ? (
              <>
                <span className="size-3.5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin mr-1" />
                Descargando...
              </>
            ) : downloaded ? (
              <>
                <Check className="size-4" />
                Descargado con éxito
              </>
            ) : (
              <>
                <Download className="size-4" />
                Descargar Certificado
              </>
            )}
          </button>
        </div>

        {/* Installation Guide Tabs / Accordion */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <HelpCircle className="size-4 text-emerald-400" />
            Guía de Instalación en Windows
          </div>

          <div className="grid grid-cols-1 gap-3.5 text-xs text-zinc-300">
            <div className="flex gap-3.5 p-3.5 rounded-xl border border-zinc-800/60 bg-zinc-950/40">
              <div className="size-5 shrink-0 flex items-center justify-center rounded bg-zinc-800 text-zinc-400 font-bold font-mono">
                1
              </div>
              <div className="space-y-1">
                <div className="font-semibold text-zinc-100">Descarga y Abre el Certificado</div>
                <p className="text-[11px] text-muted-foreground">
                  Haz clic en el botón de arriba para descargar <code className="text-emerald-400 font-mono">phantom-root.crt</code>. Una vez descargado, haz doble clic en el archivo para iniciar el Asistente de Importación.
                </p>
              </div>
            </div>

            <div className="flex gap-3.5 p-3.5 rounded-xl border border-zinc-800/60 bg-zinc-950/40">
              <div className="size-5 shrink-0 flex items-center justify-center rounded bg-zinc-800 text-zinc-400 font-bold font-mono">
                2
              </div>
              <div className="space-y-1">
                <div className="font-semibold text-zinc-100">Ubicación del Almacén</div>
                <p className="text-[11px] text-muted-foreground">
                  En la primera ventana del asistente, haz clic en **Instalar certificado...**. Selecciona **Equipo local** (Local Machine) para que aplique a todos los navegadores del sistema y haz clic en Siguiente.
                </p>
              </div>
            </div>

            <div className="flex gap-3.5 p-3.5 rounded-xl border border-zinc-800/60 bg-zinc-950/40">
              <div className="size-5 shrink-0 flex items-center justify-center rounded bg-zinc-800 text-zinc-400 font-bold font-mono">
                3
              </div>
              <div className="space-y-1">
                <div className="font-semibold text-zinc-100">Seleccionar Almacén de Raíz de Confianza</div>
                <p className="text-[11px] text-muted-foreground">
                  Selecciona la opción **Colocar todos los certificados en el siguiente almacén**. Haz clic en Examinar y selecciona **Entidades de certificación de raíz de confianza** (Trusted Root Certification Authorities).
                </p>
              </div>
            </div>

            <div className="flex gap-3.5 p-3.5 rounded-xl border border-zinc-800/60 bg-zinc-950/40">
              <div className="size-5 shrink-0 flex items-center justify-center rounded bg-zinc-800 text-zinc-400 font-bold font-mono">
                4
              </div>
              <div className="space-y-1">
                <div className="font-semibold text-zinc-100">Finalizar y Reiniciar Navegador</div>
                <p className="text-[11px] text-muted-foreground">
                  Haz clic en Siguiente, luego en Finalizar y confirma el diálogo de advertencia de seguridad. Finalmente, **cierra por completo y reinicia tu navegador** (Chrome, Edge, Brave, etc.) para que se aplique la confianza HTTPS.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="border-t border-zinc-800/80 pt-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-zinc-100 transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Volver al Inicio de Sesión
          </Link>
          
          <div className="text-[10px] text-zinc-500 font-mono">
            Powered by Spectre TLS Engine
          </div>
        </div>

      </div>
    </main>
  );
}
