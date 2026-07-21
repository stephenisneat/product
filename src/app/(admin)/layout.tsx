import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/layout/admin-shell";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";
import { getCurrentUser } from "@/lib/auth/session";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/admin/feedback");
  }

  const allowed = await isPlatformAdmin(user.id);
  if (!allowed) {
    redirect("/");
  }

  return <AdminShell>{children}</AdminShell>;
}
