"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { FormEvent, useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { getCurrentUser } from "@/lib/auth";
import { formatDueCountdown, formatMoney, getLoanDueDate, Loan } from "@/lib/loans";
import { formatPayoutDetails, getDestinationLabel, getPayoutMethodLabel } from "@/lib/payout";
import { supabase } from "@/lib/supabase";

function RequestStatusContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const [reference, setReference] = useState(searchParams.get("reference") || "");
  const [loan, setLoan] = useState<Loan | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [repaymentAmount, setRepaymentAmount] = useState("");
  const [repaymentScreenshot, setRepaymentScreenshot] = useState<File | null>(null);
  const [repaymentTransferId, setRepaymentTransferId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => new Date());

  async function lookup(value = reference) {
    if (!value.trim()) return;
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("loans")
      .select("*")
      .eq("reference", value.trim().toUpperCase())
      .maybeSingle();

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (!data) {
      setLoan(null);
      setMessage(t("noRequestFound"));
      return;
    }

    setLoan(data);
    setRepaymentAmount(data.repayment_submitted_amount ? String(data.repayment_submitted_amount) : "");
    setRepaymentTransferId(data.repayment_transfer_id || "");
  }

  useEffect(() => {
    getCurrentUser().then((user) => setUserId(user?.id || null));
    const initialReference = searchParams.get("reference");
    if (initialReference) lookup(initialReference);
    const timer = window.setInterval(() => setNow(new Date()), 60 * 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    lookup();
  }

  function statusLabel(status: Loan["status"]) {
    return t(`status${status.charAt(0).toUpperCase()}${status.slice(1)}`);
  }

  async function submitRepayment() {
    if (!loan) return;
    const transferId = repaymentTransferId.trim();
    if (!transferId) {
      setMessage(t("transferIdRequired"));
      return;
    }
    const paymentAmount = Number(repaymentAmount);
    if (Number(paymentAmount.toFixed(2)) !== Number(Number(loan.repayment).toFixed(2))) {
      setMessage(t("repaymentAmountMismatch"));
      return;
    }

    setLoading(true);
    setMessage("");
    let screenshotPath = loan.repayment_screenshot_url || null;
    if (repaymentScreenshot) {
      const extension = repaymentScreenshot.name.split(".").pop() || "jpg";
      screenshotPath = `${loan.user_id}/repayments/${loan.id}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("selfies").upload(screenshotPath, repaymentScreenshot, { upsert: true });
      if (uploadError) {
        setLoading(false);
        setMessage(uploadError.message);
        return;
      }
    }

    const { error } = await supabase.rpc("submit_loan_repayment", {
      loan_id: loan.id,
      payment_amount: paymentAmount,
      screenshot_path: screenshotPath,
      transfer_id: transferId
    });
    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(t("repaymentSubmitted"));
    lookup(loan.reference);
  }

  return (
    <section className="page">
      <form className="panel form" onSubmit={submit}>
        <h1>{t("requestStatusTitle")}</h1>
        <label>
          {t("referenceNumber")}
          <input value={reference} onChange={(event) => setReference(event.target.value.toUpperCase())} placeholder="PRE-1234-ABC" />
        </label>
        <button disabled={loading}>
          <Search size={18} />
          {loading ? t("checking") : t("checkStatus")}
        </button>
      </form>

      {message ? <p className="notice">{message}</p> : null}

      {loan ? (
        <article className="panel" style={{ marginTop: 18 }}>
          {(() => {
            const dueDate = getLoanDueDate(loan);
            const countdown = formatDueCountdown(loan, now);
            const moneyWasSent = Boolean(loan.disbursed_at || loan.disbursement_transfer_id);

            return (
              <>
          <div className="toolbar">
            <div>
              <h2>{loan.reference}</h2>
              <p className="muted">{loan.full_name}</p>
            </div>
            <span className={`status ${loan.status}`}>{statusLabel(loan.status)}</span>
          </div>
          <div className="grid three">
            <div>
              <strong>{formatMoney(loan.amount)}</strong>
              <p className="muted">{t("requested")}</p>
            </div>
            <div>
              <strong>{formatMoney(loan.repayment)}</strong>
              <p className="muted">{t("repayment")}</p>
            </div>
            <div>
              <strong>{dueDate ? dueDate.toLocaleDateString() : t("dueDatePending")}</strong>
              <p className="muted">{t("dueDate")}</p>
            </div>
            <div>
              <strong>{loan.repayment_days ?? "?"} {t("dayUnit")}</strong>
              <p className="muted">
                {loan.interest_rate != null ? `${Math.round(loan.interest_rate * 100)}% ${t("interest").toLowerCase()}` : t("repaymentPeriod")}
              </p>
            </div>
            <div>
              <strong>{getDestinationLabel(loan.destination_country, t)}</strong>
              <p className="muted">
                {loan.currency ?? t("currency")} · {getPayoutMethodLabel(loan.payout_method, t)}
              </p>
              <p className="muted">{formatPayoutDetails(loan.payout_details, t)}</p>
            </div>
          </div>
          <div className="loan-status-actions">
            {loan.status === "approved" ? (
              <div className={`loan-alert ${moneyWasSent ? "success" : "pending"} funding-alert`}>
                <strong>{moneyWasSent ? t("moneySentNotice") : t("approvedWaitingFunds")}</strong>
                {loan.disbursement_transfer_id ? (
                  <span>
                    {t("moneySentTransferId")}: {loan.disbursement_transfer_id}
                  </span>
                ) : null}
                {loan.disbursed_at ? (
                  <span>
                    {t("moneySentAt")}: {new Date(loan.disbursed_at).toLocaleString()}
                  </span>
                ) : null}
                <span>
                  {t("dueDate")}: {dueDate ? dueDate.toLocaleDateString() : t("dueDatePending")}
                </span>
                {moneyWasSent && dueDate ? (
                  <span>
                    {countdown.state === "late" ? t("pastDueBy") : t("countdown")}: {countdown.text}
                  </span>
                ) : null}
              </div>
            ) : null}

            {loan.status === "approved" ? (
              <div className="loan-payment-box">
                <strong>{t("payLoan")}</strong>
                <span className="muted">
                  {t("payLoanBody")}: {formatMoney(loan.repayment)}
                </span>
                {loan.repayment_transfer_id ? (
                  <div className={`loan-alert ${loan.repayment_review_status === "rejected" ? "rejected" : "pending"}`}>
                    <strong>{t("repaymentSubmittedNotice")}</strong>
                    <span>
                      {t("repaymentAmount")}: {formatMoney(loan.repayment_submitted_amount || 0)}
                    </span>
                    <span>
                      {t("repaymentTransferId")}: {loan.repayment_transfer_id}
                    </span>
                    {loan.repayment_review_status === "rejected" ? <span>{t("repaymentRejectedNotice")}</span> : null}
                  </div>
                ) : null}
                {userId === loan.user_id ? (
                  <>
                    <input
                      className="compact-input"
                      disabled={Boolean(loan.repayment_transfer_id)}
                      min="0"
                      onChange={(event) => setRepaymentAmount(event.target.value)}
                      placeholder={t("repaymentAmount")}
                      step="0.01"
                      type="number"
                      value={repaymentAmount}
                    />
                    <input
                      className="compact-input"
                      disabled={Boolean(loan.repayment_transfer_id)}
                      onChange={(event) => setRepaymentTransferId(event.target.value)}
                      placeholder={t("repaymentTransferId")}
                      value={repaymentTransferId}
                    />
                    {!loan.repayment_transfer_id ? (
                      <button className="compact success" disabled={loading} onClick={submitRepayment} type="button">
                        {t("submitPaymentId")}
                      </button>
                    ) : null}
                    {loan.repayment_review_status === "rejected" ? (
                      <>
                        <label>
                          {t("repaymentScreenshot")}
                          <input accept="image/*" onChange={(event) => setRepaymentScreenshot(event.target.files?.[0] || null)} type="file" />
                        </label>
                        <button className="compact success" disabled={loading} onClick={submitRepayment} type="button">
                          {t("submitRepaymentScreenshot")}
                        </button>
                      </>
                    ) : null}
                  </>
                ) : (
                  <Link className="button compact" href="/login">
                    {t("loginToPayLoan")}
                  </Link>
                )}
              </div>
            ) : null}
          </div>
              </>
            );
          })()}
        </article>
      ) : null}
    </section>
  );
}

export default function RequestStatusPage() {
  return (
    <Suspense fallback={<RequestStatusFallback />}>
      <RequestStatusContent />
    </Suspense>
  );
}

function RequestStatusFallback() {
  const { t } = useLanguage();

  return (
    <section className="page">
      <p className="notice">{t("loadingTracker")}</p>
    </section>
  );
}
