import { describe, expect, it } from "vitest";
import {
  emailDomainFromAddress,
  isConsumerEmailDomain,
  normalizeEmailDomain,
  parseWorkEmailDomain,
  workEmailDomainFromAddress,
} from "./domain";
import { faviconUrlForDomain, isFaviconAvatarUrl, resolveAvatarUrl } from "./favicon";

describe("workspace domain helpers", () => {
  it("normalizes domains and emails", () => {
    expect(normalizeEmailDomain("Acme.COM")).toBe("acme.com");
    expect(normalizeEmailDomain("@acme.com")).toBe("acme.com");
    expect(normalizeEmailDomain("https://acme.com/path")).toBe("acme.com");
    expect(emailDomainFromAddress("ada@acme.com")).toBe("acme.com");
  });

  it("rejects consumer domains for work join", () => {
    for (const domain of [
      "gmail.com",
      "googlemail.com",
      "protonmail.com",
      "proton.me",
      "pm.me",
      "yahoo.com",
      "yahoo.co.uk",
      "outlook.com",
      "hotmail.com",
      "icloud.com",
      "aol.com",
    ]) {
      expect(isConsumerEmailDomain(domain)).toBe(true);
      expect(() => parseWorkEmailDomain(domain)).toThrow(/Personal email/);
    }
    expect(parseWorkEmailDomain("acme.com")).toBe("acme.com");
    expect(isConsumerEmailDomain("acme.com")).toBe(false);
  });

  it("prefills only company domains from email addresses", () => {
    expect(workEmailDomainFromAddress("ada@acme.com")).toBe("acme.com");
    expect(workEmailDomainFromAddress("stephen@protonmail.com")).toBeNull();
    expect(workEmailDomainFromAddress("you@gmail.com")).toBeNull();
  });
});

describe("favicon helpers", () => {
  it("builds and detects favicon urls", () => {
    const url = faviconUrlForDomain("acme.com");
    expect(url).toContain("domain=acme.com");
    expect(isFaviconAvatarUrl(url)).toBe(true);
    expect(isFaviconAvatarUrl("https://cdn.example.com/avatar.png")).toBe(false);
  });

  it("preserves custom avatars when domain changes", () => {
    expect(
      resolveAvatarUrl({
        currentAvatarUrl: "https://cdn.example.com/a.png",
        joinDomain: "acme.com",
      }),
    ).toBe("https://cdn.example.com/a.png");

    expect(
      resolveAvatarUrl({
        currentAvatarUrl: faviconUrlForDomain("old.com"),
        joinDomain: "acme.com",
      }),
    ).toBe(faviconUrlForDomain("acme.com"));
  });
});
