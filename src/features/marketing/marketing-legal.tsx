import type { ReactNode } from "react";
import { MarketingChrome } from "@/features/marketing/marketing-chrome";

export function MarketingLegalPage({
  eyebrow,
  title,
  effectiveDate,
  children,
}: {
  eyebrow: string;
  title: string;
  effectiveDate: string;
  children: ReactNode;
}) {
  return (
    <MarketingChrome>
      <main className="relative z-10 mx-auto w-full max-w-3xl flex-1 px-6 pb-24 pt-10">
        <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          {eyebrow}
        </p>
        <h1 className="font-heading text-4xl font-semibold tracking-tight text-foreground sm:text-5xl md:leading-[1.08]">
          {title}
        </h1>
        <p className="mt-5 text-sm text-muted-foreground">
          Effective {effectiveDate}
        </p>
        <article className="mt-12 space-y-10 text-sm leading-relaxed text-muted-foreground">
          {children}
        </article>
      </main>
    </MarketingChrome>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}
