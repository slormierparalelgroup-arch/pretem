"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { formatMoney, Loan, LoanStatus } from "@/lib/loans";
import { getPayoutMethodLabel } from "@/lib/payout";
import { supabase } from "@/lib/supabase";

const statuses: Array<"all" | LoanStatus> = ["all", "pending", "approved", "rejected", "paid"];

export default function DashboardPage() {
  const router = useRouter();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [status, setStatus] = useState<"all" | LoanStatus>("all");
  const [loading, setLoading] = useState(true);

  const filteredLoans = useMemo(() => {
    if (status === "all") return loans;
    return loans.filter((loan) => loan.status === status);
  }, [loans, status]);

  useEffect(() => {
    async function loadLoans() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push("/login");
        return;
      }

      const { data } = await supabase
        .from("loans")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: false });

      setLoans(data || []);
      setLoading(false);
    }

    loadLoans();
  }, [router]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <section className="page">
      <div className="toolbar">
        <div>
          <h1>My loans</h1>
          <p className="muted">View your request history and repayment status.</p>
        </div>
        <div className="actions">
          <Link className="button" href="/request-loan">
            New request
          </Link>
          <button className="secondary" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>

      <div className="toolbar">
        <label>
          Filter by status
          <select value={status} onChange={(event) => setStatus(event.target.value as "all" | LoanStatus)}>
            {statuses.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? <p className="notice">Loading loan history...</p> : null}

      {!loading && filteredLoans.length === 0 ? (
        <div className="panel">
          <h2>No loans found</h2>
          <p className="muted">Once you request a loan, it will appear here.</p>
        </div>
      ) : null}

      <div className="loan-list">
        {filteredLoans.map((loan) => (
          <article className="card loan-row" key={loan.id}>
            <div>
              <strong>{loan.reference}</strong>
              <p className="muted">
                {new Date(loan.created_at).toLocaleDateString()} · {loan.destination_country ?? "Destination"}{" "}
                {loan.currency ? `(${loan.currency})` : ""}
              </p>
            </div>
            <div>{formatMoney(loan.amount)}</div>
            <div>
              <strong>{formatMoney(loan.repayment)}</strong>
              <p className="muted">
                {loan.repayment_days ?? "?"} days · {loan.interest_rate != null ? `${Math.round(loan.interest_rate * 100)}%` : "rate"}
              </p>
              <p className="muted">{getPayoutMethodLabel(loan.payout_method)}</p>
            </div>
            <span className={`status ${loan.status}`}>{loan.status}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
