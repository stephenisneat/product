import Link from "next/link";
import type { AppUser } from "@/domain";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/layout/user-menu";

export function AppHeader({
  user,
  productTitle,
}: {
  user?: AppUser | null;
  productTitle?: string;
}) {
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
          {user ? (
            <UserMenu user={user} />
          ) : (
            <Button size="sm" variant="outline" render={<Link href="/login" />}>
              Sign in
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
