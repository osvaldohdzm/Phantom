'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { unlockSharedMission } from '@/lib/secops-api';
import { Terminal as TerminalIcon, ShieldAlert, Key, Loader2, Download } from 'lucide-react';
import { TypewriterTerminal } from './TypewriterTerminal';
import { jsPDF } from 'jspdf';

export default function SharePage() {
  const params = useParams();
  const hash = params.hash as string;

  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [animationFinished, setAnimationFinished] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setError(false);
    try {
      const res = await unlockSharedMission(hash, code);
      setSnapshot(res.snapshot);
      setUnlocked(true);
    } catch (err) {
      setError(true);
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!snapshot) return;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter',
    });

    const startX = 20;
    const col1Width = 55;
    const col2Width = 120.9;
    let pageCount = 1;
    let y = 40;

    const projName = snapshot.nombre_proyecto || snapshot.cliente || 'Misión Secreta';

    const drawPageHeader = (pageNumber: number) => {
      // Logo Area Placeholder box
      doc.setDrawColor(180);
      doc.setLineWidth(0.2);
      doc.rect(startX, 15, 35, 12, 'D');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text('PHANTOM SECURITY', startX + 17.5, 21.5, { align: 'center', baseline: 'middle' });

      // Title & Project
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(30, 41, 59);
      doc.text('REPORTE EJECUTIVO DE SERVICIO', startX + 45, 20);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`Proyecto: ${projName}`, startX + 45, 25);

      // Export Date on the right
      const dateStr = new Date().toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      doc.text(`Fecha: ${dateStr}`, 195.9, 25, { align: 'right' });

      // Header Divider Line
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(startX, 32, 195.9, 32);
    };

    const drawPageFooter = (pageNumber: number) => {
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(startX, 260, 195.9, 260);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text('CONFIDENCIAL - REPORTES DE SEGURIDAD', startX, 265);
      doc.text(`Página ${pageNumber}`, 195.9, 265, { align: 'right' });
    };

    const drawSectionHeader = (title: string, yPos: number) => {
      doc.setFillColor(241, 245, 249);
      doc.rect(startX, yPos, 175.9, 8, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.rect(startX, yPos, 175.9, 8, 'D');

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      doc.text(title.toUpperCase(), startX + 3, yPos + 4.5, { baseline: 'middle' });
    };

    const checkPageSpace = (heightNeeded: number) => {
      if (y + heightNeeded > 255) {
        drawPageFooter(pageCount);
        doc.addPage();
        pageCount++;
        drawPageHeader(pageCount);
        y = 40;
      }
    };

    // Draw page 1 header
    drawPageHeader(1);

    // Build key-value rows
    const dataRows: [string, string][] = [];
    dataRows.push(['ID Engagement', hash.toUpperCase()]); // Renamed ID de Misión -> ID Engagement
    dataRows.push(['Cliente / Organización', snapshot.cliente]);
    if (snapshot.nombre_proyecto) dataRows.push(['Proyecto', snapshot.nombre_proyecto]);
    if (snapshot.estado) dataRows.push(['Estado de Servicio', snapshot.estado]);
    if (snapshot.responsable) dataRows.push(['Responsable', snapshot.responsable]);
    if (snapshot.tipo_servicio) dataRows.push(['Tipo de Servicio', snapshot.tipo_servicio]);
    if (snapshot.fecha_inicio) dataRows.push(['Fecha Inicio', snapshot.fecha_inicio]);
    if (snapshot.fecha_fin) dataRows.push(['Fecha Fin', snapshot.fecha_fin]);
    if (snapshot.tipo) dataRows.push(['Tipo de Proyecto', snapshot.tipo]);

    const p = snapshot.profile;
    if (p) {
      if (p.alcance && (p.alcance.ips || p.alcance.dominios || p.alcance.urls)) {
        dataRows.push(['[SECCIÓN]', 'PARÁMETROS DE ALCANCE (SCOPE)']);
        if (p.alcance.ips) dataRows.push(['IPs Objetivo', p.alcance.ips]);
        if (p.alcance.dominios) dataRows.push(['Dominios', p.alcance.dominios]);
        if (p.alcance.urls) dataRows.push(['URLs', p.alcance.urls]);
        if (p.alcance.ambientes) dataRows.push(['Ambientes', p.alcance.ambientes]);
        if (p.alcance.activos_incluidos) dataRows.push(['Activos Incluidos', p.alcance.activos_incluidos]);
        if (p.alcance.activos_excluidos) dataRows.push(['Activos Excluidos', p.alcance.activos_excluidos]);
      }

      if (p.tipo_analisis && (p.tipo_analisis.metodo || p.tipo_analisis.alcance_red)) {
        dataRows.push(['[SECCIÓN]', 'CONFIGURACIÓN DEL ANÁLISIS']);
        if (p.tipo_analisis.metodo) dataRows.push(['Método de Análisis', p.tipo_analisis.metodo]);
        if (p.tipo_analisis.alcance_red) dataRows.push(['Alcance de Red', p.tipo_analisis.alcance_red]);
        if (p.tipo_analisis.intrusivo) dataRows.push(['Intrusividad', p.tipo_analisis.intrusivo]);
      }

      if (p.accesos) {
        dataRows.push(['[SECCIÓN]', 'REQUISITOS DE ACCESO']);
        dataRows.push(['Credenciales Entregadas', p.accesos.credenciales_entregadas ? 'Sí' : 'No']);
        if (p.accesos.credenciales_notas) dataRows.push(['Notas de Credenciales', p.accesos.credenciales_notas]);
        dataRows.push(['VPN Requerida', p.accesos.vpn_requerida ? 'Sí' : 'No']);
        if (p.accesos.vpn_notas) dataRows.push(['Notas de VPN', p.accesos.vpn_notas]);
        dataRows.push(['Usuarios de Prueba', p.accesos.usuarios_prueba ? 'Sí' : 'No']);
        if (p.accesos.usuarios_prueba_notas) dataRows.push(['Notas de Usuarios', p.accesos.usuarios_prueba_notas]);
        dataRows.push(['Código Fuente Entregado', p.accesos.codigo_fuente_entregado ? 'Sí' : 'No']);
        if (p.accesos.codigo_fuente_notas) dataRows.push(['Notas de Código Fuente', p.accesos.codigo_fuente_notas]);
        dataRows.push(['Documentación Entregada', p.accesos.documentacion_entregada ? 'Sí' : 'No']);
        if (p.accesos.documentacion_notas) dataRows.push(['Notas de Documentación', p.accesos.documentacion_notas]);
      }

      if (p.reglas) {
        dataRows.push(['[SECCIÓN]', 'REGLAS DE COMPROMISO']);
        if (p.reglas.horarios_permitidos) dataRows.push(['Horarios Permitidos', p.reglas.horarios_permitidos]);
        dataRows.push(['DoS Permitido', p.reglas.dos_permitido ? 'Sí' : 'No']);
        dataRows.push(['Explotación Permitida', p.reglas.explotacion_permitida ? 'Sí' : 'No']);
        dataRows.push(['Ingeniería Social Permitida', p.reglas.ingenieria_social_permitida ? 'Sí' : 'No']);
        if (p.reglas.contacto_emergencia) dataRows.push(['Contacto Emergencia', p.reglas.contacto_emergencia]);
      }
    }

    // Draw main executive details section header
    drawSectionHeader('INFORMACIÓN GENERAL DEL SERVICIO', y);
    y += 10;

    for (const [label, val] of dataRows) {
      if (label === '[SECCIÓN]') {
        const rowHeight = 8;
        checkPageSpace(rowHeight + 4);
        drawSectionHeader(val, y);
        y += rowHeight + 2;
        continue;
      }

      const cleanVal = val === null || val === undefined ? '-' : String(val);
      const wrappedVal = doc.splitTextToSize(cleanVal, col2Width - 6);
      const rowHeight = Math.max(8, wrappedVal.length * 5 + 4);

      checkPageSpace(rowHeight);

      // Label column box
      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(0.2);
      doc.rect(startX, y, col1Width, rowHeight, 'FD');

      // Value column box
      doc.setFillColor(255, 255, 255);
      doc.rect(startX + col1Width, y, col2Width, rowHeight, 'FD');

      // Print label
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105); // slate-600
      doc.text(label, startX + 3, y + (rowHeight / 2), { baseline: 'middle' });

      // Print value
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42); // slate-900

      let valY = y + 4.5;
      for (const line of wrappedVal) {
        doc.text(line, startX + col1Width + 3, valY);
        valY += 5;
      }

      y += rowHeight;
    }

    // Draw page footer
    drawPageFooter(pageCount);

    doc.save(`Reporte_Ejecutivo_${projName.replace(/\s+/g, '_')}.pdf`);
  };

  const buildLines = () => {
    if (!snapshot) return [];
    const lines: string[] = [];
    lines.push(`ID DE MISIÓN: ${hash.toUpperCase()}`);
    lines.push(`CLIENTE: ${snapshot.cliente}`);
    if (snapshot.nombre_proyecto) lines.push(`PROYECTO: ${snapshot.nombre_proyecto}`);
    if (snapshot.estado) lines.push(`ESTADO ACTUAL: ${snapshot.estado.toUpperCase()}`);
    if (snapshot.responsable) lines.push(`RESPONSABLE: ${snapshot.responsable}`);
    if (snapshot.tipo_servicio) lines.push(`TIPO DE SERVICIO: ${snapshot.tipo_servicio}`);
    if (snapshot.fecha_inicio) lines.push(`FECHA INICIO: ${snapshot.fecha_inicio}`);
    if (snapshot.fecha_fin) lines.push(`FECHA FIN: ${snapshot.fecha_fin}`);
    if (snapshot.tipo) lines.push(`TIPO PROYECTO: ${snapshot.tipo}`);

    const p = snapshot.profile;
    if (p) {
      if (p.alcance && (p.alcance.ips || p.alcance.dominios || p.alcance.urls)) {
        lines.push('--- PARÁMETROS DE ALCANCE (SCOPE) ---');
        if (p.alcance.ips) lines.push(`IPS: ${p.alcance.ips}`);
        if (p.alcance.dominios) lines.push(`DOMINIOS: ${p.alcance.dominios}`);
        if (p.alcance.urls) lines.push(`URLS: ${p.alcance.urls}`);
        if (p.alcance.ambientes) lines.push(`AMBIENTES: ${p.alcance.ambientes}`);
        if (p.alcance.activos_incluidos) lines.push(`INCLUIDOS: ${p.alcance.activos_incluidos}`);
        if (p.alcance.activos_excluidos) lines.push(`EXCLUIDOS: ${p.alcance.activos_excluidos}`);
      }

      if (p.tipo_analisis && (p.tipo_analisis.metodo || p.tipo_analisis.alcance_red)) {
        lines.push('--- CONFIGURACIÓN DEL ANÁLISIS ---');
        if (p.tipo_analisis.metodo) lines.push(`MÉTODO: ${p.tipo_analisis.metodo}`);
        if (p.tipo_analisis.alcance_red) lines.push(`ALCANCE RED: ${p.tipo_analisis.alcance_red}`);
        if (p.tipo_analisis.intrusivo) lines.push(`INTRUSIVO: ${p.tipo_analisis.intrusivo}`);
      }

      if (p.accesos) {
        lines.push('--- REQUISITOS DE ACCESO ---');
        lines.push(`CREDENCIALES ENTREGADAS: ${p.accesos.credenciales_entregadas ? 'SÍ' : 'NO'}`);
        if (p.accesos.credenciales_notas) lines.push(`NOTAS CREDENCIALES: ${p.accesos.credenciales_notas}`);
        lines.push(`VPN REQUERIDA: ${p.accesos.vpn_requerida ? 'SÍ' : 'NO'}`);
        if (p.accesos.vpn_notas) lines.push(`NOTAS VPN: ${p.accesos.vpn_notas}`);
        lines.push(`USUARIOS DE PRUEBA: ${p.accesos.usuarios_prueba ? 'SÍ' : 'NO'}`);
        if (p.accesos.usuarios_prueba_notas) lines.push(`NOTAS USUARIOS: ${p.accesos.usuarios_prueba_notas}`);
        lines.push(`CÓDIGO FUENTE ENTREGADO: ${p.accesos.codigo_fuente_entregado ? 'SÍ' : 'NO'}`);
        if (p.accesos.codigo_fuente_notas) lines.push(`NOTAS CÓDIGO FUENTE: ${p.accesos.codigo_fuente_notas}`);
        lines.push(`DOCUMENTACIÓN ENTREGADA: ${p.accesos.documentacion_entregada ? 'SÍ' : 'NO'}`);
        if (p.accesos.documentacion_notas) lines.push(`NOTAS DOCUMENTACIÓN: ${p.accesos.documentacion_notas}`);
      }

      if (p.reglas) {
        lines.push('--- REGLAS DE COMPROMISO ---');
        if (p.reglas.horarios_permitidos) lines.push(`HORARIOS PERMITIDOS: ${p.reglas.horarios_permitidos}`);
        lines.push(`DENEGACIÓN DE SERVICIO (DoS) PERMITIDO: ${p.reglas.dos_permitido ? 'SÍ' : 'NO'}`);
        lines.push(`EXPLOTACIÓN DE VULNERABILIDADES: ${p.reglas.explotacion_permitida ? 'SÍ' : 'NO'}`);
        lines.push(`INGENIERÍA SOCIAL PERMITIDA: ${p.reglas.ingenieria_social_permitida ? 'SÍ' : 'NO'}`);
        if (p.reglas.contacto_emergencia) lines.push(`CONTACTO DE EMERGENCIA: ${p.reglas.contacto_emergencia}`);
      }
    }
    return lines;
  };

  const lines = buildLines();

  return (
    <div
      className="min-h-screen w-full relative flex flex-col items-center justify-center p-4 overflow-hidden bg-black text-green-400 select-none"
      style={{
        backgroundImage: "url('/image_1.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Google Font Preload */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=VT323&display=swap" />

      {/* Styled styles tag for special neon shadows and animations */}
      <style>{`
        .hacker-font {
          font-family: 'VT323', monospace;
        }
        .hacker-glow {
          text-shadow: 0 0 5px #10b981, 0 0 10px #10b981, 0 0 20px #047857;
        }
        .hacker-glow-red {
          text-shadow: 0 0 5px #ef4444, 0 0 10px #ef4444, 0 0 20px #b91c1c;
        }
        .scanlines {
          position: fixed;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(
            rgba(18, 16, 16, 0) 50%,
            rgba(0, 0, 0, 0.25) 50%
          );
          background-size: 100% 4px;
          z-index: 999;
        }
        .flicker {
          animation: terminal-flicker 0.15s infinite;
        }
        @keyframes terminal-flicker {
          0% { opacity: 0.98; }
          50% { opacity: 1; }
          100% { opacity: 0.99; }
        }
      `}</style>

      {/* Scanline overlay */}
      <div className="scanlines" />

      {/* Dark overlay to increase readability */}
      <div className="absolute inset-0 bg-black/80 z-0 pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-2xl z-10 relative flicker">
        {!unlocked ? (
          /* PHASE A: Authentication lock screen */
          <div className="w-full max-w-md mx-auto rounded-xl border-2 border-green-500/30 bg-black/90 p-8 shadow-[0_0_30px_rgba(16,185,129,0.15)] flex flex-col items-center">
            <div className="rounded-full border border-green-500/20 bg-green-500/5 p-4 mb-6 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
              <Key className="size-8 text-green-400 animate-pulse" />
            </div>

            <h2 className="hacker-font hacker-glow text-4xl sm:text-5xl text-center text-green-400 tracking-wider mb-8 font-bold">
              INGRESE CLAVE DE MISIÓN
            </h2>

            <form onSubmit={handleSubmit} className="w-full space-y-6">
              <div className="relative">
                <input
                  type="text"
                  maxLength={16}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    if (error) setError(false);
                  }}
                  disabled={loading}
                  placeholder="------"
                  className="w-full text-center bg-black border-2 border-green-500/40 rounded-lg py-3 px-4 font-mono text-2xl tracking-[0.4em] text-green-400 focus:outline-none focus:border-green-400 focus:shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all uppercase placeholder-green-900/60"
                  autoFocus
                />
              </div>

              {error && (
                <div className="hacker-font hacker-glow-red text-center text-2xl text-red-500 font-bold uppercase tracking-widest mb-4 animate-bounce">
                  ACCESO DENEGADO
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !code.trim()}
                className="w-full bg-green-950/40 hover:bg-green-900/60 border border-green-500/50 hover:border-green-400 text-green-400 py-3 rounded-lg font-mono text-sm tracking-widest transition-all hover:shadow-[0_0_10px_rgba(16,185,129,0.2)] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>VERIFICANDO...</span>
                  </>
                ) : (
                  <span>TRANSMITIR</span>
                )}
              </button>
            </form>
          </div>
        ) : (
          /* PHASE B: Mission details display */
          <div className="w-full rounded-xl border-2 border-green-500/40 bg-black/90 p-6 sm:p-8 shadow-[0_0_40px_rgba(16,185,129,0.2)] flex flex-col min-h-[500px]">
            {/* Header */}
            <div className="border-b border-green-500/30 pb-4 mb-6">
              <div className="flex items-center gap-2 mb-2 text-green-500">
                <TerminalIcon className="size-5" />
                <span className="text-[10px] font-mono tracking-widest uppercase">CONEXIÓN SEGURA ESTABLECIDA</span>
              </div>
              <h1 className="hacker-font hacker-glow text-3xl sm:text-4xl text-green-400 font-bold leading-tight">
                MISIÓN: {(snapshot.nombre_proyecto || snapshot.cliente || 'SIN NOMBRE').toUpperCase()} - DETALLES CLASIFICADOS
              </h1>
            </div>

            {/* Typewriter terminal section */}
            <div className="flex-1 overflow-y-auto pr-1">
              <TypewriterTerminal
                lines={lines}
                onComplete={() => setAnimationFinished(true)}
              />
            </div>

            {/* Download Button Area */}
            {animationFinished && (
              <div className="mt-4 mb-2 flex justify-center animate-in fade-in duration-700">
                <button
                  onClick={handleDownloadPDF}
                  className="bg-green-500 hover:bg-green-400 text-black font-bold font-mono tracking-widest text-[11px] py-2.5 px-5 rounded border border-green-400 hover:shadow-[0_0_15px_rgba(74,222,128,0.5)] transition-all flex items-center gap-2 cursor-pointer animate-in fade-in duration-500"
                >
                  <Download className="size-3.5" />
                  <span>DOWNLOAD EXECUTIVE REPORT</span>
                </button>
              </div>
            )}

            {/* Footer */}
            <div className="border-t border-green-500/20 pt-4 mt-4 text-center">
              {animationFinished ? (
                <div className="hacker-font hacker-glow text-xl text-green-400 tracking-wider font-bold animate-pulse">
                  FIN DE LA TRANSMISIÓN - INFORMACIÓN CLASIFICADA
                </div>
              ) : (
                <div className="text-[10px] font-mono text-green-600 tracking-widest">
                  DECODIFICANDO INFORMACIÓN...
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
