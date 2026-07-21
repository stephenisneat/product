import { Suspense } from "react";
import { MfaChallengeForm } from "@/features/auth/mfa-challenge-form";

export default function MfaChallengePage() {
  return (
    <Suspense
      fallback={
        <p className="mx-auto max-w-sm px-4 py-16 text-sm text-muted-foreground">
          Loading…
        </p>
      }
    >
      <MfaChallengeForm />
    </Suspense>
  );
}
