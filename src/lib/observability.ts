type LogLevel = "info" | "warn" | "error";

type LogPayload = {
  scope: string;
  message: string;
  meta?: Record<string, unknown>;
};

const SENSITIVE_KEYS = new Set([
  "authorization",
  "token",
  "access_token",
  "refresh_token",
  "password",
  "senha",
  "cvv",
  "card_number",
  "number",
]);

const ERROR_ALERT_WINDOW_MS = 60_000;
const ERROR_ALERT_THRESHOLD = 5;
const PERSIST_WARN_COOLDOWN_MS = 60_000;
const EXTERNAL_ALERT_COOLDOWN_MS = 300_000;

const errorBurstState = new Map<string, { timestamps: number[]; lastAlertAt: number }>();
const externalAlertLastAt = new Map<string, number>();
let persistWarningLastAt = 0;

function scrubValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubValue);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase())) {
        out[k] = "[REDACTED]";
        continue;
      }
      out[k] = scrubValue(v);
    }
    return out;
  }
  return value;
}

function safeMeta(meta?: Record<string, unknown>) {
  if (!meta) return undefined;
  try {
    return scrubValue(JSON.parse(JSON.stringify(meta)));
  } catch {
    return { meta_unserializable: true };
  }
}

function emit(level: LogLevel, payload: LogPayload) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    scope: payload.scope,
    message: payload.message,
    meta: safeMeta(payload.meta),
  };

  if (level === "error") {
    maybeEmitErrorBurstAlert(payload.scope);
  }

  if (level === "error") {
    void persistObservabilityEvent({
      scope: payload.scope,
      level: "error",
      message: payload.message,
      meta: entry.meta,
      event_kind: "log",
    });
    console.error("[obs]", entry);
    return;
  }

  if (level === "warn") {
    console.warn("[obs]", entry);
    return;
  }

  console.info("[obs]", entry);
}

function maybeEmitErrorBurstAlert(scope: string) {
  const now = Date.now();
  const state = errorBurstState.get(scope) ?? { timestamps: [], lastAlertAt: 0 };

  const recent = state.timestamps.filter((t) => now - t <= ERROR_ALERT_WINDOW_MS);
  recent.push(now);
  state.timestamps = recent;

  if (recent.length >= ERROR_ALERT_THRESHOLD && now - state.lastAlertAt > ERROR_ALERT_WINDOW_MS) {
    state.lastAlertAt = now;
    const alertMeta = {
      errors_in_window: recent.length,
      window_ms: ERROR_ALERT_WINDOW_MS,
    };

    void persistObservabilityEvent({
      scope,
      level: "warn",
      message: "Pico de erros detectado por scope",
      meta: alertMeta,
      event_kind: "alert",
    });

    void dispatchExternalAlert({
      scope,
      message: "Pico de erros detectado por scope",
      meta: alertMeta,
    });

    console.warn("[obs][alert]", {
      ts: new Date().toISOString(),
      level: "warn",
      scope,
      message: "Pico de erros detectado por scope",
      meta: alertMeta,
    });
  }

  errorBurstState.set(scope, state);
}

async function dispatchExternalAlert(payload: {
  scope: string;
  message: string;
  meta?: unknown;
}) {
  if (typeof window === "undefined") return;

  const now = Date.now();
  const key = payload.scope;
  const last = externalAlertLastAt.get(key) ?? 0;
  if (now - last < EXTERNAL_ALERT_COOLDOWN_MS) return;

  externalAlertLastAt.set(key, now);

  try {
    await fetch("/api/observability/alert", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Não deve quebrar fluxo principal de logs.
  }
}

export function logInfo(scope: string, message: string, meta?: Record<string, unknown>) {
  emit("info", { scope, message, meta });
}

export function logWarn(scope: string, message: string, meta?: Record<string, unknown>) {
  emit("warn", { scope, message, meta });
}

export function logError(scope: string, message: string, error?: unknown, meta?: Record<string, unknown>) {
  const errMsg = error instanceof Error ? error.message : typeof error === "string" ? error : undefined;
  emit("error", {
    scope,
    message,
    meta: {
      ...meta,
      error: errMsg ?? "unknown_error",
    },
  });
}

type PersistEventPayload = {
  scope: string;
  level: "warn" | "error";
  message: string;
  meta?: unknown;
  event_kind: "log" | "alert";
};

async function persistObservabilityEvent(payload: PersistEventPayload) {
  try {
    const { supabase } = await import("@/lib/supabase/client");
    const { error } = await supabase.from("observability_events").insert({
      scope: payload.scope,
      level: payload.level,
      message: payload.message,
      event_kind: payload.event_kind,
      meta: payload.meta,
    });

    if (error) {
      const now = Date.now();
      if (now - persistWarningLastAt > PERSIST_WARN_COOLDOWN_MS) {
        persistWarningLastAt = now;
        console.warn("[obs][persist]", {
          ts: new Date().toISOString(),
          level: "warn",
          message: "Falha ao persistir evento de observabilidade",
          meta: { error: error.message },
        });
      }
    }
  } catch {
    // Não deve quebrar fluxo principal de logs.
  }
}
