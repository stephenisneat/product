/**
 * Common personal / free mailbox providers that must not be used for
 * workspace domain join.
 */
const CONSUMER_EMAIL_DOMAINS = new Set([
  // Google
  "gmail.com",
  "googlemail.com",
  // Microsoft
  "hotmail.com",
  "hotmail.co.uk",
  "hotmail.fr",
  "hotmail.de",
  "hotmail.es",
  "hotmail.it",
  "outlook.com",
  "outlook.co.uk",
  "outlook.fr",
  "outlook.de",
  "live.com",
  "live.co.uk",
  "msn.com",
  "passport.com",
  // Yahoo
  "yahoo.com",
  "yahoo.co.uk",
  "yahoo.co.jp",
  "yahoo.fr",
  "yahoo.de",
  "yahoo.es",
  "yahoo.it",
  "yahoo.ca",
  "yahoo.com.au",
  "yahoo.com.br",
  "ymail.com",
  "rocketmail.com",
  // Apple
  "icloud.com",
  "me.com",
  "mac.com",
  // Proton
  "protonmail.com",
  "proton.me",
  "pm.me",
  "protonmail.ch",
  // AOL / Verizon
  "aol.com",
  "aol.co.uk",
  "aim.com",
  "verizon.net",
  // Other free / personal
  "mail.com",
  "email.com",
  "usa.com",
  "gmx.com",
  "gmx.net",
  "gmx.de",
  "gmx.fr",
  "gmx.at",
  "gmx.ch",
  "yandex.com",
  "yandex.ru",
  "ya.ru",
  "qq.com",
  "163.com",
  "126.com",
  "sina.com",
  "zoho.com",
  "zohomail.com",
  "hey.com",
  "fastmail.com",
  "fastmail.fm",
  "tutanota.com",
  "tutanota.de",
  "tutamail.com",
  "tuta.io",
  "mailfence.com",
  "hushmail.com",
  "inbox.com",
  "lycos.com",
  "rediffmail.com",
  "mail.ru",
  "bk.ru",
  "list.ru",
  "inbox.ru",
  "web.de",
  "t-online.de",
  "freenet.de",
  "orange.fr",
  "wanadoo.fr",
  "laposte.net",
  "free.fr",
  "sfr.fr",
  "libero.it",
  "virgilio.it",
  "naver.com",
  "daum.net",
  "hanmail.net",
]);

/** Normalize a domain or email-ish string to a bare lowercase host. */
export function normalizeEmailDomain(input: string): string | null {
  let value = input.trim().toLowerCase();
  if (!value) return null;

  if (value.includes("@")) {
    value = value.split("@").pop() ?? "";
  }

  value = value.replace(/^https?:\/\//, "");
  value = value.split("/")[0] ?? "";
  value = value.split("?")[0] ?? "";
  value = value.replace(/:\d+$/, "");
  value = value.replace(/^\.+|\.+$/g, "");

  if (!value || !value.includes(".")) return null;
  if (value.length > 253) return null;
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(value)) {
    return null;
  }

  return value;
}

export function emailDomainFromAddress(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  return normalizeEmailDomain(email.slice(at + 1));
}

export function isConsumerEmailDomain(domain: string): boolean {
  return CONSUMER_EMAIL_DOMAINS.has(domain.toLowerCase());
}

/** Email domain suitable for workspace join prefill; null for personal providers. */
export function workEmailDomainFromAddress(email: string): string | null {
  const domain = emailDomainFromAddress(email);
  if (!domain || isConsumerEmailDomain(domain)) return null;
  return domain;
}

export function parseWorkEmailDomain(input: string): string {
  const domain = normalizeEmailDomain(input);
  if (!domain) {
    throw new Error("Enter a valid work email domain (e.g. company.com).");
  }
  if (isConsumerEmailDomain(domain)) {
    throw new Error(
      "Personal email domains (Gmail, Proton Mail, Yahoo, Outlook, etc.) cannot be used for domain join. Use a company domain.",
    );
  }
  return domain;
}
