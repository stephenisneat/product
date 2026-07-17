import { redirect } from "next/navigation";

export default async function AccountRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ emailUpdated?: string }>;
}) {
  const params = await searchParams;
  const suffix = params.emailUpdated === "1" ? "?emailUpdated=1" : "";
  redirect(`/settings/account${suffix}`);
}
