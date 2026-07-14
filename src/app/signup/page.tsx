import { SignupForm } from "@/features/auth/signup-form";
import { isDemoMode } from "@/lib/mode";

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-background">
      <SignupForm demoMode={isDemoMode()} />
    </div>
  );
}
