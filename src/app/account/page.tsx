import Link from "next/link";
import { redirect } from "next/navigation";
import { UserMenu } from "@/components/layout/user-menu";
import { ChangeEmailForm } from "@/features/auth/change-email-form";
import { getCurrentUser } from "@/lib/auth/session";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ emailUpdated?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const emailUpdated = params.emailUpdated === "1";

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-lg items-center justify-end px-4 pt-4">
        <UserMenu user={user} />
      </div>
      <main className="mx-auto max-w-lg px-4 py-6">
        <div className="mb-8">
          <p className="text-xs text-muted-foreground">
            <Link href="/" className="underline-offset-4 hover:underline">
              ← Back to catalog
            </Link>
          </p>
          <h1 className="mt-3 font-heading text-2xl font-semibold tracking-tight">Account</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your sign-in email for {user.name}.
          </p>
        </div>

        {emailUpdated ? (
          <p className="mb-6 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            Email updated successfully.
          </p>
        ) : null}

        <section className="space-y-3">
          <h2 className="text-sm font-medium">Email address</h2>
          <ChangeEmailForm currentEmail={user.email} />
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-sm font-medium">Workspace</h2>
          <p className="text-sm text-muted-foreground">
            Invite teammates and manage roles for your active workspace.
          </p>
          <p>
            <Link
              href="/settings/workspace"
              className="text-sm font-medium underline-offset-4 hover:underline"
            >
              Open workspace settings →
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}
