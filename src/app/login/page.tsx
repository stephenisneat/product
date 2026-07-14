import { LoginForm } from "@/features/auth/login-form";
import { isDemoMode } from "@/lib/mode";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background">
      <LoginForm demoMode={isDemoMode()} />
    </div>
  );
}
