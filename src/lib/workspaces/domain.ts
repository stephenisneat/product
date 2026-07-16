const CONSUMER_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
  "pm.me",
  "mail.com",
  "gmx.com",
  "gmx.net",
  "yandex.com",
  "yandex.ru",
  "qq.com",
  "163.com",
  "126.com",
  "zoho.com",
  "hey.com",
  "fastmail.com",
  "tutanota.com",
  "tutamail.com",
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

export function parseWorkEmailDomain(input: string): string {
  const domain = normalizeEmailDomain(input);
  if (!domain) {
    throw new Error("Enter a valid email domain (e.g. company.com).");
  }
  if (isConsumerEmailDomain(domain)) {
    throw new Error(
      "Personal email domains cannot be used for domain join. Use a work domain.",
    );
  }
  return domain;
}
