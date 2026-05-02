"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { getAgreementVersion } from "@/lib/agreement";
import { calculateInterest, calculateRepayment, generateReference, getRepaymentOption, repaymentOptions, RepaymentDays } from "@/lib/loans";
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
  const repayment = useMemo(() => calculateRepayment(numericAmount || 0, repaymentDays), [numericAmount, repaymentDays]);
  const interest = useMemo(() => calculateInterest(numericAmount || 0, repaymentDays), [numericAmount, repaymentDays]);
  const steps = [t("basicInfo"), t("loanInfo"), t("submitRequest")];

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.push("/login");
        return;
      }

      setUserId(data.user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("verification_status")
        .eq("id", data.user.id)
        .maybeSingle();

      const nextStatus = (profile?.verification_status || "not_submitted") as VerificationStatus;
      setVerificationStatus(nextStatus);

      if (nextStatus === "not_submitted" || nextStatus === "rejected") {
        router.push("/verify-identity");
      }
    });
  }, [router]);

  function canContinue() {
    if (step === 0) return fullName.trim() && phone.trim();
    if (step === 1) {
      if (numericAmount <= 0) return false;
      if (destinationCountry === "haiti") return haitiAccountName.trim() && mobileNumber.trim() && !validateHaitiPayoutPhone(payoutMethod, mobileNumber, t);
      if (destinationCountry === "usa") return receiver.trim();
      return bankName.trim() && accountName.trim() && clabe.trim();
    }
    return true;
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
    if (!userId) return;

    setLoading(true);
    setMessage("");

    try {
      const reference = generateReference();

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + repaymentDays);
      const phoneError = destinationCountry === "haiti" ? validateHaitiPayoutPhone(payoutMethod, mobileNumber, t) : "";
      if (phoneError) throw new Error(phoneError);
      if (verificationStatus === "not_submitted" || verificationStatus === "rejected") throw new Error(t("verifyBeforeLoan"));
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
        interest_rate: selectedRepayment.rate,
        reference,
        status: "pending",
        terms_accepted: true,
        terms_accepted_at: new Date().toISOString(),
        agreement_version: getAgreementVersion(),
        credit_reporting_acknowledged: true,
        public_story_consent: false,
        due_date: dueDate.toISOString()
      });

      if (error) throw error;

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
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} required />
            </label>
            <label>
              {t("phoneNumber")}
              <input value={phone} onChange={(event) => setPhone(event.target.value)} required />
            </label>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <label>
              {t("loanAmount")}
              <input
                min="1"
                step="0.01"
                type="number"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
            </label>
            <label>
              {t("repaymentPeriod")}
              <select value={repaymentDays} onChange={(event) => setRepaymentDays(Number(event.target.value) as RepaymentDays)}>
                {repaymentOptions.map((option) => (
                  <option key={option.days} value={option.days}>
                    {option.days} {t("dayUnit")} · {option.percentLabel} {t("interest").toLowerCase()}
                  </option>
                ))}
              </select>
            </label>
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
              {t("interest")}: ${interest.toFixed(2)} · {t("totalPayback")}: ${repayment.toFixed(2)} · {t("dueIn")}{" "}
              {repaymentDays} {t("dayUnit")}
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div className="notice">
              <strong>{fullName}</strong> · ${numericAmount.toFixed(2)} · {repaymentDays} {t("dayUnit")} ·{" "}
              {selectedRepayment.percentLabel} {t("interest").toLowerCase()} · {t(selectedCountry.labelKey)} ({selectedCountry.currency}) ·{" "}
              {t("totalPayback")}: ${repayment.toFixed(2)}.
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
            <button disabled={loading || !termsAccepted || !creditReportingAcknowledged || !lawfulRecoveryAcknowledged}>
              {loading ? t("submitting") : t("submitRequest")}
            </button>
          )}
          <Link className="button secondary" href="/dashboard">
            {t("myLoans")}
          </Link>
        </div>
      </form>
    </section>
  );
}
