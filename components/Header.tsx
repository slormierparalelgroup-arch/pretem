"use client";

import Link from "next/link";
import { LanguageSelect, useLanguage } from "@/components/LanguageProvider";

export function Header() {
  const { t } = useLanguage();

  return (
    <header className="site-header">
      <Link className="brand" href="/">
        PRETEM
      </Link>
      <nav>
        <Link href="/login">{t("login")}</Link>
        <Link href="/request-loan">{t("requestLoan")}</Link>
        <Link href="/request-status">{t("track")}</Link>
        <Link href="/dashboard">{t("dashboard")}</Link>
        <Link href="/admin">{t("admin")}</Link>
      </nav>
      <LanguageSelect />
    </header>
  );
}
