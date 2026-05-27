"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { getAgreementVersion } from "@/lib/agreement";
import { getCurrentUser } from "@/lib/auth";
import { calculateCreditProfile, formatCreditMoney } from "@/lib/credit";
import { notifyAdmins } from "@/lib/notifications";
import {
  calculateInterest,
  calculateRepayment,
  countPriorSecurityLoans,
  generateReference,
  getAdjustedInterestRate,
  getRepaymentOption,
  getSecurityRateAdjustment,
  repaymentOptions,
  RepaymentDays,
  Loan
} from "@/lib/loans";
import { DestinationCountry, getCountryOption, PayoutMethod, validateHaitiPayoutPhone } from "@/lib/payout";
import { supabase } from "@/lib/supabase";

type SupabaseLikeError = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
};

type VerificationStatus = "not_submitted" | "pending" | "verified" | "rejected";

export default function RequestLoanPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [step, setStep] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>("not_submitted");
  const [loanHistory, setLoanHistory] = useState<Loan[]>([]);
  const [hasActiveLoan, setHasActiveLoan] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [destinationCountry, setDestinationCountry] = useState<DestinationCountry>("haiti");
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>("moncash");
  const [mobileNumber, setMobileNumber] = useState("");
  const [haitiAccountName, setHaitiAccountName] = useState("");
  const [receiver, setReceiver] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [clabe, setClabe] = useState("");
  const [repaymentDays, setRepaymentDays] = useState<RepaymentDays>(7);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [creditReportingAcknowledged, setCreditReportingAcknowledged] = useState(false);
  const [lawfulRecoveryAcknowledged, setLawfulRecoveryAcknowledged] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const numericAmount = Number(amount);
  const selectedCountry = getCountryOption(destinationCountry);
  const selectedRepayment = getRepaymentOption(repaymentDays);
  const creditProfile = calculateCreditProfile(loanHistory, destinationCountry);
  const creditLimit = creditProfile.currentLimit;
  const creditScore = creditProfile.score;
  const previousLoanCount = countPriorSecurityLoans(loanHistory);
  const adjustedInterestRate = getAdjustedInterestRate(repaymentDays, previousLoanCount);
  const securityRateAdjustment = getSecurityRateAdjustment(previousLoanCount);
  const repayment = useMemo(() => calculateRepayment(numericAmount || 0, repaymentDays, previousLoanCount), [numericAmount, repaymentDays, previousLoanCount]);
  const interest = useMemo(() => calculateInterest(numericAmount || 0, repaymentDays, previousLoanCount), [numericAmount, repaymentDays, previousLoanCount]);
  const steps = [t("basicInfo"), t("loanInfo"), t("submitRequest")];

  async function findCooldownUntil(nextUserId: string) {
    const { data, error } = await supabase
      .from("loans")
      .select("*")
      .eq("user_id", nextUserId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return null;
    const creditProfile = calculateCreditProfile((data || []) as Loan[], "haiti");
    return creditProfile.isInPenalty ? creditProfile.penaltyUntil : null;
  }

  useEffect(() => {
    async function loadProfileStatus() {
      const user = await getCurrentUser();
      if (!user) {
        router.push("/login");
        return;
      }

      setUserId(user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, country, phone, verification_status")
        .eq("id", user.id)
        .maybeSingle();

      setFullName(profile?.full_name || "");
      setPhone(profile?.phone || "");
      const nextStatus = (profile?.verification_status || "not_submitted") as VerificationStatus;
      setVerificationStatus(nextStatus);
      const isProfileComplete = Boolean(profile?.full_name?.trim() && profile?.country?.trim() && profile?.phone?.trim());
      const { data: activeLoan } = await supabase
        .from("loans")
        .select("id, reference")
        .eq("user_id", user.id)
        .in("status", ["pending", "approved"])
        .limit(1)
        .maybeSingle();
      const { data: history } = await supabase
        .from("loans")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setLoanHistory((history || []) as Loan[]);
      const nextCooldownUntil = await findCooldownUntil(user.id);

      if (!isProfileComplete) {
        router.push("/profile");
        return;
      }

      if (nextStatus !== "verified") {
        router.push("/verify-identity");
        return;
      }

      if (activeLoan) {
        setHasActiveLoan(true);
        setMessage(t("activeLoanExists"));
      } else {
        setHasActiveLoan(false);
      }

      if (nextCooldownUntil) {
        setCooldownUntil(nextCooldownUntil);
        setMessage(t("badCreditCooldown").replace("{date}", new Date(nextCooldownUntil).toLocaleDateString()));
      } else {
        setCooldownUntil(null);
      }
    }

    loadProfileStatus();
  }, [router, t]);

  function canContinue() {
    if (step === 0) return fullName.trim() && phone.trim() && verificationStatus === "verified" && !hasActiveLoan && !cooldownUntil;
    if (step === 1) {
      if (numericAmount <= 0) return false;
      if (numericAmount > creditLimit) return false;
      if (destinationCountry === "haiti") return haitiAccountName.trim() && mobileNumber.trim() && !validateHaitiPayoutPhone(payoutMethod, mobileNumber, t);
      if (destinationCountry === "usa") return receiver.trim();
      return bankName.trim() && accountName.trim() && clabe.trim();
    }
    return true;
  }

  function isLoanInfoComplete() {
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return false;
    if (numericAmount > creditLimit) return false;
    if (!repaymentDays || !selectedRepayment) return false;
    if (!destinationCountry || !selectedCountry || !payoutMethod) return false;

    if (destinationCountry === "haiti") {
      return Boolean(
        haitiAccountName.trim() &&
          mobileNumber.trim() &&
          !validateHaitiPayoutPhone(payoutMethod, mobileNumber, t)
      );
    }

    if (destinationCountry === "usa") return Boolean(receiver.trim());
    if (destinationCountry === "mexico") return Boolean(bankName.trim() && accountName.trim() && clabe.trim());
    return false;
  }

  function isRequestComplete() {
    return Boolean(
      userId &&
        fullName.trim() &&
        phone.trim() &&
        verificationStatus === "verified" &&
        !hasActiveLoan &&
        !cooldownUntil &&
        isLoanInfoComplete() &&
        termsAccepted &&
        creditReportingAcknowledged &&
        lawfulRecoveryAcknowledged
    );
  }

  function updateDestinationCountry(country: DestinationCountry) {
    const nextCountry = getCountryOption(country);
    setDestinationCountry(country);
    setPayoutMethod(nextCountry.methods[0].value);
    setMobileNumber("");
    setHaitiAccountName("");
    setReceiver("");
    setBankName("");
    setAccountName("");
    setClabe("");
  }

  function buildPayoutDetails() {
    if (destinationCountry === "haiti") {
      return { account_name: haitiAccountName.trim(), mobile_number: mobileNumber.trim() };
    }

    if (destinationCountry === "usa") {
      return { receiver: receiver.trim() };
    }

    return {
      bank_name: bankName.trim(),
      account_name: accountName.trim(),
      clabe: clabe.trim()
    };
  }

  function formatSubmitError(error: unknown) {
    if (!error || typeof error !== "object") return t("submitLoanError");

    const supabaseError = error as SupabaseLikeError;
    return [supabaseError.message, supabaseError.details, supabaseError.hint, supabaseError.code]
      .filter(Boolean)
      .join(" ");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) {
      setMessage(t("useLoginFirst"));
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const reference = generateReference();

      const phoneError = destinationCountry === "haiti" ? validateHaitiPayoutPhone(payoutMethod, mobileNumber, t) : "";
      if (phoneError) throw new Error(phoneError);
      if (!isLoanInfoComplete()) throw new Error(t("incompleteLoanRequest"));
      if (numericAmount > creditLimit) throw new Error(t("loanAmountAboveLimit").replace("{amount}", formatCreditMoney(creditLimit, destinationCountry)));
      const { data: activeLoan } = await supabase
        .from("loans")
        .select("id")
        .eq("user_id", userId)
        .in("status", ["pending", "approved"])
        .limit(1)
        .maybeSingle();
      if (activeLoan) throw new Error(t("activeLoanExists"));
      const nextCooldownUntil = await findCooldownUntil(userId);
      if (nextCooldownUntil) throw new Error(t("badCreditCooldown").replace("{date}", new Date(nextCooldownUntil).toLocaleDateString()));
      if (!fullName.trim() || !phone.trim()) throw new Error(t("profileRequiredFields"));
      if (verificationStatus !== "verified") throw new Error(t("verifyBeforeLoan"));
      if (!termsAccepted || !creditReportingAcknowledged || !lawfulRecoveryAcknowledged) throw new Error(t("agreementRequired"));

      const { error } = await supabase.from("loans").insert({
        user_id: userId,
        full_name: fullName.trim(),
        phone: phone.trim(),
        amount: numericAmount,
        repayment,
        destination_country: selectedCountry.value,
        currency: selectedCountry.currency,
        payout_method: payoutMethod,
        payout_details: buildPayoutDetails(),
        repayment_days: repaymentDays,
        interest_rate: adjustedInterestRate,
        reference,
        status: "pending",
        terms_accepted: true,
        terms_accepted_at: new Date().toISOString(),
        agreement_version: getAgreementVersion(),
        credit_reporting_acknowledged: true,
        public_story_consent: false
      });

      if (error) throw error;

      await notifyAdmins(t("notificationLoanRequestedTitle"), `${fullName.trim()} · ${formatCreditMoney(numericAmount, destinationCountry)} · ${reference}`, "/admin");

      router.push(`/request-status?reference=${encodeURIComponent(reference)}`);
    } catch (error) {
      setMessage(formatSubmitError(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="page">
      <form className="panel form" onSubmit={submit}>
        <h1>{t("requestLoan")}</h1>
        <div className="stepper">
          {steps.map((label, index) => (
            <div className={`step ${index === step ? "active" : ""}`} key={label}>
              {label}
            </div>
          ))}
        </div>

        {step === 0 ? (
          <>
            <label>
              {t("fullName")}
              <input readOnly value={fullName} required />
            </label>
            <label>
              {t("phoneNumber")}
              <input readOnly value={phone} required />
            </label>
            <p className="muted">
              {t("accountInfoAutoFilled")}{" "}
              <Link href="/profile">{t("profile")}</Link>
            </p>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <label>
              {t("loanAmount")}
              <input
                inputMode="decimal"
                min="1"
                pattern="[0-9]*[.,]?[0-9]*"
                step="0.01"
                type="text"
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(",", "."))}
                required
              />
            </label>
            <div className="notice credit-limit-notice">
              <strong>{t("creditScore")}: {creditScore}</strong>
              <span>
                {t("currentCreditLimit")}: {formatCreditMoney(creditLimit, destinationCountry)}
              </span>
              <span>
                {t("onTimeNextLimit")}: {formatCreditMoney(creditProfile.onTimeLimit, destinationCountry)} · {t("earlyNextLimit")}:{" "}
                {formatCreditMoney(creditProfile.earlyLimit, destinationCountry)}
              </span>
              {creditProfile.isInPenalty && creditProfile.penaltyUntil ? (
                <span>{t("badCreditCooldown").replace("{date}", new Date(creditProfile.penaltyUntil).toLocaleDateString())}</span>
              ) : null}
              {numericAmount > creditLimit ? <span>{t("loanAmountAboveLimit").replace("{amount}", formatCreditMoney(creditLimit, destinationCountry))}</span> : null}
            </div>
            <label>
              {t("repaymentPeriod")}
              <select value={repaymentDays} onChange={(event) => setRepaymentDays(Number(event.target.value) as RepaymentDays)}>
                {repaymentOptions.map((option) => (
                  <option key={option.days} value={option.days}>
                    {option.days} {t("dayUnit")} · {Math.round(getAdjustedInterestRate(option.days, previousLoanCount) * 100)}%{" "}
                    {t("interest").toLowerCase()}
                  </option>
                ))}
              </select>
            </label>
            <div className="notice">
              {t("securityInterestNotice")
                .replace("{loanNumber}", String(previousLoanCount + 1))
                .replace("{extra}", `${Math.round(securityRateAdjustment * 100)}%`)
                .replace("{rate}", `${Math.round(adjustedInterestRate * 100)}%`)}
            </div>
            <label>
              {t("destinationCountry")}
              <select value={destinationCountry} onChange={(event) => updateDestinationCountry(event.target.value as DestinationCountry)}>
                <option value="haiti">{t("countryHaiti")}</option>
                <option value="usa">{t("countryUsa")}</option>
                <option value="mexico">{t("countryMexico")}</option>
              </select>
            </label>
            <label>
              {t("currency")}
              <input value={selectedCountry.currency} readOnly />
            </label>
            <label>
              {t("payoutMethod")}
              <select value={payoutMethod} onChange={(event) => setPayoutMethod(event.target.value as PayoutMethod)}>
                {selectedCountry.methods.map((method) => (
                  <option key={method.value} value={method.value}>
                    {t(method.labelKey)}
                  </option>
                ))}
              </select>
            </label>
            {destinationCountry === "haiti" ? (
              <>
                <label>
                  {t("haitiAccountName")}
                  <input value={haitiAccountName} onChange={(event) => setHaitiAccountName(event.target.value)} required />
                </label>
                <label>
                  {t("haitiMobileNumber")}
                  <input value={mobileNumber} onChange={(event) => setMobileNumber(event.target.value)} required />
                </label>
                <p className="notice">
                  {t("haitiPhoneHelp")} {mobileNumber ? validateHaitiPayoutPhone(payoutMethod, mobileNumber, t) : ""}
                </p>
              </>
            ) : null}
            {destinationCountry === "usa" ? (
              <label>
                {t("usaReceiver")}
                <input value={receiver} onChange={(event) => setReceiver(event.target.value)} required />
              </label>
            ) : null}
            {destinationCountry === "mexico" ? (
              <>
                <label>
                  {t("mexicoBankName")}
                  <input value={bankName} onChange={(event) => setBankName(event.target.value)} required />
                </label>
                <label>
                  {t("mexicoAccountName")}
                  <input value={accountName} onChange={(event) => setAccountName(event.target.value)} required />
                </label>
                <label>
                  {t("mexicoClabe")}
                  <input value={clabe} onChange={(event) => setClabe(event.target.value)} required />
                </label>
              </>
            ) : null}
            <div className="notice">
              {t("interest")}: {formatCreditMoney(interest, destinationCountry)} · {t("totalPayback")}: {formatCreditMoney(repayment, destinationCountry)} ·{" "}
              {t("dueIn")} {repaymentDays} {t("dayUnit")}
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div className="notice">
              <strong>{fullName}</strong> · {formatCreditMoney(numericAmount, destinationCountry)} · {repaymentDays} {t("dayUnit")} ·{" "}
              {Math.round(adjustedInterestRate * 100)}% {t("interest").toLowerCase()} · {t(selectedCountry.labelKey)} ({selectedCountry.currency}) ·{" "}
              {t("totalPayback")}: {formatCreditMoney(repayment, destinationCountry)}.
            </div>

            <div className="agreement-box">
              <label className="checkbox-row">
                <input checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} type="checkbox" />
                <span>{t("acceptLoanTerms")}</span>
              </label>
              <label className="checkbox-row">
                <input
                  checked={creditReportingAcknowledged}
                  onChange={(event) => setCreditReportingAcknowledged(event.target.checked)}
                  type="checkbox"
                />
                <span>{t("acceptCreditReporting")}</span>
              </label>
              <label className="checkbox-row">
                <input
                  checked={lawfulRecoveryAcknowledged}
                  onChange={(event) => setLawfulRecoveryAcknowledged(event.target.checked)}
                  type="checkbox"
                />
                <span>{t("acceptLawfulRecovery")}</span>
              </label>
              <p className="muted">{t("publicStoryConsentHelp")}</p>
              {!termsAccepted || !creditReportingAcknowledged || !lawfulRecoveryAcknowledged ? (
                <p className="muted">{t("requiredAgreementHelp")}</p>
              ) : null}
            </div>
          </>
        ) : null}

        {message ? <p className="notice">{message}</p> : null}

        <div className="actions">
          {step > 0 ? (
            <button className="secondary" type="button" onClick={() => setStep((value) => value - 1)}>
              {t("back")}
            </button>
          ) : null}
          {step < 2 ? (
            <button disabled={!canContinue()} type="button" onClick={() => setStep((value) => value + 1)}>
              {t("continue")}
            </button>
          ) : (
            <button disabled={loading || !isRequestComplete()}>{loading ? t("submitting") : t("submitRequest")}</button>
          )}
          <Link className="button secondary" href="/dashboard">
            {t("myLoans")}
          </Link>
        </div>
      </form>
    </section>
  );
}
