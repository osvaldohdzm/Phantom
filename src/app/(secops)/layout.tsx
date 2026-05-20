import Link from 'next/link';
import { SecOpsMobileNav, SecOpsSidebarNav } from '@/components/secops-nav';

export default function SecOpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full flex bg-slate-950 text-slate-100">
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-slate-800/80 bg-slate-900/40">
        <div className="p-5 border-b border-slate-800/80">
          <Link href="/" className="block group">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Spectra</span>
            <span className="block text-lg font-semibold tracking-tight bg-gradient-to-r from-violet-300 to-cyan-300 bg-clip-text text-transparent">
              SecOps
            </span>
          </Link>
          <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
            Plataforma unificada de vulnerabilidades, pentest y servicios.
          </p>
        </div>
        <SecOpsSidebarNav />
        <div className="p-4 text-[10px] text-slate-600 border-t border-slate-800/80">
          Stack: Next.js · FastAPI · PostgreSQL · Redis · LangChain
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/80">
          <Link href="/" className="text-sm font-semibold text-slate-200">
            Spectra SecOps
          </Link>
          <SecOpsMobileNav />
        </header>
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
