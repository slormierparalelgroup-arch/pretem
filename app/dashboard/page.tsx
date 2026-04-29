"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { formatMoney, Loan, LoanStatus } from "@/lib/loans";
import { getDestinationLabel, getPayoutMethodLabel } from "@/lib/payout";
import { supabase } from "@/lib/supabase";

const statuses: Array<"all" | LoanStatus> = ["all", "pending", "approved", "rejected", "paid"];

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useLanguage();
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

  function statusLabel(nextStatus: LoanStatus) {
    return t(`status${nextStatus.charAt(0).toUpperCase()}${nextStatus.slice(1)}`);
  }

  function filterLabel(nextStatus: "all" | LoanStatus) {
    return nextStatus === "all" ? t("allStatuses") : statusLabel(nextStatus);
  }

  return (
    <section className="page">
      <div className="toolbar">
        <div>
          <h1>{t("myLoans")}</h1>
          <p className="muted">{t("loanHistoryBody")}</p>
        </div>
        <div className="actions">
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
            <span className={`status ${loan.status}`}>{statusLabel(loan.status)}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
