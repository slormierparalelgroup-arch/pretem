"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { downloadLoanAgreement } from "@/lib/agreement";
import { getCurrentUser } from "@/lib/auth";
import { calculateCreditProfile, canRequestRepaymentPause, formatCreditMoney, getRepaymentOutcome } from "@/lib/credit";
import { formatDueCountdown, formatMoney, getFlexibleRepaymentTerms, getLoanDueDate, Loan, LoanStatus } from "@/lib/loans";
import { notifyAdmins } from "@/lib/notifications";
import { getDestinationLabel, getPayoutMethodLabel } from "@/lib/payout";
import { getRepaymentInstructions } from "@/lib/repayment";
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
  credit_score: number | null;
};

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [profile, setProfile] = useState<ProfileStatus | null>(null);
  const [status, setStatus] = useState<"all" | LoanStatus>("all");
  const [repaymentIds, setRepaymentIds] = useState<Record<string, string>>({});
  const [repaymentAmounts, setRepaymentAmounts] = useState<Record<string, string>>({});
  const [repaymentScreenshots, setRepaymentScreenshots] = useState<Record<string, File | null>>({});
  const [pauseDays, setPauseDays] = useState<Record<string, string>>({});
  const [pauseReasons, setPauseReasons] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [openCreditDetail, setOpenCreditDetail] = useState<string | null>(null);

  const filteredLoans = useMemo(() => {
    if (status === "all") return loans;
    return loans.filter((loan) => loan.status === status);
  }, [loans, status]);

  useEffect(() => {
    loadLoans();
    const timer = window.setInterval(() => setNow(new Date()), 60 * 1000);
    return () => window.clearInterval(timer);
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
      supabase.from("profiles").select("email, full_name, phone, country, verification_status, verified_at, credit_score").eq("id", user.id).maybeSingle()
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
    const transferId = (repaymentIds[loan.id] || loan.repayment_transfer_id || "").trim();
    const flexibleTerms = getFlexibleRepaymentTerms(loan, now);
    const paymentAmount = Number(repaymentAmounts[loan.id] || loan.repayment_submitted_amount || flexibleTerms.repayment);
    if (!transferId) {
      setMessage(t("transferIdRequired"));
      return;
    }
    if (Math.abs(Number(paymentAmount.toFixed(2)) - Number(Number(flexibleTerms.repayment).toFixed(2))) > 0.01) {
      setMessage(t("repaymentAmountMismatch"));
      return;
    }

    setMessage("");
    let screenshotPath = loan.repayment_screenshot_url || null;
    const screenshot = repaymentScreenshots[loan.id];
    if (screenshot) {
      const extension = screenshot.name.split(".").pop() || "jpg";
      screenshotPath = `${loan.user_id}/repayments/${loan.id}-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("selfies").upload(screenshotPath, screenshot, { upsert: true });
      if (uploadError) {
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
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(t("repaymentSubmitted"));
    await notifyAdmins(t("notificationRepaymentSubmittedTitle"), `${loan.reference} · ${formatMoney(paymentAmount)}`, "/admin");
    await loadLoans();
  }

  async function requestPause(loan: Loan) {
    const requestedDays = Number(pauseDays[loan.id] || loan.repayment_pause_requested_days || 7);
    if (requestedDays < 1 || requestedDays > 14) {
      setMessage(t("pauseDaysError"));
      return;
    }

    setMessage("");
    const { error } = await supabase.rpc("request_repayment_pause", {
      loan_id: loan.id,
      pause_reason: pauseReasons[loan.id] || "",
      requested_days: requestedDays
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(t("pauseRequestSubmitted"));
    await notifyAdmins(t("notificationPauseRequestedTitle"), `${loan.reference} · ${requestedDays} ${t("dayUnit")}`, "/admin");
    await loadLoans();
  }

  function statusLabel(nextStatus: LoanStatus) {
    return t(`status${nextStatus.charAt(0).toUpperCase()}${nextStatus.slice(1)}`);
  }

  function filterLabel(nextStatus: "all" | LoanStatus) {
    return nextStatus === "all" ? t("allStatuses") : statusLabel(nextStatus);
  }

  function firstName() {
    return (profile?.full_name || "").trim().split(/\s+/)[0] || t("user");
  }

  function paymentResult(loan: Loan, countdown: ReturnType<typeof formatDueCountdown>) {
    const outcome = getRepaymentOutcome(loan);
    if (outcome === "early") return { className: "early", label: t("paidEarly") };
    if (outcome === "on_time") return { className: "on-time", label: t("paidOnTime") };
    if (outcome === "late") return { className: "late", label: t("paidLate") };
    if (outcome === "bad" || loan.status === "rejected") return { className: "late", label: t("notPaid") };
    if (loan.status === "approved" && countdown.state === "late") return { className: "late", label: t("notPaid") };
    return null;
  }

  const creditProfile = calculateCreditProfile(loans, profile?.country || "haiti", now);
  const creditScore = creditProfile.score;
  const activeLoan = loans.find((loan) => loan.status === "approved" || loan.status === "pending");
  const activeLoanDueDate = activeLoan ? getLoanDueDate(activeLoan) : null;
  const activeLoanCountdown = activeLoan ? formatDueCountdown(activeLoan, now) : null;
  const creditDetails: Record<string, string> = profile
    ? {
        score: String(creditScore),
        line: t("nextCreditAmount").replace("{amount}", formatCreditMoney(creditProfile.currentLimit, profile.country)),
        onTime: t("onTimeRule")
          .replace("{count}", String(creditProfile.onTimeCreditsUntilIncrease))
          .replace("{amount}", formatCreditMoney(creditProfile.onTimeLimit, profile.country)),
        early: t("earlyRule")
          .replace("{count}", String(creditProfile.earlyCreditsUntilIncrease))
          .replace("{amount}", formatCreditMoney(creditProfile.earlyLimit, profile.country))
      }
    : {};

  function toggleCreditDetail(key: string) {
    setOpenCreditDetail((current) => (current === key ? null : key));
  }

  return (
    <section className="page">
      <div className="toolbar">
        <div>
          <h1>{t("hiUser").replace("{name}", firstName())}</h1>
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
        <div className="credit-summary-grid dashboard-credit-grid">
          <button className="credit-summary-card" onClick={() => toggleCreditDetail("score")} type="button">
            <span>{t("creditScore")}</span>
            <strong>{creditScore}</strong>
            {openCreditDetail === "score" ? <p>{creditDetails.score}</p> : null}
          </button>
          <button className="credit-summary-card" onClick={() => toggleCreditDetail("line")} type="button">
            <span>{t("currentCreditLimit")}</span>
            <strong>{formatCreditMoney(creditProfile.currentLimit, profile.country)}</strong>
            {openCreditDetail === "line" ? <p>{creditDetails.line}</p> : null}
          </button>
          <button className="credit-summary-card" onClick={() => toggleCreditDetail("onTime")} type="button">
            <span>{t("onTimeNextLimit")}</span>
            <strong>{formatCreditMoney(creditProfile.onTimeLimit, profile.country)}</strong>
            {openCreditDetail === "onTime" ? <p>{creditDetails.onTime}</p> : null}
          </button>
          <button className="credit-summary-card" onClick={() => toggleCreditDetail("early")} type="button">
            <span>{t("earlyNextLimit")}</span>
            <strong>{formatCreditMoney(creditProfile.earlyLimit, profile.country)}</strong>
            {openCreditDetail === "early" ? <p>{creditDetails.early}</p> : null}
          </button>
        </div>
      ) : null}

      {activeLoan ? (
        <div className={`notice active-loan-notice ${activeLoan.status}`}>
          <div>
            <strong>{t("activeLoanExists")}</strong>
            <p>
              {activeLoan.reference} · {formatMoney(activeLoan.amount)} · {statusLabel(activeLoan.status)}
            </p>
            <p>
              {t("dueDate")}: {activeLoanDueDate ? activeLoanDueDate.toLocaleDateString() : t("dueDatePending")}
              {activeLoanCountdown && activeLoan.disbursed_at ? (
                <>
                  {" "}
                  · {activeLoanCountdown.state === "late" ? t("pastDueBy") : t("countdown")}: {activeLoanCountdown.text}
                </>
              ) : null}
            </p>
          </div>
          <Link className="button compact" href={`/request-status?reference=${encodeURIComponent(activeLoan.reference)}`}>
            {t("track")}
          </Link>
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
            {(() => {
              const dueDate = getLoanDueDate(loan);
              const countdown = formatDueCountdown(loan, now);
              const flexibleTerms = getFlexibleRepaymentTerms(loan, now);
              const moneyWasSent = Boolean(loan.disbursed_at || loan.disbursement_transfer_id);
              const result = paymentResult(loan, countdown);
              const pauseAvailable = canRequestRepaymentPause(loans, loan, now);

              return (
                <>
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
              <p className="muted">
                {t("dueDate")}: {dueDate ? dueDate.toLocaleDateString() : t("dueDatePending")}
              </p>
              {result ? (
                <p className={`payment-result-pill ${result.className}`}>{result.label}</p>
              ) : loan.disbursed_at && dueDate ? (
                <p className={`countdown-pill ${countdown.state}`}>
                  {countdown.state === "late" ? t("pastDueBy") : t("countdown")}: {countdown.text}
                </p>
              ) : null}
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
                  {loan.repayment_pause_status && loan.repayment_pause_status !== "none" ? (
                    <span>
                      {t("repaymentPause")}: {t(`pauseStatus${loan.repayment_pause_status.charAt(0).toUpperCase()}${loan.repayment_pause_status.slice(1)}`)}
                    </span>
                  ) : null}
                  {loan.repayment_pause_until ? (
                    <span>
                      {t("pauseUntil")}: {new Date(loan.repayment_pause_until).toLocaleDateString()}
                    </span>
                  ) : null}
                </div>
              ) : null}
              {loan.status === "approved" && moneyWasSent ? (
                <div className="loan-payment-box">
                  {(() => {
                    const repaymentInstructions = getRepaymentInstructions(loan.destination_country, t);

                    return (
                      <div className="repayment-destination">
                        <strong>{t("repaymentDestination")}</strong>
                        <dl>
                          {repaymentInstructions.map((instruction) => (
                            <div key={instruction.label}>
                              <dt>{instruction.label}</dt>
                              <dd>{instruction.value || t("notProvided")}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    );
                  })()}
                  <strong>{t("payLoan")}</strong>
                  <span className="muted">
                    {t("payLoanBody")}: {formatMoney(flexibleTerms.repayment)}
                  </span>
                  <span className="muted">
                    {t("flexibleRepaymentNotice")
                      .replace("{days}", String(flexibleTerms.days))
                      .replace("{rate}", `${Math.round(flexibleTerms.rate * 100)}%`)}
                  </span>
                  {flexibleTerms.latePenaltyRate > 0 ? (
                    <span className="muted">
                      {t("lateDailyInterestNotice").replace("{rate}", `${(flexibleTerms.latePenaltyRate * 100).toFixed(1)}%`)}
                    </span>
                  ) : null}
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
                  <input
                    className="compact-input"
                    disabled={Boolean(loan.repayment_transfer_id)}
                    min="0"
                    onChange={(event) => setRepaymentAmounts((values) => ({ ...values, [loan.id]: event.target.value }))}
                    placeholder={t("repaymentAmount")}
                    step="0.01"
                    type="number"
                    value={repaymentAmounts[loan.id] ?? loan.repayment_submitted_amount ?? flexibleTerms.repayment}
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
                  {loan.repayment_review_status === "rejected" && !loan.repayment_screenshot_url ? (
                    <>
                      <label>
                        {t("repaymentScreenshot")}
                        <input
                          accept="image/*"
                          onChange={(event) => setRepaymentScreenshots((values) => ({ ...values, [loan.id]: event.target.files?.[0] || null }))}
                          type="file"
                        />
                      </label>
                      <button className="compact success" onClick={() => submitRepayment(loan)}>
                        {t("submitRepaymentScreenshot")}
                      </button>
                    </>
                  ) : null}
                  {pauseAvailable ? (
                    <div className="repayment-pause-box">
                      <strong>{t("requestPause")}</strong>
                      <span className="muted">{t("requestPauseBody")}</span>
                      <input
                        className="compact-input"
                        max="14"
                        min="1"
                        onChange={(event) => setPauseDays((values) => ({ ...values, [loan.id]: event.target.value }))}
                        placeholder={t("pauseDays")}
                        type="number"
                        value={pauseDays[loan.id] ?? "7"}
                      />
                      <textarea
                        onChange={(event) => setPauseReasons((values) => ({ ...values, [loan.id]: event.target.value }))}
                        placeholder={t("pauseReason")}
                        value={pauseReasons[loan.id] ?? ""}
                      />
                      <button className="secondary compact" onClick={() => requestPause(loan)}>
                        {t("submitPauseRequest")}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
                </>
              );
            })()}
          </article>
        ))}
      </div>
    </section>
  );
}
