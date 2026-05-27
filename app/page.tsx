"use client";

import { ArrowRight, BadgeCheck, Clock, ShieldCheck, TrendingUp } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";

export default function Home() {
  const { t } = useLanguage();

  const trustItems = [
    { icon: ShieldCheck, label: t("homeTrustSecure"), text: t("homeTrustSecureBody") },
    { icon: BadgeCheck, label: t("homeTrustVerified"), text: t("homeTrustVerifiedBody") },
    { icon: TrendingUp, label: t("homeTrustCredit"), text: t("homeTrustCreditBody") }
  ];

  return (
    <section className="home-page">
      <section className="home-hero">
        <div className="home-hero-content">
          <span className="eyebrow">PRETEM Credit</span>
          <h1>{t("homeTitle")}</h1>
          <p className="lead">{t("heroBody")}</p>
          <div className="home-actions">
            <Link className="button" href="/signup">
              {t("createAccount")}
              <ArrowRight size={18} />
            </Link>
            <Link className="button secondary" href="/login">
              {t("login")}
            </Link>
            <Link className="button secondary" href="/request-status">
              {t("track")}
            </Link>
          </div>
          <div className="home-mini-steps" aria-label={t("homeHowItWorks")}>
            <span>{t("homeStepAccount")}</span>
            <span>{t("homeStepVerify")}</span>
            <span>{t("homeStepRequest")}</span>
          </div>
        </div>
        <div className="home-hero-media">
          <Image alt="PRETEM Credit community" fill priority src="/images/pretem-cover.png" sizes="(max-width: 820px) 100vw, 48vw" />
        </div>
      </section>

      <section className="home-credit-band">
        <div>
          <span>{t("countryHaiti")}</span>
          <strong>HTG 500</strong>
        </div>
        <div>
          <span>{t("countryUsa")}</span>
          <strong>$30</strong>
        </div>
        <div>
          <span>{t("countryMexico")}</span>
          <strong>MXN 500</strong>
        </div>
        <div>
          <span>{t("homeRepayment")}</span>
          <strong>7-28 {t("dayUnit")}</strong>
        </div>
      </section>

      <section className="grid three home-trust-grid">
        {trustItems.map((item) => {
          const Icon = item.icon;
          return (
            <article className="card home-trust-card" key={item.label}>
              <Icon size={24} />
              <h3>{item.label}</h3>
              <p>{item.text}</p>
            </article>
          );
        })}
      </section>

      <section className="home-final">
        <div>
          <Clock size={24} />
          <h2>{t("homeReadyTitle")}</h2>
          <p>{t("homeReadyBody")}</p>
        </div>
        <Link className="button" href="/request-loan">
          {t("requestLoan")}
          <ArrowRight size={18} />
        </Link>
      </section>
    </section>
  );
}
