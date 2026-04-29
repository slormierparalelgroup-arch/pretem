"use client";

import { Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { FormEvent, useEffect, useState } from "react";
import { formatMoney, Loan } from "@/lib/loans";
import { formatPayoutDetails, getPayoutMethodLabel } from "@/lib/payout";
import { supabase } from "@/lib/supabase";

function RequestStatusContent() {
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
      setMessage("No loan request was found for that reference.");
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

  return (
    <section className="page">
      <form className="panel form" onSubmit={submit}>
        <h1>Track a request</h1>
        <label>
          Reference number
          <input value={reference} onChange={(event) => setReference(event.target.value.toUpperCase())} placeholder="PRE-1234-ABC" />
        </label>
        <button disabled={loading}>
          <Search size={18} />
          {loading ? "Checking..." : "Check status"}
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
            <span className={`status ${loan.status}`}>{loan.status}</span>
          </div>
          <div className="grid three">
            <div>
              <strong>{formatMoney(loan.amount)}</strong>
              <p className="muted">Requested</p>
            </div>
            <div>
              <strong>{formatMoney(loan.repayment)}</strong>
              <p className="muted">Repayment</p>
            </div>
            <div>
              <strong>{loan.due_date ? new Date(loan.due_date).toLocaleDateString() : "Pending"}</strong>
              <p className="muted">Due date</p>
            </div>
            <div>
              <strong>{loan.repayment_days ?? "?"} days</strong>
              <p className="muted">
                {loan.interest_rate != null ? `${Math.round(loan.interest_rate * 100)}% interest` : "Repayment period"}
              </p>
            </div>
            <div>
              <strong>{loan.destination_country ?? "Destination"}</strong>
              <p className="muted">
                {loan.currency ?? "Currency"} · {getPayoutMethodLabel(loan.payout_method)}
              </p>
              <p className="muted">{formatPayoutDetails(loan.payout_details)}</p>
            </div>
          </div>
        </article>
      ) : null}
    </section>
  );
}

export default function RequestStatusPage() {
  return (
    <Suspense fallback={<section className="page"><p className="notice">Loading tracker...</p></section>}>
      <RequestStatusContent />
    </Suspense>
  );
}
