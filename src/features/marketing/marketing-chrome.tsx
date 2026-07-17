import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function MarketingChrome({ children }: { children: ReactNode }) {
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
        <Link
          href="/"
          className="font-heading text-sm font-semibold tracking-tight"
        >
          Product Agent
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" render={<Link href="/pricing" />}>
            Pricing
          </Button>
          <Button variant="ghost" size="sm" render={<Link href="/login" />}>
            Sign in
          </Button>
          <Button size="sm" render={<Link href="/signup" />}>
            Sign up
          </Button>
        </div>
      </header>

      {children}
    </div>
  );
}
