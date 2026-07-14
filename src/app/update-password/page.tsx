import { redirect } from "next/navigation";
import { UpdatePasswordForm } from "@/features/auth/update-password-form";
import { getCurrentUser } from "@/lib/auth/session";

export default async function UpdatePasswordPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <UpdatePasswordForm />
    </div>
  );
}
