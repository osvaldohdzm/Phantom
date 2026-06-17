import { AppTopbar } from '@/components/app-topbar';
import { PortalBrandingHeader } from '@/components/portal-branding-header';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full flex flex-col bg-background text-foreground">
      <AppTopbar />
      <div className="border-b border-border bg-card/40">
        <PortalBrandingHeader />
      </div>
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
