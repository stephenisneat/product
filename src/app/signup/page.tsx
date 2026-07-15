import { Suspense } from "react";
import { SignupForm } from "@/features/auth/signup-form";

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-background">
      <Suspense
        fallback={
          <div className="mx-auto w-full max-w-sm px-4 py-16 text-sm text-muted-foreground">
            Loading…
          </div>
        }
      >
        <SignupForm />
      </Suspense>
    </div>
  );
}
