'use client';

import { useState } from 'react';
import { Building2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { completeInitialSetup, type AuthSession } from '@/lib/auth-api';
import type { TenantLanguage } from '@/lib/tenant-locale';

type InitialSetupWizardProps = {
  onComplete: (session: AuthSession) => void;
};

const LANGUAGE_OPTIONS: { id: TenantLanguage; label: string; hint: string }[] = [
  {
    id: 'en',
    label: 'English',
    hint: 'UI, catalog labels, and reports in English',
  },
  {
    id: 'es',
    label: 'Español',
    hint: 'Interfaz, catálogo e informes en español',
  },
];

export function InitialSetupWizard({ onComplete }: InitialSetupWizardProps) {
  const [organizationName, setOrganizationName] = useState('');
  const [language, setLanguage] = useState<TenantLanguage>('en');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = organizationName.trim();
    if (name.length < 2) {
      setError('Enter an organization name (at least 2 characters).');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const session = await completeInitialSetup({
        organization_name: name,
        operational_language: language,
        ui_language: language,
      });
      onComplete(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup could not be completed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/95 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md space-y-5 rounded-xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <Building2 className="size-6 shrink-0 text-primary mt-0.5" />
          <div className="space-y-1">
            <h1 className="text-lg font-semibold">Welcome — quick setup</h1>
            <p className="text-sm text-muted-foreground leading-snug">
              Name your organization and choose the default language. You can change these later in
              Administration.
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="org-name" className="text-xs text-muted-foreground">
              Organization name
            </label>
            <Input
              id="org-name"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              placeholder="Acme Security"
              autoFocus
              required
              minLength={2}
              maxLength={255}
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-xs text-muted-foreground">Default language</legend>
            <div className="grid gap-2">
              {LANGUAGE_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                    language === opt.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="language"
                    value={opt.id}
                    checked={language === opt.id}
                    onChange={() => setLanguage(opt.id)}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium">{opt.label}</span>
                    <span className="block text-[11px] text-muted-foreground">{opt.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {error ? (
            <p className="text-xs text-rose-600 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin mr-1.5" />
                Saving…
              </>
            ) : (
              'Continue to workspace'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
