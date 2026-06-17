import { Suspense } from 'react';
import LoginPage from './page-inner';

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Cargando…</div>}>
      <LoginPage />
    </Suspense>
  );
}
