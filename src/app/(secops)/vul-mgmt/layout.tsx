import { VulnMgmtNav } from '@/components/vuln-mgmt-nav';

export default function VulMgmtLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-6 md:p-10 max-w-[min(100%,1440px)] mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Gestión de servicio de vulnerabilidades</h1>
        <p className="text-muted-foreground mt-2 max-w-3xl">
          Repositorio central de hallazgos, matriz CYB001, ingesta de scanners y métricas por servicio.
          Los servicios (antes proyectos) agrupan Pentest, AV Infraestructura, DAST, SAST y AV Cloud.
        </p>
      </div>
      <VulnMgmtNav />
      {children}
    </div>
  );
}
