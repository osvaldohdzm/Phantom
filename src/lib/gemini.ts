import { GoogleGenAI } from '@google/genai';

const COOLDOWN_MS = 15 * 60 * 1000;
const exhaustedUntil = new Map<string, number>();

function readKey(name: string): string {
  const raw = process.env[name]?.trim() ?? '';
  if (!raw || raw === 'MY_GEMINI_API_KEY') return '';
  return raw.replace(/^["']|["']$/g, '');
}

export function getGeminiApiKeys(): string[] {
  const paid = readKey('GEMINI_API_KEY_PAID') || readKey('GEMINI_API_KEY');
  const fallback = readKey('GEMINI_API_KEY_FALLBACK');
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const key of [paid, fallback]) {
    if (!key || seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

function keyLabel(key: string): string {
  if (key.length < 12) return '(key)';
  return `${key.slice(0, 8)}…${key.slice(-4)}`;
}

function isRetryableGeminiError(err: unknown, status?: number): boolean {
  const statusCode =
    status ??
    (typeof err === 'object' && err && 'status' in err
      ? Number((err as { status?: number }).status)
      : undefined);

  if (statusCode === 429 || statusCode === 401 || statusCode === 403) return true;

  const msg = String(
    (typeof err === 'object' && err && 'message' in err
      ? (err as { message?: string }).message
      : err) ?? ''
  );
  return /quota|rate.?limit|resource.?exhausted|too many requests|exceeded|resource_exhausted|insufficient.?quota|billing/i.test(
    msg
  );
}

function markExhausted(key: string) {
  exhaustedUntil.set(key, Date.now() + COOLDOWN_MS);
  console.warn(`[gemini] clave ${keyLabel(key)} agotada o rechazada; se intenta respaldo`);
}

function orderedKeys(): string[] {
  const keys = getGeminiApiKeys();
  const now = Date.now();
  const ready = keys.filter((k) => (exhaustedUntil.get(k) || 0) <= now);
  const cooling = keys.filter((k) => (exhaustedUntil.get(k) || 0) > now);
  return [...ready, ...cooling];
}

async function withGeminiKey<T>(fn: (apiKey: string) => Promise<T>): Promise<T> {
  const keys = orderedKeys();
  if (keys.length === 0) {
    throw new Error('GEMINI_API_KEY no configurada');
  }

  let lastError: unknown;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    try {
      return await fn(key);
    } catch (err) {
      lastError = err;
      const canFailover = i < keys.length - 1 && isRetryableGeminiError(err);
      if (canFailover) {
        markExhausted(key);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

function makeClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

/**
 * Paid key first. generateContent retries with the basic fallback on quota errors.
 */
export function getAiClient(): GoogleGenAI | null {
  const keys = getGeminiApiKeys();
  if (keys.length === 0) return null;

  const primary = makeClient(keys[0]);
  return new Proxy(primary, {
    get(target, prop, receiver) {
      if (prop === 'models') {
        const models = target.models;
        return new Proxy(models, {
          get(modelsTarget, modelsProp, modelsReceiver) {
            if (modelsProp === 'generateContent') {
              return async (...args: unknown[]) =>
                withGeminiKey(async (key) => {
                  const client = makeClient(key);
                  return (client.models.generateContent as (...a: unknown[]) => Promise<unknown>)(
                    ...args
                  );
                });
            }
            const value = Reflect.get(modelsTarget, modelsProp, modelsReceiver);
            return typeof value === 'function' ? value.bind(modelsTarget) : value;
          },
        });
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as GoogleGenAI;
}
