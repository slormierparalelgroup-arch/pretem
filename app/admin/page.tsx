"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { formatMoney, Loan, LoanStatus } from "@/lib/loans";
import { formatPayoutDetails, getDestinationLabel, getPayoutMethodLabel } from "@/lib/payout";
import { supabase } from "@/lib/supabase";

const statuses: Array<"all" | LoanStatus> = ["all", "pending", "approved", "rejected", "paid", "canceled"];

type AdminLoan = Loan & {
  verification_status?: "not_submitted" | "pending" | "verified" | "rejected";
  signed_id_photo_url?: string | null;
  signed_selfie_url?: string | null;
  signed_selfie_with_id_url?: string | null;
};

type ProfileVerification = {
  id: string;
  verification_status: "not_submitted" | "pending" | "verified" | "rejected";
  id_photo_url: string | null;
  selfie_url: string | null;
  selfie_with_id_url: string | null;
};

export default function AdminPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [loans, setLoans] = useState<AdminLoan[]>([]);
  const [status, setStatus] = useState<"all" | LoanStatus>("pending");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const filteredLoans = useMemo(() => {
    if (status === "all") return loans;
    return loans.filter((loan) => loan.status === status);
  }, [loans, status]);

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

      await refreshLoans();
      setLoading(false);
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function refreshLoans() {
    const { data, error } = await supabase.from("loans").select("*").order("created_at", { ascending: false });
    if (error) {
      setMessage(error.message);
      return;
    }

    const userIds = [...new Set((data || []).map((loan) => loan.user_id))];
    const { data: profiles } = userIds.length
      ? await supabase
          .from("profiles")
          .select("id, verification_status, id_photo_url, selfie_url, selfie_with_id_url")
          .in("id", userIds)
      : { data: [] };

    const profileByUserId = new Map((profiles || []).map((profile) => [profile.id, profile as ProfileVerification]));
    const loansWithSignedUrls = await Promise.all((data || []).map((loan) => addSignedVerificationUrls(loan, profileByUserId.get(loan.user_id))));
    setLoans(loansWithSignedUrls);
  }

  async function signVerificationPath(path: string | null) {
    if (!path) return null;
    if (path.startsWith("http")) return path;

    const { data, error } = await supabase.storage.from("selfies").createSignedUrl(path, 60 * 10);
    if (error) return null;
    return data.signedUrl;
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
    await refreshLoans();
  }

  async function updateVerificationStatus(userId: string, nextStatus: "verified" | "rejected") {
    setMessage("");
    const patch = nextStatus === "verified" ? { verification_status: nextStatus, verified_at: new Date().toISOString() } : { verification_status: nextStatus, verified_at: null };
    const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
    if (error) {
      setMessage(error.message);
      return;
    }
    await refreshLoans();
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  function statusLabel(nextStatus: LoanStatus) {
    return t(`status${nextStatus.charAt(0).toUpperCase()}${nextStatus.slice(1)}`);
  }

  function filterLabel(nextStatus: "all" | LoanStatus) {
    return nextStatus === "all" ? t("allStatuses") : statusLabel(nextStatus);
  }

  function verificationLabel(nextStatus?: AdminLoan["verification_status"]) {
    if (!nextStatus) return t("verificationNotSubmitted");
    return t(`verification${nextStatus.charAt(0).toUpperCase()}${nextStatus.slice(1)}`);
  }

  return (
    <section className="page">
      <div className="toolbar">
        <div>
          <h1>{t("adminDashboard")}</h1>
          <p className="muted">{t("reviewRequestsBody")}</p>
        </div>
        <button className="secondary" onClick={signOut}>
          {t("signOut")}
        </button>
      </div>

      {message ? <p className="notice">{message}</p> : null}
      {loading ? <p className="notice">{t("loadingAdminData")}</p> : null}

      {!loading && !message ? (
        <>
          <div className="toolbar">
            <label>
              {t("filterByStatus")}
              <select value={status} onChange={(event) => setStatus(event.target.value as "all" | LoanStatus)}>
                {statuses.map((item) => (
                  <option key={item} value={item}>
                    {filterLabel(item)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="loan-list">
            {filteredLoans.map((loan) => (
              <article className="card" key={loan.id}>
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

                <div className="thumbs">
                  {loan.signed_id_photo_url ? (
                    <Image alt="ID document" height={180} src={loan.signed_id_photo_url} width={240} />
                  ) : null}
                  {loan.signed_selfie_url ? <Image alt="Selfie" height={180} src={loan.signed_selfie_url} width={240} /> : null}
                  {loan.signed_selfie_with_id_url ? (
                    <Image alt="Selfie with ID" height={180} src={loan.signed_selfie_with_id_url} width={240} />
                  ) : null}
                </div>

                <div className="actions" style={{ marginTop: 14 }}>
                  <button className="secondary" onClick={() => updateVerificationStatus(loan.user_id, "verified")}>
                    {t("verifyIdentityAction")}
                  </button>
                  <button className="secondary" onClick={() => updateVerificationStatus(loan.user_id, "rejected")}>
                    {t("rejectIdentityAction")}
                  </button>
                  {loan.status !== "canceled" ? (
                    <>
                      <button onClick={() => updateStatus(loan.id, "approved")}>{t("approve")}</button>
                      <button className="danger" onClick={() => updateStatus(loan.id, "rejected")}>
                        {t("reject")}
                      </button>
                      <button className="secondary" onClick={() => updateStatus(loan.id, "paid")}>
                        {t("markPaid")}
                      </button>
                    </>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
