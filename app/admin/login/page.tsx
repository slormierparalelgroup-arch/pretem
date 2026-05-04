"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { PasswordField } from "@/components/PasswordField";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export default function AdminLoginPage() {
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
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });

    if (error) {
      setLoading(false);
      setMessage(error.message);
      return;
    }

    const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
      .split(",")
      .map((adminEmail) => adminEmail.trim().toLowerCase())
      .filter(Boolean);
    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
    setLoading(false);

    if (profileError) {
      setMessage(profileError.message);
      return;
    }

    const isAdmin = profile?.role === "admin" || adminEmails.includes(data.user.email?.toLowerCase() || "");
    if (!isAdmin) {
      await supabase.auth.signOut();
      setMessage(t("adminAccessDenied"));
      return;
    }

    router.push("/admin");
  }

  return (
    <section className="page">
      <form className="panel form" onSubmit={submit}>
        <h1>{t("adminLogin")}</h1>
        <label>
          {t("email")}
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
        </label>
        <PasswordField value={password} onChange={setPassword} />
        {!isSupabaseConfigured ? <p className="notice">{t("supabaseMissing")}</p> : null}
        {message ? <p className="notice">{message}</p> : null}
        <button disabled={loading}>{loading ? "..." : t("login")}</button>
      </form>
    </section>
  );
}
