"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { downloadLoanAgreement } from "@/lib/agreement";
import { getCurrentUser } from "@/lib/auth";
import { formatMoney, Loan, LoanStatus } from "@/lib/loans";
import { getDestinationLabel, getPayoutMethodLabel } from "@/lib/payout";
import { supabase } from "@/lib/supabase";

const statuses: Array<"all" | LoanStatus> = ["all", "pending", "approved", "rejected", "paid", "canceled"];
type VerificationStatus = "not_submitted" | "pending" | "verified" | "rejected";

type ProfileStatus = {
  email: string | null;
  full_name: string | null;
  phone: string | null;
  country: string | null;
  verification_status: VerificationStatus;
  verified_at: string | null;
};

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [profile, setProfile] = useState<ProfileStatus | null>(null);
  const [status, setStatus] = useState<"all" | LoanStatus>("all");
  const [repaymentIds, setRepaymentIds] = useState<Record<string, string>>({});
  const [repaymentAmounts, setRepaymentAmounts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const filteredLoans = useMemo(() => {
    if (status === "all") return loans;
    return loans.filter((loan) => loan.status === status);
  }, [loans, status]);

  useEffect(() => {
    loadLoans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function loadLoans() {
    setLoading(true);
    const user = await getCurrentUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const [{ data }, { data: profileData }] = await Promise.all([
      supabase.from("loans").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("profiles").select("email, full_name, phone, country, verification_status, verified_at").eq("id", user.id).maybeSingle()
    ]);

    setLoans(data || []);
    setProfile((profileData as ProfileStatus | null) || null);
    setLoading(false);
  }

  async function cancelLoan(id: string) {
    setMessage("");
    const { error } = await supabase.rpc("cancel_pending_loan", { loan_id: id });
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(t("cancelRequestSuccess"));
    await loadLoans();
  }

  async function submitRepayment(loan: Loan) {
    const transferId = (repaymentIds[loan.id] || "").trim();
    const paymentAmount = Number(repaymentAmounts[loan.id] || loan.repayment_submitted_amount || 0);
    if (!transferId) {
      setMessage(t("transferIdRequired"));
      return;
    }
    if (Number(paymentAmount.toFixed(2)) !== Number(Number(loan.repayment).toFixed(2))) {
      setMessage(t("repaymentAmountMismatch"));
      return;
    }

    setMessage("");
    const { error } = await supabase.rpc("submit_loan_repayment", {
      loan_id: loan.id,
      payment_amount: paymentAmount,
      transfer_id: transferId
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(t("repaymentSubmitted"));
    await loadLoans();
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

  function verificationLabel(nextStatus?: VerificationStatus) {
    if (!nextStatus) return t("verificationNotSubmitted");
    return t(`verification${nextStatus.charAt(0).toUpperCase()}${nextStatus.slice(1)}`);
  }

  function firstName() {
    return (profile?.full_name || "").trim().split(/\s+/)[0] || t("user");
  }

  return (
    <section className="page">
      <div className="toolbar">
        <div>
          <h1>{t("hiUser").replace("{name}", firstName())}</h1>
          <p className="muted">{t("loanHistoryBody")}</p>
          {profile?.full_name ? <p className="muted">{t("fullName")}: {profile.full_name}</p> : null}
        </div>
        <div className="actions">
          <Link className="button secondary" href="/profile">
            {t("profile")}
          </Link>
          <Link className="button" href="/request-loan">
            {t("newRequest")}
          </Link>
          <button className="secondary" onClick={signOut}>
            {t("signOut")}
          </button>
        </div>
      </div>

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

      {loading ? <p className="notice">{t("loadingLoanHistory")}</p> : null}
      {message ? <p className="notice">{message}</p> : null}

      {profile ? (
        <div className={`notice verification-notice ${profile.verification_status}`}>
          <div>
            <strong>
              {t("verificationStatus")}: {verificationLabel(profile.verification_status)}
            </strong>
            <p>
              {profile.verification_status === "verified" ? t("dashboardVerificationApproved") : null}
              {profile.verification_status === "pending" ? t("dashboardVerificationPending") : null}
              {profile.verification_status === "rejected" ? t("dashboardVerificationRejected") : null}
              {profile.verification_status === "not_submitted" ? t("dashboardVerificationNotSubmitted") : null}
            </p>
          </div>
          {profile.verification_status === "verified" ? (
            <Link className="button compact" href="/request-loan">
              {t("requestLoan")}
            </Link>
          ) : (
            <Link className="button secondary compact" href="/verify-identity">
              {t("verifyIdentity")}
            </Link>
          )}
        </div>
      ) : null}

      {!loading && filteredLoans.length === 0 ? (
        <div className="panel">
          <h2>{t("noLoansFound")}</h2>
          <p className="muted">{t("noLoansFoundBody")}</p>
        </div>
      ) : null}

      <div className="loan-list">
        {filteredLoans.map((loan) => (
          <article className="card loan-row" key={loan.id}>
            <div>
              <strong>{loan.reference}</strong>
              <p className="muted">
                {new Date(loan.created_at).toLocaleDateString()} · {getDestinationLabel(loan.destination_country, t)}{" "}
                {loan.currency ? `(${loan.currency})` : ""}
              </p>
            </div>
            <div>{formatMoney(loan.amount)}</div>
            <div>
              <strong>{formatMoney(loan.repayment)}</strong>
              <p className="muted">
                {loan.repayment_days ?? "?"} {t("dayUnit")} · {loan.interest_rate != null ? `${Math.round(loan.interest_rate * 100)}%` : t("rate")}
              </p>
              <p className="muted">{getPayoutMethodLabel(loan.payout_method, t)}</p>
            </div>
            <div className="stack-actions">
              <span className={`status ${loan.status}`}>{statusLabel(loan.status)}</span>
              {loan.status === "pending" ? (
                <button className="secondary compact" onClick={() => cancelLoan(loan.id)}>
                  {t("cancelRequest")}
                </button>
              ) : null}
              {loan.terms_accepted ? (
                <button className="secondary compact" onClick={() => downloadLoanAgreement(loan, t)}>
                  {t("downloadAgreement")}
                </button>
              ) : null}
              {loan.disbursement_transfer_id ? (
                <div className="loan-alert success">
                  <strong>{t("moneySentNotice")}</strong>
                  <span>
                    {t("moneySentTransferId")}: {loan.disbursement_transfer_id}
                  </span>
                </div>
              ) : null}
              {loan.status === "approved" ? (
                <div className="loan-payment-box">
                  <strong>{t("payLoan")}</strong>
                  <span className="muted">
                    {t("payLoanBody")}: {formatMoney(loan.repayment)}
                  </span>
                  {loan.repayment_transfer_id ? (
                    <div className="loan-alert pending">
                      <strong>{t("repaymentSubmittedNotice")}</strong>
                      <span>
                        {t("repaymentAmount")}: {formatMoney(loan.repayment_submitted_amount || 0)}
                      </span>
                      <span>
                        {t("repaymentTransferId")}: {loan.repayment_transfer_id}
                      </span>
                    </div>
                  ) : null}
                  <input
                    className="compact-input"
                    disabled={Boolean(loan.repayment_transfer_id)}
                    min="0"
                    onChange={(event) => setRepaymentAmounts((values) => ({ ...values, [loan.id]: event.target.value }))}
                    placeholder={t("repaymentAmount")}
                    step="0.01"
                    type="number"
                    value={repaymentAmounts[loan.id] ?? loan.repayment_submitted_amount ?? ""}
                  />
                  <input
                    className="compact-input"
                    disabled={Boolean(loan.repayment_transfer_id)}
                    onChange={(event) => setRepaymentIds((values) => ({ ...values, [loan.id]: event.target.value }))}
                    placeholder={t("repaymentTransferId")}
                    value={repaymentIds[loan.id] ?? loan.repayment_transfer_id ?? ""}
                  />
                  {!loan.repayment_transfer_id ? (
                    <button className="compact success" onClick={() => submitRepayment(loan)}>
                      {t("submitPaymentId")}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
