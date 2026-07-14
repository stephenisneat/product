import Link from "next/link";
import type { AppUser } from "@/domain";
import { isDemoMode } from "@/lib/mode";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/features/auth/sign-out-button";

export function AppHeader({
  user,
  productTitle,
}: {
  user?: AppUser | null;
  productTitle?: string;
}) {
  const demo = isDemoMode() || user?.isDemo;

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-[1600px] items-center gap-3 px-4">
        <Link
          href="/"
          className="font-heading text-sm font-semibold tracking-tight text-foreground"
        >
          Product Agent
        </Link>
        {productTitle ? (
          <>
            <span className="text-muted-foreground">/</span>
            <span className="truncate text-sm text-muted-foreground">{productTitle}</span>
          </>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          {demo ? (
            <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wide">
              Demo
            </Badge>
          ) : null}
          {user ? (
            <>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {user.email}
              </span>
              <SignOutButton />
            </>
          ) : (
            <Button size="sm" variant="outline" render={<Link href="/login" />}>
              Sign in
            </Button>
          )}
        </div>
      </div>
      {demo ? (
        <div className="border-t border-border/60 bg-muted/40 px-4 py-1.5 text-center text-[11px] text-muted-foreground">
          Demo mode — configure Supabase & OpenAI for production. Running without live
          credentials.
        </div>
      ) : null}
    </header>
  );
}
