import { redirect } from "next/navigation";
import { AppearancePanel } from "@/features/settings/appearance-panel";
import { getCurrentUser } from "@/lib/auth/session";

export default async function AppearanceSettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/settings/appearance");
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-8">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Appearance
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose how Product looks on this device.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Theme</h2>
        <AppearancePanel />
      </section>
    </div>
  );
}
