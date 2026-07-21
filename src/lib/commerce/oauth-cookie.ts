export function cookieSecure() {
  return (
    process.env.COOKIE_SECURE === "true" ||
    process.env.VERCEL === "1" ||
    process.env.NODE_ENV === "production"
  );
}
