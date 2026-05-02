import { AuthShell } from "@/components/AuthShell";
import { LoginForm } from "@/components/LoginForm";

export default function Home() {
  return (
    <AuthShell>
      <LoginForm />
    </AuthShell>
  );
}
