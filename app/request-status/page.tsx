"use client";

import { Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { FormEvent, useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { formatMoney, Loan } from "@/lib/loans";
import { formatPayoutDetails, getDestinationLabel, getPayoutMethodLabel } from "@/lib/payout";
import { supabase } from "@/lib/supabase";

function RequestStatusContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const [reference, setReference] = useState(searchParams.get("reference") || "");
  const [loan, setLoan] = useState<Loan | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

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
  }

  useEffect(() => {
    const initialReference = searchParams.get("reference");
    if (initialReference) lookup(initialReference);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    lookup();
  }

  function statusLabel(status: Loan["status"]) {
    return t(`status${status.charAt(0).toUpperCase()}${status.slice(1)}`);
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
              <strong>{loan.due_date ? new Date(loan.due_date).toLocaleDateString() : t("pendingDue")}</strong>
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
