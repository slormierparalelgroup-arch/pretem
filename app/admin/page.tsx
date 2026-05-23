"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { downloadLoanAgreement } from "@/lib/agreement";
import { getCurrentUser } from "@/lib/auth";
import { calculateCreditProfile, calculateCreditScoreFromLoans, formatCreditMoney } from "@/lib/credit";
import { formatDueCountdown, formatMoney, getLoanDueDate, Loan, LoanStatus } from "@/lib/loans";
import { formatPayoutDetails, getDestinationLabel, getPayoutMethodLabel } from "@/lib/payout";
import { supabase } from "@/lib/supabase";

type AdminSection = "verification" | "loanRequests" | "loanManagement" | "users";

type VerificationStatus = "not_submitted" | "pending" | "verified" | "rejected";

type AdminLoan = Loan &
  {
    verification_status?: VerificationStatus;
  };

type ProfileVerification = {
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

type VerificationImage = {
  label: string;
  path: string | null;
  type: string;
};

type AvailableVerificationImage = VerificationImage & {
  path: string;
};

type PreviewImage = {
  filename: string;
  label: string;
  url: string;
} | null;

function withAdminTimeout<T>(promise: PromiseLike<T>, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(message)), 15000);

    promise.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeout);
        reject(error);
      }
    );
  });
}

function TransferIdControl({
  initialValue,
  loan,
  onMarkMoneySent,
  t
}: {
  initialValue: string;
  loan: AdminLoan;
  onMarkMoneySent: (loan: AdminLoan, transferId: string) => void;
  t: (key: string) => string;
}) {
  const [value, setValue] = useState(initialValue);

  if (loan.disbursed_at) {
    return (
      <div className="sent-transfer-box">
        <span className="status approved">{t("moneySent")}</span>
        <strong>{initialValue || t("notProvided")}</strong>
      </div>
    );
  }

  return (
    <>
      <input
        className="compact-input"
        onChange={(event) => setValue(event.target.value)}
        placeholder={t("transferId")}
        value={value}
      />
      <button className="compact success" onClick={() => onMarkMoneySent(loan, value)}>
        {t("markMoneySent")}
      </button>
    </>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [loans, setLoans] = useState<AdminLoan[]>([]);
  const [profiles, setProfiles] = useState<ProfileVerification[]>([]);
  const [previewImage, setPreviewImage] = useState<PreviewImage>(null);
  const [section, setSection] = useState<AdminSection>("verification");
  const [userSearch, setUserSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());

  const verificationRequests = useMemo(() => {
    return profiles.filter((profile) => {
      const hasDocuments = Boolean(profile.id_photo_url || profile.selfie_url || profile.selfie_with_id_url);
      return profile.verification_status !== "verified" && (profile.verification_status !== "not_submitted" || hasDocuments);
    });
  }, [profiles]);

  const pendingLoans = useMemo(() => loans.filter((loan) => loan.status === "pending"), [loans]);
  const managedLoans = useMemo(() => loans.filter((loan) => loan.status === "approved"), [loans]);
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
        const creditProjection = calculateCreditProfile(userLoans, profile.country);

        return {
          profile,
          userLoans,
          paidLoans,
          approvedLoans,
          pendingUserLoans,
          rejectedLoans,
          totalBorrowed,
          totalRepayment,
          creditProjection,
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
      setLoading(true);
      setMessage("");

      try {
        const user = await withAdminTimeout(getCurrentUser(), t("adminLoadTimeout"));
        if (!user) {
          router.push("/admin/login");
          return;
        }

        const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
          .split(",")
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean);

        const { data: profile, error: profileError } = await withAdminTimeout(
          supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
          t("adminLoadTimeout")
        );
        if (profileError) throw profileError;

        const isAdmin = profile?.role === "admin" || adminEmails.includes(user.email?.toLowerCase() || "");

        if (!isAdmin) {
          setMessage(t("adminAccessDenied"));
          return;
        }

        await refreshAdminData();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : t("adminLoadError"));
      } finally {
        setLoading(false);
      }
    }

    load();
    const timer = window.setInterval(() => setNow(new Date()), 60 * 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function refreshAdminData() {
    const loanResult = await withAdminTimeout(
      supabase.from("loans").select("*").order("created_at", { ascending: false }),
      t("adminLoadTimeout")
    );
    const loanRows = loanResult.data;
    const loansError = loanResult.error;

    if (loansError) {
      setMessage(loansError.message);
      return;
    }

    const { data: profileRows, error: profilesError } = await withAdminTimeout(
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      t("adminLoadTimeout")
    );

    if (profilesError) {
      setMessage(profilesError.message);
      return;
    }

    const nextProfiles = (profileRows || []).map((profile) => ({
      ...profile,
      verification_status: profile.verification_status || "not_submitted"
    })) as ProfileVerification[];
    const profileByUserId = new Map(nextProfiles.map((profile) => [profile.id, profile]));
    const loansWithVerification = (loanRows || []).map((loan) => {
      const nextLoan = loan as Loan;
      return addLoanVerificationStatus(nextLoan, profileByUserId.get(nextLoan.user_id));
    });

    setProfiles(nextProfiles);
    setLoans(loansWithVerification);
  }

  async function signVerificationPath(path: string | null) {
    if (!path) return null;
    if (path.startsWith("http")) return path;

    const { data, error } = await supabase.storage.from("selfies").createSignedUrl(path, 60 * 10);
    if (error) return null;
    return data.signedUrl;
  }

  function addLoanVerificationStatus(loan: Loan, profile?: ProfileVerification): AdminLoan {
    return {
      ...loan,
      verification_status: profile?.verification_status
    };
  }

  async function updateStatus(id: string, nextStatus: LoanStatus) {
    setMessage("");
    const patch =
      nextStatus === "paid"
        ? { status: nextStatus, paid_at: new Date().toISOString() }
        : nextStatus === "rejected"
          ? { status: nextStatus, rejected_at: new Date().toISOString() }
          : { status: nextStatus };
    const { error } = await supabase.from("loans").update(patch).eq("id", id);
    if (error) {
      setMessage(error.message);
      return;
    }
    await refreshAdminData();
  }

  async function markMoneySent(loan: AdminLoan, submittedTransferId: string) {
    const transferId = (submittedTransferId || loan.disbursement_transfer_id || "").trim();
    if (!transferId) {
      setMessage(t("transferIdRequired"));
      return;
    }

    setMessage("");
    const disbursedAt = new Date();
    const dueDate = new Date(disbursedAt);
    dueDate.setDate(dueDate.getDate() + (loan.repayment_days || 7));
    const { error } = await supabase
      .from("loans")
      .update({ disbursement_transfer_id: transferId, disbursed_at: disbursedAt.toISOString(), due_date: dueDate.toISOString() })
      .eq("id", loan.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    await refreshAdminData();
  }

  async function reviewRepayment(loan: AdminLoan, accepted: boolean) {
    setMessage("");
    const patch = accepted
      ? { status: "paid", paid_at: new Date().toISOString(), repayment_review_status: "accepted" }
      : { repayment_review_status: "rejected" };
    const { error } = await supabase.from("loans").update(patch).eq("id", loan.id);
    if (error) {
      setMessage(error.message);
      return;
    }

    const nextLoan = accepted
      ? ({ ...loan, status: "paid", repayment_review_status: "accepted", paid_at: new Date().toISOString() } as Loan)
      : ({ ...loan, repayment_review_status: "rejected" } as Loan);
    const userLoans = loans.filter((item) => item.user_id === loan.user_id && item.id !== loan.id).concat(nextLoan);
    const nextScore = calculateCreditScoreFromLoans(userLoans);
    await supabase.from("profiles").update({ credit_score: nextScore }).eq("id", loan.user_id);

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

  function verificationImages(record: Pick<ProfileVerification, "id_photo_url" | "selfie_url" | "selfie_with_id_url">): AvailableVerificationImage[] {
    return [
      { label: t("idPhoto"), path: record.id_photo_url, type: "id-photo" },
      { label: t("selfie"), path: record.selfie_url, type: "selfie" },
      { label: t("selfieWithId"), path: record.selfie_with_id_url, type: "selfie-with-id" }
    ].filter((image): image is AvailableVerificationImage => Boolean(image.path));
  }

  function sectionCount(nextSection: AdminSection) {
    if (nextSection === "verification") return verificationRequests.length;
    if (nextSection === "loanRequests") return pendingLoans.length;
    if (nextSection === "loanManagement") return managedLoans.length;
    return userRows.length;
  }

  function emptySectionMessage() {
    if (section === "verification") return t("noVerificationItems");
    if (section === "loanRequests") return t("noLoanRequestItems");
    if (section === "loanManagement") return t("noLoanManagementItems");
    return t("noAdminItems");
  }

  async function openImage(path: string, label: string, filename: string) {
    const url = await signVerificationPath(path);
    if (!url) return;
    setPreviewImage({ filename, label, url });
  }

  function escapeHtml(value: string) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function printVerificationPacket(profile: ProfileVerification) {
    const images = verificationImages(profile);
    const signedImages = await Promise.all(
      images.map(async (image) => ({
        ...image,
        url: await signVerificationPath(image.path)
      }))
    );
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) {
      setMessage(t("printWindowBlocked"));
      return;
    }

    const displayName = profile.full_name || profile.email || t("notProvided");
    const imageHtml = signedImages
      .filter((image): image is AvailableVerificationImage & { url: string } => Boolean(image.url))
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

  function DocumentPreviewCard({
    displayName,
    image
  }: {
    displayName: string;
    image: AvailableVerificationImage;
  }) {
    const [url, setUrl] = useState<string | null>(null);

    useEffect(() => {
      let isMounted = true;

      signVerificationPath(image.path).then((signedUrl) => {
        if (isMounted) setUrl(signedUrl);
      });

      return () => {
        isMounted = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [image.path]);

    return (
      <div className="admin-document-preview">
        <button
          className="admin-document-image"
          disabled={!url}
          onClick={() => openImage(image.path, image.label, `${displayName}-${image.label}.jpg`)}
          type="button"
        >
          {url ? (
            <Image alt={image.label} height={96} src={url} unoptimized width={128} />
          ) : (
            <span>{t("loadingTracker")}</span>
          )}
        </button>
        <div>
          <strong>{image.label}</strong>
        </div>
      </div>
    );
  }

  function DocumentButtons({ profile }: { profile: ProfileVerification }) {
    const displayName = profile.full_name || profile.email || t("notProvided");
    const images = verificationImages(profile);

    if (!images.length) return <span className="muted">{t("notProvided")}</span>;

    return (
      <div className="admin-document-grid">
        {images.map((image) => (
          <DocumentPreviewCard displayName={displayName} image={image} key={image.label} />
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
                <th>{t("dueDate")}</th>
                <th>{t("destinationFallback")}</th>
                <th>{t("payoutMethod")}</th>
                <th>{t("payoutInfo")}</th>
                <th>{t("verification")}</th>
                <th>{t("status")}</th>
                <th>{t("moneySent")}</th>
                <th>{t("repaymentProof")}</th>
                <th>{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((loan) => {
                const dueDate = getLoanDueDate(loan);
                const countdown = formatDueCountdown(loan, now);

                return (
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
                    {dueDate ? dueDate.toLocaleDateString() : t("dueDatePending")}
                    {loan.disbursed_at && dueDate ? (
                      <span className={`countdown-pill table-countdown ${countdown.state}`}>
                        {countdown.state === "late" ? t("pastDueBy") : t("countdown")}: {countdown.text}
                      </span>
                    ) : null}
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
                    {loan.disbursed_at ? (
                      <>
                        <span className="status approved">{t("sent")}</span>
                        <span className="muted table-subtext">{loan.disbursement_transfer_id || t("notProvided")}</span>
                      </>
                    ) : (
                      <span className="muted">{t("notProvided")}</span>
                    )}
                  </td>
                  <td>
                    {loan.repayment_transfer_id ? (
                      <>
                        <span className="status pending">{t("submitted")}</span>
                        <span className="muted table-subtext">
                          {t("repaymentAmount")}: {formatMoney(loan.repayment_submitted_amount || 0)}
                        </span>
                        <span className="muted table-subtext">
                          {t("repaymentTransferId")}: {loan.repayment_transfer_id}
                        </span>
                        {loan.repayment_screenshot_url ? (
                          <button
                            className="secondary compact"
                            onClick={() => openImage(loan.repayment_screenshot_url || "", t("repaymentScreenshot"), `${loan.reference}-repayment.jpg`)}
                          >
                            {t("repaymentScreenshot")}
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <span className="muted">{t("notProvided")}</span>
                    )}
                  </td>
                  <td>
                    <div className="table-actions">
                      {mode === "request" ? (
                        <button className="compact" disabled={loan.verification_status !== "verified"} onClick={() => updateStatus(loan.id, "approved")}>
                          {t("approveLoan")}
                        </button>
                      ) : null}
                      {mode === "management" && loan.status === "approved" ? (
                        <>
                          <TransferIdControl initialValue={loan.disbursement_transfer_id || ""} loan={loan} onMarkMoneySent={markMoneySent} t={t} />
                          {loan.repayment_transfer_id && Number(loan.repayment_submitted_amount || 0) === Number(loan.repayment) ? (
                            <button className="compact success" onClick={() => reviewRepayment(loan, true)}>
                              {t("acceptRepayment")}
                            </button>
                          ) : (
                            <span className="muted table-subtext">{t("waitForRepaymentProof")}</span>
                          )}
                          {loan.repayment_transfer_id ? (
                            <button className="danger compact" onClick={() => reviewRepayment(loan, false)}>
                              {t("denyRepayment")}
                            </button>
                          ) : null}
                        </>
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
                );
              })}
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
                <th>{t("documents")}</th>
                <th>{t("creditScore")}</th>
                <th>{t("currentCreditLimit")}</th>
                <th>{t("nextLimit")}</th>
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
                  <td>
                    <DocumentButtons profile={row.profile} />
                  </td>
                  <td>{row.profile.credit_score ?? 500}</td>
                  <td>{formatCreditMoney(row.creditProjection.currentLimit, row.profile.country)}</td>
                  <td>
                    {t("onTimeShort")}: {formatCreditMoney(row.creditProjection.onTimeLimit, row.profile.country)} · {t("earlyShort")}:{" "}
                    {formatCreditMoney(row.creditProjection.earlyLimit, row.profile.country)}
                  </td>
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

      {previewImage ? (
        <div className="image-modal" role="dialog" aria-modal="true" aria-label={previewImage.label}>
          <div className="image-modal-panel">
            <div className="toolbar">
              <strong>{previewImage.label}</strong>
              <div className="actions">
                <a
                  className="button compact"
                  download={previewImage.filename.replace(/[^a-z0-9.-]+/gi, "-").toLowerCase()}
                  href={previewImage.url}
                >
                  {t("download")}
                </a>
                <button className="secondary compact" onClick={() => setPreviewImage(null)} type="button">
                  {t("close")}
                </button>
              </div>
            </div>
            <Image alt={previewImage.label} height={900} src={previewImage.url} unoptimized width={1200} />
          </div>
        </div>
      ) : null}

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
            {section !== "users" && sectionCount(section) === 0 ? <p className="notice">{emptySectionMessage()}</p> : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
