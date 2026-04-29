"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { supabase } from "@/lib/supabase";

export default function AdminLoginPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      setMessage(error.message);
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
        <label>
          {t("password")}
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
        </label>
        {message ? <p className="notice">{message}</p> : null}
        <button disabled={loading}>{loading ? "..." : t("login")}</button>
      </form>
    </section>
  );
}
