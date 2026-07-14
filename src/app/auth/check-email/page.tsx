import { CheckEmailPanel } from "@/features/auth/check-email-panel";

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email : null;

  return (
    <div className="min-h-screen bg-background">
      <CheckEmailPanel email={email} />
    </div>
  );
}
