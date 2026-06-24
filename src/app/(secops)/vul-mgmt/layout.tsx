import { VulnMgmtShell } from '@/components/vuln-mgmt-shell';

export default function VulMgmtLayout({ children }: { children: React.ReactNode }) {
  return <VulnMgmtShell>{children}</VulnMgmtShell>;
}
