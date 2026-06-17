import { SecOpsShell } from '@/components/secops-shell';

export default function SecOpsLayout({ children }: { children: React.ReactNode }) {
  return <SecOpsShell>{children}</SecOpsShell>;
}
