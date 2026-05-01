// Rate limiter in-memory por instância (fixed window).
// Limitação: cada instância da função tem seu próprio Map; sob alta concorrência
// um atacante pode acumular ~Nx o limite (N = instâncias paralelas). Para um
// portfólio é aceitável; se o tráfego escalar, trocar por Upstash/Blobs.

type Window = { count: number; resetAt: number };

const store = new Map<string, Window>();

function maybeCleanup(now: number) {
  // Probabilístico: 1% das chamadas faz uma limpeza para evitar crescimento ilimitado.
  if (Math.random() >= 0.01) return;
  for (const [k, v] of store) {
    if (v.resetAt <= now) store.delete(k);
  }
}

export interface RateLimitResult {
  ok: boolean;
  retryAfter: number; // segundos
}

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  maybeCleanup(now);

  const entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }

  if (entry.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count++;
  return { ok: true, retryAfter: 0 };
}

// Aplica múltiplas janelas; falha na mais restritiva primeiro.
export function checkRateLimits(
  prefix: string,
  ip: string,
  windows: Array<{ limit: number; windowMs: number; label: string }>
): RateLimitResult {
  for (const w of windows) {
    const result = checkRateLimit(`${prefix}:${w.label}:${ip}`, w.limit, w.windowMs);
    if (!result.ok) return result;
  }
  return { ok: true, retryAfter: 0 };
}
