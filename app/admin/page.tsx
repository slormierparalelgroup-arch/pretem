"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { downloadLoanAgreement } from "@/lib/agreement";
import { formatMoney, Loan, LoanStatus } from "@/lib/loans";
import { formatPayoutDetails, getDestinationLabel, getPayoutMethodLabel } from "@/lib/payout";
import { supabase } from "@/lib/supabase";

type AdminSection = "verification" | "loanRequests" | "loanManagement" | "users";

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
  credit_score: number | null;
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
  const [userSearch, setUserSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const verificationRequests = useMemo(() => {
    return profiles.filter((profile) => profile.verification_status === "pending" || profile.verification_status === "rejected");
  }, [profiles]);

  const pendingLoans = useMemo(() => loans.filter((loan) => loan.status === "pending"), [loans]);
  const managedLoans = useMemo(() => loans.filter((loan) => loan.status === "approved" || loan.status === "paid"), [loans]);
  const userRows = useMemo(() => {
    const search = userSearch.trim().toLowerCase();

    return profiles
      .map((profile) => {
        const userLoans = loans.filter((loan) => loan.user_id === profile.id);
        const paidLoans = userLoans.filter((loan) => loan.status === "paid").length;
        const approvedLoans = userLoans.filter((loan) => loan.status === "approved").length;
        const pendingUserLoans = userLoans.filter((loan) => loan.status === "pending").length;
        const rejectedLoans = userLoans.filter((loan) => loan.status === "rejected").length;
        const totalBorrowed = userLoans.reduce((sum, loan) => sum + Number(loan.amount || 0), 0);
        const totalRepayment = userLoans.reduce((sum, loan) => sum + Number(loan.repayment || 0), 0);
        const lastLoan = userLoans[0];

        return {
          profile,
          userLoans,
          paidLoans,
          approvedLoans,
          pendingUserLoans,
          rejectedLoans,
          totalBorrowed,
          totalRepayment,
          lastLoan
        };
      })
      .filter((row) => {
        if (!search) return true;
        const values = [
          row.profile.full_name,
          row.profile.email,
          row.profile.phone,
          row.profile.country,
          row.profile.verification_status,
          row.lastLoan?.reference
        ];
        return values.some((value) => (value || "").toLowerCase().includes(search));
      });
  }, [loans, profiles, userSearch]);

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
      .select("id, email, full_name, country, phone, credit_score, verification_status, id_photo_url, selfie_url, selfie_with_id_url, created_at")
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
    if (nextSection === "loanManagement") return managedLoans.length;
    return userRows.length;
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

  function DocumentButtons({ profile }: { profile: ProfileVerification }) {
    const displayName = profile.full_name || profile.email || t("notProvided");
    const images = verificationImages(profile);

    if (!images.length) return <span className="muted">{t("notProvided")}</span>;

    return (
      <div className="table-actions">
        {images.map((image) => (
          <span className="table-action-group" key={image.label}>
            <button className="secondary compact" onClick={() => openImage(image.url)}>
              {image.label}
            </button>
            <button className="secondary compact" onClick={() => downloadImage(image.url, `${displayName}-${image.label}.jpg`)}>
              {t("download")}
            </button>
          </span>
        ))}
      </div>
    );
  }

  function VerificationTable() {
    return (
      <div className="card admin-users-card">
        <div className="admin-table-wrap">
          <table className="admin-table admin-work-table">
            <thead>
              <tr>
                <th>{t("fullName")}</th>
                <th>{t("email")}</th>
                <th>{t("phoneNumber")}</th>
                <th>{t("signupCountry")}</th>
                <th>{t("verification")}</th>
                <th>{t("documents")}</th>
                <th>{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {verificationRequests.map((profile) => {
                const displayName = profile.full_name || profile.email || t("notProvided");
                const images = verificationImages(profile);

                return (
                  <tr key={profile.id}>
                    <td>{displayName}</td>
                    <td>{profile.email || t("notProvided")}</td>
                    <td>{profile.phone || t("notProvided")}</td>
                    <td>{profile.country || t("notProvided")}</td>
                    <td>
                      <span className={`status ${profile.verification_status}`}>{verificationLabel(profile.verification_status)}</span>
                    </td>
                    <td>
                      <DocumentButtons profile={profile} />
                    </td>
                    <td>
                      <div className="table-actions">
                        {images.length ? <button className="compact" onClick={() => updateVerificationStatus(profile.id, "verified")}>{t("acceptDocuments")}</button> : null}
                        {images.length ? (
                          <button className="danger compact" onClick={() => updateVerificationStatus(profile.id, "rejected")}>
                            {t("rejectDocuments")}
                          </button>
                        ) : null}
                        {images.length ? (
                          <button className="secondary compact" onClick={() => printVerificationPacket(profile)}>
                            {t("printVerification")}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function LoansTable({ rows, mode }: { rows: AdminLoan[]; mode: "request" | "management" }) {
    return (
      <div className="card admin-users-card">
        <div className="admin-table-wrap">
          <table className="admin-table admin-work-table">
            <thead>
              <tr>
                <th>{t("fullName")}</th>
                <th>{t("referenceNumber")}</th>
                <th>{t("phoneNumber")}</th>
                <th>{t("loanAmount")}</th>
                <th>{t("repayment")}</th>
                <th>{t("destinationFallback")}</th>
                <th>{t("payoutMethod")}</th>
                <th>{t("payoutInfo")}</th>
                <th>{t("verification")}</th>
                <th>{t("status")}</th>
                <th>{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((loan) => (
                <tr key={loan.id}>
                  <td>{loan.full_name}</td>
                  <td>{loan.reference}</td>
                  <td>{loan.phone}</td>
                  <td>{formatMoney(loan.amount)}</td>
                  <td>
                    {formatMoney(loan.repayment)}
                    <span className="muted table-subtext">
                      {loan.repayment_days ?? "?"} {t("dayUnit")} ·{" "}
                      {loan.interest_rate != null ? `${Math.round(loan.interest_rate * 100)}%` : t("rate")}
                    </span>
                  </td>
                  <td>
                    {getDestinationLabel(loan.destination_country, t)} {loan.currency ? `(${loan.currency})` : ""}
                  </td>
                  <td>{getPayoutMethodLabel(loan.payout_method, t)}</td>
                  <td>{formatPayoutDetails(loan.payout_details, t)}</td>
                  <td>
                    <span className={`status ${loan.verification_status || "pending"}`}>{verificationLabel(loan.verification_status)}</span>
                  </td>
                  <td>
                    <span className={`status ${loan.status}`}>{statusLabel(loan.status)}</span>
                  </td>
                  <td>
                    <div className="table-actions">
                      {mode === "request" ? (
                        <button className="compact" disabled={loan.verification_status !== "verified"} onClick={() => updateStatus(loan.id, "approved")}>
                          {t("approveLoan")}
                        </button>
                      ) : null}
                      {mode === "management" && loan.status === "approved" ? (
                        <button className="compact" onClick={() => updateStatus(loan.id, "paid")}>
                          {t("markPaid")}
                        </button>
                      ) : null}
                      <button className="danger compact" onClick={() => updateStatus(loan.id, "rejected")}>
                        {t("rejectLoan")}
                      </button>
                      {loan.terms_accepted ? (
                        <button className="secondary compact" onClick={() => downloadLoanAgreement(loan, t)}>
                          {t("downloadAgreement")}
                        </button>
                      ) : null}
                      {mode === "request" && loan.verification_status !== "verified" ? <span className="muted table-subtext">{t("approveLoanNeedsDocs")}</span> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function UsersDatabase() {
    return (
      <div className="card admin-users-card">
        <div className="admin-table-toolbar">
          <div>
            <h2>{t("usersDatabase")}</h2>
            <p className="muted">{t("usersDatabaseBody")}</p>
          </div>
          <label>
            {t("searchUsers")}
            <input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder={t("searchUsersPlaceholder")} />
          </label>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t("fullName")}</th>
                <th>{t("email")}</th>
                <th>{t("phoneNumber")}</th>
                <th>{t("signupCountry")}</th>
                <th>{t("verification")}</th>
                <th>{t("creditScore")}</th>
                <th>{t("creditHistory")}</th>
                <th>{t("loanSummary")}</th>
                <th>{t("lastLoan")}</th>
              </tr>
            </thead>
            <tbody>
              {userRows.map((row) => (
                <tr key={row.profile.id}>
                  <td>{row.profile.full_name || t("notProvided")}</td>
                  <td>{row.profile.email || t("notProvided")}</td>
                  <td>{row.profile.phone || t("notProvided")}</td>
                  <td>{row.profile.country || t("notProvided")}</td>
                  <td>
                    <span className={`status ${row.profile.verification_status}`}>{verificationLabel(row.profile.verification_status)}</span>
                  </td>
                  <td>{row.profile.credit_score ?? 500}</td>
                  <td>
                    {t("paidShort")}: {row.paidLoans} · {t("approvedShort")}: {row.approvedLoans} · {t("pendingShort")}: {row.pendingUserLoans} ·{" "}
                    {t("rejectedShort")}: {row.rejectedLoans}
                  </td>
                  <td>
                    {row.userLoans.length} {t("loansShort")} · {formatMoney(row.totalBorrowed)} / {formatMoney(row.totalRepayment)}
                  </td>
                  <td>{row.lastLoan ? `${row.lastLoan.reference} · ${statusLabel(row.lastLoan.status)}` : t("notProvided")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {userRows.length === 0 ? <p className="notice">{t("noAdminItems")}</p> : null}
      </div>
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
            {(["verification", "loanRequests", "loanManagement", "users"] as AdminSection[]).map((item) => (
              <button className={section === item ? "active" : "secondary"} key={item} onClick={() => setSection(item)} type="button">
                {t(item)}
                <span>{sectionCount(item)}</span>
              </button>
            ))}
          </div>

          <div className="loan-list">
            {section === "verification" && verificationRequests.length ? <VerificationTable /> : null}
            {section === "loanRequests" && pendingLoans.length ? <LoansTable rows={pendingLoans} mode="request" /> : null}
            {section === "loanManagement" && managedLoans.length ? <LoansTable rows={managedLoans} mode="management" /> : null}
            {section === "users" ? <UsersDatabase /> : null}
            {section !== "users" && sectionCount(section) === 0 ? <p className="notice">{t("noAdminItems")}</p> : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
