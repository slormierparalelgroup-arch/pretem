"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { downloadLoanAgreement } from "@/lib/agreement";
import { formatMoney, Loan, LoanStatus } from "@/lib/loans";
import { formatPayoutDetails, getDestinationLabel, getPayoutMethodLabel } from "@/lib/payout";
import { supabase } from "@/lib/supabase";

type AdminSection = "verification" | "loanRequests" | "loanManagement";

type VerificationStatus = "not_submitted" | "pending" | "verified" | "rejected";

type SignedVerification = {
  signed_id_photo_url?: string | null;
  signed_selfie_url?: string | null;
  signed_selfie_with_id_url?: string | null;
};

type AdminLoan = Loan &
  SignedVerification & {
    verification_status?: VerificationStatus;
  };

type ProfileVerification = SignedVerification & {
  id: string;
  email: string | null;
  full_name: string | null;
  country: string | null;
  phone: string | null;
  verification_status: VerificationStatus;
  id_photo_url: string | null;
  selfie_url: string | null;
  selfie_with_id_url: string | null;
  created_at: string;
};

export default function AdminPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [loans, setLoans] = useState<AdminLoan[]>([]);
  const [profiles, setProfiles] = useState<ProfileVerification[]>([]);
  const [section, setSection] = useState<AdminSection>("verification");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const verificationRequests = useMemo(() => {
    return profiles.filter((profile) => profile.verification_status === "pending" || profile.verification_status === "rejected");
  }, [profiles]);

  const pendingLoans = useMemo(() => loans.filter((loan) => loan.status === "pending"), [loans]);
  const managedLoans = useMemo(() => loans.filter((loan) => loan.status === "approved" || loan.status === "paid"), [loans]);

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push("/admin/login");
        return;
      }

      const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
      const isAdmin = profile?.role === "admin" || adminEmails.includes(userData.user.email?.toLowerCase() || "");

      if (!isAdmin) {
        setMessage(t("adminAccessDenied"));
        setLoading(false);
        return;
      }

      await refreshAdminData();
      setLoading(false);
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function refreshAdminData() {
    const { data: loanRows, error: loansError } = await supabase.from("loans").select("*").order("created_at", { ascending: false });
    if (loansError) {
      setMessage(loansError.message);
      return;
    }

    const { data: profileRows, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, full_name, country, phone, verification_status, id_photo_url, selfie_url, selfie_with_id_url, created_at")
      .order("created_at", { ascending: false });

    if (profilesError) {
      setMessage(profilesError.message);
      return;
    }

    const signedProfiles = await Promise.all((profileRows || []).map((profile) => addSignedProfileUrls(profile as ProfileVerification)));
    const profileByUserId = new Map(signedProfiles.map((profile) => [profile.id, profile]));
    const loansWithSignedUrls = await Promise.all(
      (loanRows || []).map((loan) => addSignedVerificationUrls(loan as Loan, profileByUserId.get(loan.user_id)))
    );

    setProfiles(signedProfiles);
    setLoans(loansWithSignedUrls);
  }

  async function signVerificationPath(path: string | null) {
    if (!path) return null;
    if (path.startsWith("http")) return path;

    const { data, error } = await supabase.storage.from("selfies").createSignedUrl(path, 60 * 10);
    if (error) return null;
    return data.signedUrl;
  }

  async function addSignedProfileUrls(profile: ProfileVerification): Promise<ProfileVerification> {
    const [signedIdPhoto, signedSelfie, signedSelfieWithId] = await Promise.all([
      signVerificationPath(profile.id_photo_url),
      signVerificationPath(profile.selfie_url),
      signVerificationPath(profile.selfie_with_id_url)
    ]);

    return {
      ...profile,
      signed_id_photo_url: signedIdPhoto,
      signed_selfie_url: signedSelfie,
      signed_selfie_with_id_url: signedSelfieWithId
    };
  }

  async function addSignedVerificationUrls(loan: Loan, profile?: ProfileVerification): Promise<AdminLoan> {
    const [signedIdPhoto, signedSelfie, signedSelfieWithId] = await Promise.all([
      signVerificationPath(profile?.id_photo_url || loan.id_photo_url),
      signVerificationPath(profile?.selfie_url || loan.selfie_url),
      signVerificationPath(profile?.selfie_with_id_url || loan.selfie_with_id_url)
    ]);

    return {
      ...loan,
      verification_status: profile?.verification_status,
      signed_id_photo_url: signedIdPhoto,
      signed_selfie_url: signedSelfie,
      signed_selfie_with_id_url: signedSelfieWithId
    };
  }

  async function updateStatus(id: string, nextStatus: LoanStatus) {
    setMessage("");
    const patch = nextStatus === "paid" ? { status: nextStatus, paid_at: new Date().toISOString() } : { status: nextStatus };
    const { error } = await supabase.from("loans").update(patch).eq("id", id);
    if (error) {
      setMessage(error.message);
      return;
    }
    await refreshAdminData();
  }

  async function updateVerificationStatus(userId: string, nextStatus: "verified" | "rejected") {
    setMessage("");
    const patch =
      nextStatus === "verified"
        ? { verification_status: nextStatus, verified_at: new Date().toISOString() }
        : { verification_status: nextStatus, verified_at: null };
    const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
    if (error) {
      setMessage(error.message);
      return;
    }
    await refreshAdminData();
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  function statusLabel(nextStatus: LoanStatus) {
    return t(`status${nextStatus.charAt(0).toUpperCase()}${nextStatus.slice(1)}`);
  }

  function verificationLabel(nextStatus?: VerificationStatus) {
    if (!nextStatus) return t("verificationNotSubmitted");
    return t(`verification${nextStatus.charAt(0).toUpperCase()}${nextStatus.slice(1)}`);
  }

  function verificationImages(record: SignedVerification) {
    return [
      { label: t("idPhoto"), url: record.signed_id_photo_url },
      { label: t("selfie"), url: record.signed_selfie_url },
      { label: t("selfieWithId"), url: record.signed_selfie_with_id_url }
    ].filter((image): image is { label: string; url: string } => Boolean(image.url));
  }

  function sectionCount(nextSection: AdminSection) {
    if (nextSection === "verification") return verificationRequests.length;
    if (nextSection === "loanRequests") return pendingLoans.length;
    return managedLoans.length;
  }

  function openImage(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function downloadImage(url: string, filename: string) {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename.replace(/[^a-z0-9.-]+/gi, "-").toLowerCase();
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function escapeHtml(value: string) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function printVerificationPacket(profile: ProfileVerification) {
    const images = verificationImages(profile);
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) {
      setMessage(t("printWindowBlocked"));
      return;
    }

    const displayName = profile.full_name || profile.email || t("notProvided");
    const imageHtml = images
      .map(
        (image) => `
          <section class="photo">
            <h2>${escapeHtml(image.label)}</h2>
            <img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.label)}" />
          </section>
        `
      )
      .join("");

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>PRETEM ${escapeHtml(displayName)}</title>
          <style>
            body { color: #0b1f3a; font-family: Arial, sans-serif; margin: 28px; }
            h1 { margin: 0 0 6px; }
            .meta { border-bottom: 1px solid #d6e3ef; display: grid; gap: 6px; margin-bottom: 20px; padding-bottom: 16px; }
            .photo { break-inside: avoid; margin: 0 0 24px; page-break-inside: avoid; }
            .photo h2 { font-size: 16px; margin: 0 0 10px; }
            img { border: 1px solid #d6e3ef; display: block; max-height: 820px; max-width: 100%; object-fit: contain; }
          </style>
        </head>
        <body>
          <h1>PRETEM Verification</h1>
          <div class="meta">
            <strong>${escapeHtml(displayName)}</strong>
            <span>${escapeHtml(profile.phone || "")}</span>
            <span>${escapeHtml(profile.email || "")}</span>
            <span>${escapeHtml(verificationLabel(profile.verification_status))}</span>
          </div>
          ${imageHtml}
          <script>
            window.addEventListener("load", () => {
              window.focus();
              window.print();
            });
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  function VerificationCard({ profile }: { profile: ProfileVerification }) {
    const displayName = profile.full_name || profile.email || t("notProvided");
    const images = verificationImages(profile);

    return (
      <article className="card">
        <div className="loan-row admin-profile-row">
          <div>
            <strong>{displayName}</strong>
            <p className="muted">
              {profile.phone || t("notProvided")} · {profile.country || t("notProvided")}
            </p>
            <p className="muted">{profile.email || t("notProvided")}</p>
          </div>
          <span className={`status ${profile.verification_status}`}>{verificationLabel(profile.verification_status)}</span>
        </div>

        <div className="thumbs">
          {images.map((image) => (
            <div className="thumb-card" key={image.label}>
              <button className="image-open-button" onClick={() => openImage(image.url)} type="button">
                <Image alt={image.label} height={180} src={image.url} width={240} />
              </button>
              <strong>{image.label}</strong>
              <div className="actions">
                <button className="secondary compact" onClick={() => downloadImage(image.url, `${displayName}-${image.label}.jpg`)}>
                  {t("download")}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="admin-action-groups">
          <div>
            <h3>{t("documentReview")}</h3>
            <div className="actions">
              {images.length ? <button onClick={() => updateVerificationStatus(profile.id, "verified")}>{t("acceptDocuments")}</button> : null}
              {images.length ? (
                <button className="danger" onClick={() => updateVerificationStatus(profile.id, "rejected")}>
                  {t("rejectDocuments")}
                </button>
              ) : null}
              {images.length ? (
                <button className="secondary" onClick={() => printVerificationPacket(profile)}>
                  {t("printVerification")}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </article>
    );
  }

  function LoanCard({ loan, mode }: { loan: AdminLoan; mode: "request" | "management" }) {
    return (
      <article className="card">
        <div className="loan-row">
          <div>
            <strong>{loan.full_name}</strong>
            <p className="muted">
              {loan.phone} · {loan.reference}
            </p>
            <p className="muted">
              {getDestinationLabel(loan.destination_country, t)} {loan.currency ? `(${loan.currency})` : ""} ·{" "}
              {getPayoutMethodLabel(loan.payout_method, t)}
            </p>
            <p className="muted">{formatPayoutDetails(loan.payout_details, t)}</p>
            <p className="muted">
              {t("verificationStatus")}: {verificationLabel(loan.verification_status)}
            </p>
          </div>
          <div>{formatMoney(loan.amount)}</div>
          <div>
            <strong>{formatMoney(loan.repayment)}</strong>
            <p className="muted">
              {loan.repayment_days ?? "?"} {t("dayUnit")} ·{" "}
              {loan.interest_rate != null ? `${Math.round(loan.interest_rate * 100)}%` : t("rate")}
            </p>
          </div>
          <span className={`status ${loan.status}`}>{statusLabel(loan.status)}</span>
        </div>

        <div className="admin-action-groups">
          <div>
            <h3>{mode === "request" ? t("loanDecision") : t("loanManagement")}</h3>
            <div className="actions">
              {mode === "request" ? (
                <button disabled={loan.verification_status !== "verified"} onClick={() => updateStatus(loan.id, "approved")}>
                  {t("approveLoan")}
                </button>
              ) : null}
              {mode === "management" && loan.status === "approved" ? <button onClick={() => updateStatus(loan.id, "paid")}>{t("markPaid")}</button> : null}
              <button className="danger" onClick={() => updateStatus(loan.id, "rejected")}>
                {t("rejectLoan")}
              </button>
              {loan.terms_accepted ? (
                <button className="secondary" onClick={() => downloadLoanAgreement(loan, t)}>
                  {t("downloadAgreement")}
                </button>
              ) : null}
            </div>
            {mode === "request" && loan.verification_status !== "verified" ? <p className="muted">{t("approveLoanNeedsDocs")}</p> : null}
          </div>
        </div>
      </article>
    );
  }

  return (
    <section className="page">
      <div className="toolbar">
        <div>
          <h1>{t("adminDashboard")}</h1>
          <p className="muted">{t("adminDashboardBody")}</p>
        </div>
        <button className="secondary" onClick={signOut}>
          {t("signOut")}
        </button>
      </div>

      {message ? <p className="notice">{message}</p> : null}
      {loading ? <p className="notice">{t("loadingAdminData")}</p> : null}

      {!loading && !message ? (
        <>
          <div className="admin-section-tabs" aria-label={t("adminDashboard")}>
            {(["verification", "loanRequests", "loanManagement"] as AdminSection[]).map((item) => (
              <button className={section === item ? "active" : "secondary"} key={item} onClick={() => setSection(item)} type="button">
                {t(item)}
                <span>{sectionCount(item)}</span>
              </button>
            ))}
          </div>

          <div className="loan-list">
            {section === "verification" ? verificationRequests.map((profile) => <VerificationCard key={profile.id} profile={profile} />) : null}
            {section === "loanRequests" ? pendingLoans.map((loan) => <LoanCard key={loan.id} loan={loan} mode="request" />) : null}
            {section === "loanManagement" ? managedLoans.map((loan) => <LoanCard key={loan.id} loan={loan} mode="management" />) : null}
            {sectionCount(section) === 0 ? <p className="notice">{t("noAdminItems")}</p> : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
