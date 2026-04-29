"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
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
      setMessage("Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart the dev server.");
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

    router.push("/request-loan");
  }

  return (
    <section className="page">
      <form className="panel form" onSubmit={submit}>
        <h1>{t("createAccount")}</h1>
        <label>
          {t("email")}
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
        </label>
        <label>
          {t("password")}
          <input
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            required
          />
        </label>
        {!isSupabaseConfigured ? (
          <p className="notice">
            Supabase is not configured yet. Create <strong>.env.local</strong> with your project URL and anon key,
            then restart localhost.
          </p>
        ) : null}
        {message ? <p className="notice">{message}</p> : null}
        <button disabled={loading}>{loading ? "..." : t("createAccount")}</button>
        <p className="muted">
          <Link href="/login">{t("login")}</Link>
        </p>
      </form>
    </section>
  );
}
