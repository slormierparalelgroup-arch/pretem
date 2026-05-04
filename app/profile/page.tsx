"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { getCurrentUser } from "@/lib/auth";
import { getCountryCode, normalizePhoneForCountry } from "@/lib/phone";
import { supabase } from "@/lib/supabase";

type VerificationStatus = "not_submitted" | "pending" | "verified" | "rejected";

type Profile = {
  email: string | null;
  full_name: string | null;
  country: string | null;
  phone: string | null;
  credit_score: number | null;
  verification_status: VerificationStatus;
  created_at: string | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState("haiti");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const canSave = Boolean(fullName.trim() && country.trim() && phone.trim());

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function loadProfile() {
    setLoading(true);
    setMessage("");

    const user = await getCurrentUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("email, full_name, country, phone, credit_score, verification_status, created_at")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    const nextProfile = {
      email: data?.email || user.email || null,
      full_name: data?.full_name || "",
      country: data?.country || "haiti",
      phone: data?.phone || "",
      credit_score: data?.credit_score ?? 500,
      verification_status: (data?.verification_status || "not_submitted") as VerificationStatus,
      created_at: data?.created_at || null
    };

    setProfile(nextProfile);
    setFullName(nextProfile.full_name || "");
    setCountry(nextProfile.country || "haiti");
    setPhone(nextProfile.phone || "");
    setLoading(false);
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) {
      setMessage(t("profileRequiredFields"));
      return;
    }

    setSaving(true);
    setMessage("");
    const normalizedPhone = normalizePhoneForCountry(country, phone);
    const { error } = await supabase.rpc("save_profile_info", {
      profile_full_name: fullName.trim(),
      profile_country: country,
      profile_phone: normalizedPhone
    });
    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(t("profileSaved"));
    await loadProfile();
  }

  function countryLabel(value?: string | null) {
    if (value === "usa") return t("countryUsa");
    if (value === "mexico") return t("countryMexico");
    return t("countryHaiti");
  }

  function verificationLabel(nextStatus?: VerificationStatus) {
    if (!nextStatus) return t("verificationNotSubmitted");
    return t(`verification${nextStatus.charAt(0).toUpperCase()}${nextStatus.slice(1)}`);
  }

  return (
    <section className="page">
      <div className="toolbar">
        <div>
          <h1>{t("profile")}</h1>
          <p className="muted">{t("profileBody")}</p>
        </div>
        <div className="actions">
          <Link className="button secondary" href="/dashboard">
            {t("dashboard")}
          </Link>
          <Link className="button" href="/request-loan">
            {t("requestLoan")}
          </Link>
        </div>
      </div>

      {loading ? <p className="notice">{t("loadingProfile")}</p> : null}
      {message ? <p className="notice">{message}</p> : null}

      {!loading && profile ? (
        <div className="grid two">
          <form className="panel form" onSubmit={saveProfile}>
            <h2>{t("personalInformation")}</h2>
            <label>
              {t("fullName")}
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} required />
            </label>
            <label>
              {t("signupCountry")}
              <select value={country} onChange={(event) => setCountry(event.target.value)} required>
                <option value="haiti">{t("countryHaiti")} ({getCountryCode("haiti")})</option>
                <option value="usa">{t("countryUsa")} ({getCountryCode("usa")})</option>
                <option value="mexico">{t("countryMexico")} ({getCountryCode("mexico")})</option>
              </select>
            </label>
            <label>
              {t("phoneNumber")} ({getCountryCode(country)})
              <input value={phone} onChange={(event) => setPhone(event.target.value)} required />
            </label>
            {!canSave ? <p className="muted">{t("profileRequiredFields")}</p> : null}
            <button disabled={saving || !canSave}>{saving ? t("saving") : t("saveChanges")}</button>
          </form>

          <div className="panel profile-summary">
            <h2>{t("accountInformation")}</h2>
            <dl>
              <div>
                <dt>{t("email")}</dt>
                <dd>{profile.email || t("notProvided")}</dd>
              </div>
              <div>
                <dt>{t("signupCountry")}</dt>
                <dd>{countryLabel(profile.country)}</dd>
              </div>
              <div>
                <dt>{t("verificationStatus")}</dt>
                <dd>
                  <span className={`status ${profile.verification_status}`}>{verificationLabel(profile.verification_status)}</span>
                </dd>
              </div>
              <div>
                <dt>{t("creditScore")}</dt>
                <dd>{profile.credit_score ?? 500}</dd>
              </div>
              <div>
                <dt>{t("accountCreated")}</dt>
                <dd>{profile.created_at ? new Date(profile.created_at).toLocaleDateString() : t("notProvided")}</dd>
              </div>
            </dl>
            <p className="muted">{t("profileSecurityNote")}</p>
            <Link className="button secondary compact" href="/verify-identity">
              {t("verifyIdentity")}
            </Link>
          </div>
        </div>
      ) : null}
    </section>
  );
}
