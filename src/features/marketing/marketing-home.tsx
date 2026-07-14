import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MarketingHome() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.28_0_0),transparent_55%),linear-gradient(to_bottom,oklch(0.16_0_0),oklch(0.12_0_0))]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:linear-gradient(oklch(1_0_0_/0.06)_1px,transparent_1px),linear-gradient(90deg,oklch(1_0_0_/0.06)_1px,transparent_1px)] [background-size:48px_48px]"
      />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <span className="font-heading text-sm font-semibold tracking-tight">
          Product Agent
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" render={<Link href="/login" />}>
            Sign in
          </Button>
          <Button size="sm" render={<Link href="/api/auth/demo" />}>
            Enter demo
          </Button>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 pb-24 pt-10">
        <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          product.ag
        </p>
        <h1 className="font-heading max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl md:text-[3.25rem] md:leading-[1.08]">
          Product Agent
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
          Import your products. Product Agent creates, manages, and improves their
          marketing everywhere.
        </p>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground/90">
          An AI marketing workspace for commerce teams — product intelligence, campaigns,
          and structured agent proposals in one workbench.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Button size="lg" className="gap-2" render={<Link href="/api/auth/demo" />}>
            Enter demo
            <ArrowRight className="size-4" />
          </Button>
          <Button size="lg" variant="outline" render={<Link href="/login" />}>
            Sign in
          </Button>
        </div>
      </main>
    </div>
  );
}
