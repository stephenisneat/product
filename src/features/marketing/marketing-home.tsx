import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingChrome } from "@/features/marketing/marketing-chrome";

export function MarketingHome() {
  return (
    <MarketingChrome>
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
          <Button size="lg" className="gap-2" render={<Link href="/signup" />}>
            Get started
            <ArrowRight className="size-4" />
          </Button>
          <Button size="lg" variant="outline" render={<Link href="/pricing" />}>
            View pricing
          </Button>
        </div>
      </main>
    </MarketingChrome>
  );
}
