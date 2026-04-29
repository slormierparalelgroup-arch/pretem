"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { calculateInterest, calculateRepayment, generateReference, getRepaymentOption, repaymentOptions, RepaymentDays } from "@/lib/loans";
import { DestinationCountry, getCountryOption, PayoutMethod, validateHaitiPayoutPhone } from "@/lib/payout";
import { supabase } from "@/lib/supabase";

type SupabaseLikeError = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
};

type CaptureFieldProps = {
  accept?: string;
  file: File | null;
  label: string;
  name: string;
  onChange: (file: File | null) => void;
  t: (key: string) => string;
};

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
      if (destinationCountry === "haiti") return haitiAccountName.trim() && mobileNumber.trim() && !validateHaitiPayoutPhone(payoutMethod, mobileNumber, t);
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

  function formatSubmitError(error: unknown) {
    if (!error || typeof error !== "object") return t("submitLoanError");

    const supabaseError = error as SupabaseLikeError;
    return [supabaseError.message, supabaseError.details, supabaseError.hint, supabaseError.code]
      .filter(Boolean)
      .join(" ");
  }

  async function uploadLoanFile(file: File, reference: string, type: string) {
    if (!userId) throw new Error(t("useLoginFirst"));

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
      const phoneError = destinationCountry === "haiti" ? validateHaitiPayoutPhone(payoutMethod, mobileNumber, t) : "";
      if (phoneError) throw new Error(phoneError);

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
        id_photo_url: idPhotoUrl,
        selfie_url: selfieUrl,
        selfie_with_id_url: selfieWithIdUrl,
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
            <CameraCaptureField file={idPhoto} label={t("idPhoto")} name="id-photo" onChange={setIdPhoto} t={t} />
            <CameraCaptureField file={selfie} label={t("selfie")} name="selfie" onChange={setSelfie} t={t} />
            <CameraCaptureField file={selfieWithId} label={t("selfieWithId")} name="selfie-with-id" onChange={setSelfieWithId} t={t} />
          </>
        ) : null}

        {step === 3 ? (
          <div className="notice">
            <strong>{fullName}</strong> · ${numericAmount.toFixed(2)} · {repaymentDays} {t("dayUnit")} ·{" "}
            {selectedRepayment.percentLabel} {t("interest").toLowerCase()} · {t(selectedCountry.labelKey)} ({selectedCountry.currency}) ·{" "}
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

function CameraCaptureField({ file, label, name, onChange, t }: CaptureFieldProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");

  async function openCamera() {
    setCameraError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: name === "selfie" ? "user" : "environment" },
        audio: false
      });

      streamRef.current = stream;
      setCameraOpen(true);

      window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 0);
    } catch {
      setCameraError(t("cameraAccessError"));
    }
  }

  function closeCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      onChange(new File([blob], `${name}.jpg`, { type: "image/jpeg" }));
      closeCamera();
    }, "image/jpeg", 0.92);
  }

  useEffect(() => closeCamera, []);

  return (
    <div className="capture-field">
      <label>
        {label}
        <input accept="image/*" capture="environment" type="file" onChange={(event) => onChange(event.target.files?.[0] ?? null)} required={!file} />
      </label>

      <div className="actions">
        <button className="secondary" onClick={cameraOpen ? closeCamera : openCamera} type="button">
          {cameraOpen ? t("closeCamera") : t("openCamera")}
        </button>
      </div>

      {file ? <p className="notice">{t("selectedFile")}: {file.name}</p> : null}
      {cameraError ? <p className="notice">{cameraError}</p> : null}

      {cameraOpen ? (
        <div className="camera-panel">
          <video aria-label={t("cameraPreview")} autoPlay muted playsInline ref={videoRef} />
          <button type="button" onClick={capturePhoto}>
            {t("capturePhoto")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
