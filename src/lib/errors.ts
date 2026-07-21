/**
 * Extract a human-readable message from unknown thrown values.
 * Supabase Postgrest errors are plain objects (`{ message, code, details }`),
 * not `Error` instances — so `err instanceof Error` misses them.
 */
export function unknownErrorMessage(
  err: unknown,
  fallback = "Unexpected error.",
): string {
  if (err instanceof Error && err.message.trim()) return err.message;
  if (typeof err === "string" && err.trim()) return err;

  if (err && typeof err === "object") {
    const record = err as Record<string, unknown>;
    if (typeof record.message === "string" && record.message.trim()) {
      const code =
        typeof record.code === "string" || typeof record.code === "number"
          ? String(record.code)
          : null;
      return code ? `${record.message} (${code})` : record.message;
    }
  }

  return fallback;
}

/**
 * Collapse HTML / Next.js error-page bodies into a short user-facing message.
 * Chat transports often surface a 500 HTML document as `error.message`.
 */
export function userFacingErrorMessage(
  err: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  const raw = unknownErrorMessage(err, fallback).trim();
  if (!raw) return fallback;

  const looksLikeHtml =
    raw.startsWith("<!DOCTYPE") ||
    raw.startsWith("<html") ||
    raw.includes("__next_error__") ||
    raw.includes("<title>500");

  if (looksLikeHtml) {
    if (/500|couldn.?t load|server error/i.test(raw)) {
      return "A server error occurred. Please try again.";
    }
    return fallback;
  }

  // Cap runaway blobs (e.g. large JSON/HTML fragments without a doctype).
  if (raw.length > 280) return fallback;
  return raw;
}

/** Log a structured error for Vercel / server logs. */
export function logServerError(
  context: string,
  err: unknown,
  extra?: Record<string, unknown>,
): void {
  const message = unknownErrorMessage(err);
  const payload: Record<string, unknown> = {
    context,
    message,
    ...extra,
  };

  if (err instanceof Error) {
    payload.name = err.name;
    payload.stack = err.stack;
    if (err.cause !== undefined) payload.cause = err.cause;
  } else if (err && typeof err === "object") {
    payload.error = err;
  } else {
    payload.error = err;
  }

  console.error(JSON.stringify(payload));
}
