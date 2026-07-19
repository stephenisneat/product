import { redirect } from "next/navigation";
import { ChangeDisplayNameForm } from "@/features/auth/change-display-name-form";
import { ChangeEmailForm } from "@/features/auth/change-email-form";
import { getCurrentUser } from "@/lib/auth/session";

export default async function ProfileSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ emailUpdated?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/settings/profile");
  }

  const params = await searchParams;
  const emailUpdated = params.emailUpdated === "1";

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-8">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Profile
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your personal account details.
        </p>
      </div>

      {emailUpdated ? (
        <p className="mb-6 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Email updated successfully.
        </p>
      ) : null}

      <div className="space-y-10">
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Display name</h2>
          <ChangeDisplayNameForm currentName={user.name} />
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium">Email address</h2>
          <ChangeEmailForm currentEmail={user.email} />
        </section>
      </div>
    </div>
  );
}
