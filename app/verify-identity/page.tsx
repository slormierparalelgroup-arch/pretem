"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { CameraCaptureField } from "@/components/CameraCaptureField";
import { useLanguage } from "@/components/LanguageProvider";
import { getCurrentUser } from "@/lib/auth";
import { notifyAdmins } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";

type VerificationStatus = "not_submitted" | "pending" | "verified" | "rejected";

type SupabaseLikeError = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
};

export default function VerifyIdentityPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<VerificationStatus>("not_submitted");
  const [idPhoto, setIdPhoto] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [selfieWithId, setSelfieWithId] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadVerificationStatus() {
      const user = await getCurrentUser();
      if (!user) {
        router.push("/login");
        return;
      }

      setUserId(user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("verification_status")
        .eq("id", user.id)
        .maybeSingle();

      const nextStatus = (profile?.verification_status || "not_submitted") as VerificationStatus;
      setStatus(nextStatus);

      if (nextStatus === "verified") {
        router.push("/dashboard");
      }
    }

    loadVerificationStatus();
  }, [router]);

  function statusLabel(nextStatus: VerificationStatus) {
    return t(`verification${nextStatus.charAt(0).toUpperCase()}${nextStatus.slice(1)}`);
  }

  function formatError(error: unknown) {
    if (!error || typeof error !== "object") return t("verificationSubmitError");

    const supabaseError = error as SupabaseLikeError;
    return [supabaseError.message, supabaseError.details, supabaseError.hint, supabaseError.code]
      .filter(Boolean)
      .join(" ");
  }

  async function uploadIdentityFile(file: File, type: string) {
    if (!userId) throw new Error(t("useLoginFirst"));

    const path = `${userId}/identity/${type}-${Date.now()}.jpg`;
    const { error } = await supabase.storage.from("selfies").upload(path, file, {
      contentType: file.type || "image/jpeg",
      upsert: false
    });

    if (error) throw error;
    return path;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || !idPhoto || !selfie || !selfieWithId || loading) return;

    setLoading(true);
    setMessage("");

    try {
      setMessage(t("uploadingIdPhoto"));
      const idPhotoPath = await uploadIdentityFile(idPhoto, "id-photo");
      setMessage(t("uploadingSelfie"));
      const selfiePath = await uploadIdentityFile(selfie, "selfie");
      setMessage(t("uploadingSelfieWithId"));
      const selfieWithIdPath = await uploadIdentityFile(selfieWithId, "selfie-with-id");
      setMessage(t("savingVerification"));

      const { error } = await supabase.rpc("submit_identity_verification", {
        id_photo_path: idPhotoPath,
        selfie_path: selfiePath,
        selfie_with_id_path: selfieWithIdPath
      });

      if (error) throw error;

      await notifyAdmins(t("notificationVerificationSubmittedTitle"), t("notificationVerificationSubmittedBody"), "/admin");

      setStatus("pending");
      setMessage(t("verificationSubmitted"));
    } catch (error) {
      setMessage(formatError(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="page">
      <form className="panel form" onSubmit={submit}>
        <h1>{t("identityVerification")}</h1>
        <p className="muted">{t("verificationIntro")}</p>
        <p className={`status ${status === "not_submitted" ? "pending" : status}`}>{statusLabel(status)}</p>

        {status === "verified" ? (
          <div className="notice">
            {t("verificationVerifiedBody")}{" "}
            <Link href="/request-loan">{t("requestLoan")}</Link>
          </div>
        ) : null}

        {status === "pending" ? <p className="notice">{t("verificationPendingBody")}</p> : null}
        {status === "rejected" ? <p className="notice">{t("verificationRejectedBody")}</p> : null}

        {status !== "pending" && status !== "verified" ? (
          <>
            <CameraCaptureField file={idPhoto} label={t("idPhoto")} name="id-photo" onChange={setIdPhoto} t={t} />
            <CameraCaptureField file={selfie} label={t("selfie")} name="selfie" onChange={setSelfie} t={t} />
            <CameraCaptureField file={selfieWithId} label={t("selfieWithId")} name="selfie-with-id" onChange={setSelfieWithId} t={t} />
          </>
        ) : null}

        {message ? <p className="notice">{message}</p> : null}

        <div className="actions">
          {status !== "pending" && status !== "verified" ? (
            <button disabled={loading || !idPhoto || !selfie || !selfieWithId}>{loading ? t("submitting") : t("submitVerification")}</button>
          ) : null}
          <Link className="button secondary" href="/dashboard">
            {t("myLoans")}
          </Link>
        </div>
      </form>
    </section>
  );
}
