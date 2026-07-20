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
