"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { calculateInterest, calculateRepayment, generateReference, getRepaymentOption, repaymentOptions, RepaymentDays } from "@/lib/loans";
import { DestinationCountry, getCountryOption, PayoutMethod, validateHaitiPayoutPhone } from "@/lib/payout";
import { supabase } from "@/lib/supabase";

export default function RequestLoanPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [step, setStep] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
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
  const [idPhoto, setIdPhoto] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [selfieWithId, setSelfieWithId] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const numericAmount = Number(amount);
  const selectedCountry = getCountryOption(destinationCountry);
  const selectedRepayment = getRepaymentOption(repaymentDays);
  const repayment = useMemo(() => calculateRepayment(numericAmount || 0, repaymentDays), [numericAmount, repaymentDays]);
  const interest = useMemo(() => calculateInterest(numericAmount || 0, repaymentDays), [numericAmount, repaymentDays]);
  const steps = [t("basicInfo"), t("loanInfo"), t("verification"), t("submitRequest")];

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push("/login");
        return;
      }

      setUserId(data.user.id);
    });
  }, [router]);

  function canContinue() {
    if (step === 0) return fullName.trim() && phone.trim();
    if (step === 1) {
      if (numericAmount <= 0) return false;
      if (destinationCountry === "haiti") return haitiAccountName.trim() && mobileNumber.trim() && !validateHaitiPayoutPhone(payoutMethod, mobileNumber);
      if (destinationCountry === "usa") return receiver.trim();
      return bankName.trim() && accountName.trim() && clabe.trim();
    }
    if (step === 2) return idPhoto && selfie && selfieWithId;
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

  async function uploadLoanFile(file: File, reference: string, type: string) {
    if (!userId) throw new Error("You must be logged in.");

    const extension = file.name.split(".").pop() || "jpg";
    const path = `${userId}/${reference}/${type}.${extension}`;
    const { error } = await supabase.storage.from("selfies").upload(path, file, { upsert: true });

    if (error) throw error;

    return path;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || !idPhoto || !selfie || !selfieWithId) return;

    setLoading(true);
    setMessage("");

    try {
      const reference = generateReference();
      const [idPhotoUrl, selfieUrl, selfieWithIdUrl] = await Promise.all([
        uploadLoanFile(idPhoto, reference, "id-photo"),
        uploadLoanFile(selfie, reference, "selfie"),
        uploadLoanFile(selfieWithId, reference, "selfie-with-id")
      ]);

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + repaymentDays);
      const phoneError = destinationCountry === "haiti" ? validateHaitiPayoutPhone(payoutMethod, mobileNumber) : "";
      if (phoneError) throw new Error(phoneError);

      const { error } = await supabase.from("loans").insert({
        user_id: userId,
        full_name: fullName.trim(),
        phone: phone.trim(),
        amount: numericAmount,
        repayment,
        destination_country: selectedCountry.label,
        currency: selectedCountry.currency,
        payout_method: payoutMethod,
        payout_details: buildPayoutDetails(),
        repayment_days: repaymentDays,
        interest_rate: selectedRepayment.rate,
        reference,
        status: "pending",
        id_photo_url: idPhotoUrl,
        selfie_url: selfieUrl,
        selfie_with_id_url: selfieWithIdUrl,
        due_date: dueDate.toISOString()
      });

      if (error) throw error;

      router.push(`/request-status?reference=${encodeURIComponent(reference)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not submit loan request.");
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
                    {option.label} · {option.percentLabel} interest
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("destinationCountry")}
              <select value={destinationCountry} onChange={(event) => updateDestinationCountry(event.target.value as DestinationCountry)}>
                <option value="haiti">Haiti</option>
                <option value="usa">USA</option>
                <option value="mexico">Mexico</option>
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
                    {method.label}
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
                  {t("haitiPhoneHelp")} {mobileNumber ? validateHaitiPayoutPhone(payoutMethod, mobileNumber) : ""}
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
              {repaymentDays} days
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <label>
              {t("idPhoto")}
              <input accept="image/*" type="file" onChange={(event) => setIdPhoto(event.target.files?.[0] ?? null)} required />
            </label>
            <label>
              {t("selfie")}
              <input accept="image/*" type="file" onChange={(event) => setSelfie(event.target.files?.[0] ?? null)} required />
            </label>
            <label>
              {t("selfieWithId")}
              <input accept="image/*" type="file" onChange={(event) => setSelfieWithId(event.target.files?.[0] ?? null)} required />
            </label>
          </>
        ) : null}

        {step === 3 ? (
          <div className="notice">
            <strong>{fullName}</strong> · ${numericAmount.toFixed(2)} · {repaymentDays} days ·{" "}
            {selectedRepayment.percentLabel} {t("interest")} · {selectedCountry.label} ({selectedCountry.currency}) ·{" "}
            {t("totalPayback")}: ${repayment.toFixed(2)}.
          </div>
        ) : null}

        {message ? <p className="notice">{message}</p> : null}

        <div className="actions">
          {step > 0 ? (
            <button className="secondary" type="button" onClick={() => setStep((value) => value - 1)}>
              {t("back")}
            </button>
          ) : null}
          {step < 3 ? (
            <button disabled={!canContinue()} type="button" onClick={() => setStep((value) => value + 1)}>
              {t("continue")}
            </button>
          ) : (
            <button disabled={loading}>{loading ? t("submitting") : t("submitRequest")}</button>
          )}
          <Link className="button secondary" href="/dashboard">
            {t("myLoans")}
          </Link>
        </div>
      </form>
    </section>
  );
}
