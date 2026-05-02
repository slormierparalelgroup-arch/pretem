"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { useLanguage } from "@/components/LanguageProvider";
import { PasswordField } from "@/components/PasswordField";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export default function SignupPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isSupabaseConfigured) {
      setMessage(t("supabaseMissing"));
      return;
    }

    setLoading(true);
    setMessage("");
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    router.push("/");
  }

  return (
    <AuthShell>
      <form className="form auth-form" onSubmit={submit}>
        <h1>{t("createAccount")}</h1>
        <label>
          {t("email")}
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
        </label>
        <PasswordField minLength={6} value={password} onChange={setPassword} />
        {!isSupabaseConfigured ? (
          <p className="notice">
            {t("supabaseMissing")}
          </p>
        ) : null}
        {message ? <p className="notice">{message}</p> : null}
        <button disabled={loading}>{loading ? "..." : t("createAccount")}</button>
        <p className="muted">
          <Link href="/login">{t("login")}</Link>
        </p>
      </form>
    </AuthShell>
  );
}
