/** Reglas de contraseña (espejo de backend/app/services/password_policy.py). */

const MIN_LENGTH = 12;
const SPECIAL_RE = /[^A-Za-z0-9]/;
const UPPER_RE = /[A-Z]/;
const LOWER_RE = /[a-z]/;
const DIGIT_RE = /[0-9]/;

const COMMON_WEAK = new Set([
  'phantom',
  'password',
  'password123',
  '12345678',
  '123456789',
  'admin',
  'administrator',
  'changeme',
  'qwerty',
  'letmein',
]);

export type PasswordRule = {
  id: string;
  label: string;
  test: (password: string, login?: string) => boolean;
};

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: 'length',
    label: `Mínimo ${MIN_LENGTH} caracteres`,
    test: (p) => p.length >= MIN_LENGTH,
  },
  {
    id: 'upper',
    label: 'Una letra mayúscula',
    test: (p) => UPPER_RE.test(p),
  },
  {
    id: 'lower',
    label: 'Una letra minúscula',
    test: (p) => LOWER_RE.test(p),
  },
  {
    id: 'digit',
    label: 'Un número',
    test: (p) => DIGIT_RE.test(p),
  },
  {
    id: 'special',
    label: 'Un carácter especial (!@#$%…)',
    test: (p) => SPECIAL_RE.test(p),
  },
  {
    id: 'not_default',
    label: 'Distinta de «phantom» y contraseñas obvias',
    test: (p) => !COMMON_WEAK.has(p.trim().toLowerCase()),
  },
  {
    id: 'not_login',
    label: 'Distinta del nombre de usuario',
    test: (p, login) => {
      const l = (login ?? '').trim().toLowerCase();
      if (!l) return true;
      return p.trim().toLowerCase() !== l;
    },
  },
];

export function passwordMeetsPolicy(password: string, login?: string): boolean {
  return PASSWORD_RULES.every((r) => r.test(password, login));
}

export function passwordPolicyErrors(password: string, login?: string): string[] {
  return PASSWORD_RULES.filter((r) => !r.test(password, login)).map((r) => r.label);
}
