import { Suspense } from 'react';
import LoginClientPage from '@/app/login-client/page-inner';

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Cargando portal…</div>}>
      <LoginClientPage />
    </Suspense>
  );
}
