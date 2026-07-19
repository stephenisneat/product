const STORAGE_KEY = "settings-return-to";

export function isSafeSettingsReturnPath(path: string): boolean {
  return (
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !path.startsWith("/settings")
  );
}

export function rememberSettingsReturnPath(path: string) {
  if (typeof window === "undefined") return;
  if (!isSafeSettingsReturnPath(path)) return;
  sessionStorage.setItem(STORAGE_KEY, path);
}

export function getSettingsReturnPath(fallback = "/"): string {
  if (typeof window === "undefined") return fallback;
  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (stored && isSafeSettingsReturnPath(stored)) return stored;
  return fallback;
}
