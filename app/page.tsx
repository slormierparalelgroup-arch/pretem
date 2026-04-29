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
          <p className="lead">{t("heroBody")}</p>
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
          <h3>{t("simpleRequestsTitle")}</h3>
          <p className="muted">{t("simpleRequestsBody")}</p>
        </article>
        <article className="card">
          <ShieldCheck size={24} />
          <h3>{t("identityChecksTitle")}</h3>
          <p className="muted">{t("identityChecksBody")}</p>
        </article>
        <article className="card">
          <BadgeCheck size={24} />
          <h3>{t("adminReviewTitle")}</h3>
          <p className="muted">{t("adminReviewBody")}</p>
        </article>
      </div>
    </section>
  );
}
