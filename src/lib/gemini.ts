import { GoogleGenAI } from '@google/genai';

const COOLDOWN_QUOTA_MS = 20 * 60 * 1000;
const COOLDOWN_RATE_MS = 45 * 1000;
const COOLDOWN_INVALID_MS = 30 * 60 * 1000;

type KeyState = { until: number; kind: string };
const exhaustedUntil = new Map<string, KeyState>();

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

function keyRole(key: string): string {
  const paid = readKey('GEMINI_API_KEY_PAID') || readKey('GEMINI_API_KEY');
  const fallback = readKey('GEMINI_API_KEY_FALLBACK');
  if (key === paid) return 'pago';
  if (key === fallback) return 'respaldo';
  return keyLabel(key);
}

function classifyGeminiError(
  err: unknown,
  status?: number
): { kind: 'quota' | 'rate_limit' | 'invalid_key' | 'other'; failover: boolean; cooldownMs: number; reason: string } {
  const statusCode =
    status ??
    (typeof err === 'object' && err && 'status' in err
      ? Number((err as { status?: number }).status)
      : undefined);

  const msg = String(
    (typeof err === 'object' && err && 'message' in err
      ? (err as { message?: string }).message
      : err) ?? ''
  ).toLowerCase();

  if (statusCode === 400 || statusCode === 404) {
    return { kind: 'other', failover: false, cooldownMs: 0, reason: 'solicitud inválida (no es cuota)' };
  }

  const quotaHit =
    /credits?.{0,40}deplet|prepayment|quota|resource.?exhausted|resource_exhausted|insufficient.?quota|billing|exceeded your current quota/.test(
      msg
    );
  if (quotaHit) {
    return {
      kind: 'quota',
      failover: true,
      cooldownMs: COOLDOWN_QUOTA_MS,
      reason: 'créditos/cuota agotados',
    };
  }
  if (statusCode === 429 || /rate.?limit|too many requests/.test(msg)) {
    return {
      kind: 'rate_limit',
      failover: true,
      cooldownMs: COOLDOWN_RATE_MS,
      reason: 'rate limit (reintento en ~45s)',
    };
  }
  if (statusCode === 401 || statusCode === 403 || /api.?key|permission.?denied|unauthor/.test(msg)) {
    return {
      kind: 'invalid_key',
      failover: true,
      cooldownMs: COOLDOWN_INVALID_MS,
      reason: 'clave inválida o sin permiso',
    };
  }
  if (statusCode && statusCode >= 500) {
    return { kind: 'other', failover: true, cooldownMs: 15_000, reason: `error ${statusCode} del API` };
  }
  return { kind: 'other', failover: false, cooldownMs: 0, reason: 'error no recuperable' };
}

function markExhausted(key: string, kind: string, cooldownMs: number) {
  exhaustedUntil.set(key, { until: Date.now() + cooldownMs, kind });
}

function orderedKeys(): string[] {
  const keys = getGeminiApiKeys();
  const now = Date.now();
  const ready = keys.filter((k) => (exhaustedUntil.get(k)?.until || 0) <= now);
  const cooling = keys.filter((k) => (exhaustedUntil.get(k)?.until || 0) > now);
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
      const classified = classifyGeminiError(err);
      const canFailover = i < keys.length - 1 && classified.failover;
      if (canFailover) {
        markExhausted(key, classified.kind, classified.cooldownMs);
        console.warn(
          `[gemini] ${keyRole(key)}: ${classified.reason} → cambio a ${keyRole(keys[i + 1])}`
        );
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
