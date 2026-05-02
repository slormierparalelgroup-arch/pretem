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
  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState("haiti");
  const [phone, setPhone] = useState("");
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
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          country,
          phone: phone.trim()
        }
      }
    });

    if (!error && data.user) {
      await supabase.rpc("save_profile_info", {
        profile_full_name: fullName.trim(),
        profile_country: country,
        profile_phone: phone.trim()
      });
    }

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
        <p className="auth-tagline">{t("loginTagline")}</p>
        <label>
          {t("fullName")}
          <input value={fullName} onChange={(event) => setFullName(event.target.value)} required />
        </label>
        <label>
          {t("signupCountry")}
          <select value={country} onChange={(event) => setCountry(event.target.value)}>
            <option value="haiti">{t("countryHaiti")}</option>
            <option value="usa">{t("countryUsa")}</option>
            <option value="mexico">{t("countryMexico")}</option>
          </select>
        </label>
        <label>
          {t("phoneNumber")}
          <input value={phone} onChange={(event) => setPhone(event.target.value)} required />
        </label>
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
