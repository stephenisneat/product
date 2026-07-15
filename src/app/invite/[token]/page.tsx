import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getWorkspaceRepository } from "@/repositories";
import { AcceptInviteClient } from "@/features/workspaces/accept-invite-client";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await getCurrentUser();
  const repo = await getWorkspaceRepository();
  const invite = await repo.getInviteByToken(token);

  if (!invite) {
    return (
      <InviteShell>
        <h1 className="font-heading text-xl font-semibold tracking-tight">
          Invite not found
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This invite link is invalid or has already been used.
        </p>
        <p className="mt-6">
          <Link href="/" className="text-sm underline-offset-4 hover:underline">
            Go home
          </Link>
        </p>
      </InviteShell>
    );
  }

  if (invite.acceptedAt) {
    redirect("/");
  }

  const expired = invite.expiresAt < new Date().toISOString();

  if (expired) {
    return (
      <InviteShell>
        <h1 className="font-heading text-xl font-semibold tracking-tight">
          Invite expired
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ask an admin of {invite.workspaceName} to send a new invite.
        </p>
      </InviteShell>
    );
  }

  if (!user) {
    const next = `/invite/${token}`;
    return (
      <InviteShell>
        <h1 className="font-heading text-xl font-semibold tracking-tight">
          Join {invite.workspaceName}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in as <span className="font-medium text-foreground">{invite.email}</span>{" "}
          to accept this invite as {invite.role}.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/login?next=${encodeURIComponent(next)}`}
            className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
          >
            Sign in
          </Link>
          <Link
            href={`/signup?next=${encodeURIComponent(next)}`}
            className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-sm font-medium"
          >
            Create account
          </Link>
        </div>
      </InviteShell>
    );
  }

  return (
    <InviteShell>
      <AcceptInviteClient
        token={token}
        workspaceName={invite.workspaceName}
        inviteEmail={invite.email}
        role={invite.role}
        userEmail={user.email}
      />
    </InviteShell>
  );
}

function InviteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-md px-4 py-24">{children}</main>
    </div>
  );
}
