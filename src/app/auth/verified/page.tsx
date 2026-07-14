import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";

export default async function AuthVerifiedPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-sm px-4 py-16">
        <h1 className="font-heading text-xl font-semibold tracking-tight">Email verified</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You are signed in as{" "}
          <span className="font-medium text-foreground">{user.email}</span>. Your workspace is
          ready.
        </p>
        <Button className="mt-8 w-full" render={<Link href="/" />}>
          Continue to workspace
        </Button>
      </div>
    </div>
  );
}
