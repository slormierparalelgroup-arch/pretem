"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { formatMoney, Loan, LoanStatus } from "@/lib/loans";
import { formatPayoutDetails, getPayoutMethodLabel } from "@/lib/payout";
import { supabase } from "@/lib/supabase";

const statuses: Array<"all" | LoanStatus> = ["all", "pending", "approved", "rejected", "paid"];

export default function AdminPage() {
  const router = useRouter();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [status, setStatus] = useState<"all" | LoanStatus>("pending");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const filteredLoans = useMemo(() => {
    if (status === "all") return loans;
    return loans.filter((loan) => loan.status === status);
  }, [loans, status]);

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push("/admin/login");
        return;
      }

      const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
      const isAdmin = profile?.role === "admin" || adminEmails.includes(userData.user.email?.toLowerCase() || "");

      if (!isAdmin) {
        setMessage("This account does not have admin access.");
        setLoading(false);
        return;
      }

      await refreshLoans();
      setLoading(false);
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function refreshLoans() {
    const { data, error } = await supabase.from("loans").select("*").order("created_at", { ascending: false });
    if (error) {
      setMessage(error.message);
      return;
    }
    setLoans(data || []);
  }

  async function updateStatus(id: string, nextStatus: LoanStatus) {
    setMessage("");
    const patch = nextStatus === "paid" ? { status: nextStatus, paid_at: new Date().toISOString() } : { status: nextStatus };
    const { error } = await supabase.from("loans").update(patch).eq("id", id);
    if (error) {
      setMessage(error.message);
      return;
    }
    await refreshLoans();
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <section className="page">
      <div className="toolbar">
        <div>
          <h1>Admin dashboard</h1>
          <p className="muted">Review requests, inspect verification uploads, and manage repayment state.</p>
        </div>
        <button className="secondary" onClick={signOut}>
          Sign out
        </button>
      </div>

      {message ? <p className="notice">{message}</p> : null}
      {loading ? <p className="notice">Loading admin data...</p> : null}

      {!loading && !message ? (
        <>
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

          <div className="loan-list">
            {filteredLoans.map((loan) => (
              <article className="card" key={loan.id}>
                <div className="loan-row">
                  <div>
                    <strong>{loan.full_name}</strong>
                    <p className="muted">
                      {loan.phone} · {loan.reference}
                    </p>
                    <p className="muted">
                      {loan.destination_country ?? "Destination"} {loan.currency ? `(${loan.currency})` : ""} ·{" "}
                      {getPayoutMethodLabel(loan.payout_method)}
                    </p>
                    <p className="muted">{formatPayoutDetails(loan.payout_details)}</p>
                  </div>
                  <div>{formatMoney(loan.amount)}</div>
                  <div>
                    <strong>{formatMoney(loan.repayment)}</strong>
                    <p className="muted">
                      {loan.repayment_days ?? "?"} days ·{" "}
                      {loan.interest_rate != null ? `${Math.round(loan.interest_rate * 100)}%` : "rate"}
                    </p>
                  </div>
                  <span className={`status ${loan.status}`}>{loan.status}</span>
                </div>

                <div className="thumbs">
                  {loan.id_photo_url ? (
                    <Image alt="ID document" height={180} src={loan.id_photo_url} width={240} />
                  ) : null}
                  {loan.selfie_url ? <Image alt="Selfie" height={180} src={loan.selfie_url} width={240} /> : null}
                  {loan.selfie_with_id_url ? (
                    <Image alt="Selfie with ID" height={180} src={loan.selfie_with_id_url} width={240} />
                  ) : null}
                </div>

                <div className="actions" style={{ marginTop: 14 }}>
                  <button onClick={() => updateStatus(loan.id, "approved")}>Approve</button>
                  <button className="danger" onClick={() => updateStatus(loan.id, "rejected")}>
                    Reject
                  </button>
                  <button className="secondary" onClick={() => updateStatus(loan.id, "paid")}>
                    Mark paid
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
