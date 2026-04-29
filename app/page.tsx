"use client";

import { BadgeCheck, FileText, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";

export default function Home() {
  const { t } = useLanguage();

  return (
    <section className="page">
      <div className="hero">
        <div>
          <h1>PRETEM</h1>
          <p className="lead">
            A practical micro-loan platform for immigrants to request funds,
            complete identity verification, and track decisions with a clear
            reference number.
          </p>
          <div className="actions">
            <Link className="button" href="/login">
              {t("login")}
            </Link>
            <Link className="button secondary" href="/signup">
              {t("createAccount")}
            </Link>
            <Link className="button secondary" href="/request-status">
              {t("track")}
            </Link>
          </div>
        </div>
        <div className="hero-visual" aria-label="PRETEM loan support" />
      </div>

      <div className="grid three">
        <article className="card">
          <FileText size={24} />
          <h3>Simple requests</h3>
          <p className="muted">Submit basic contact details, amount, and repayment preview.</p>
        </article>
        <article className="card">
          <ShieldCheck size={24} />
          <h3>Identity checks</h3>
          <p className="muted">Upload ID, selfie, and selfie with ID into Supabase Storage.</p>
        </article>
        <article className="card">
          <BadgeCheck size={24} />
          <h3>Admin review</h3>
          <p className="muted">Admins can approve, reject, and track loan history.</p>
        </article>
      </div>
    </section>
  );
}
