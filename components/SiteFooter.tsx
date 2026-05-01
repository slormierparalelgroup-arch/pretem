"use client";

import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";

export function SiteFooter() {
  const { t } = useLanguage();

  return (
    <footer className="site-footer">
      <div>
        <strong>PRETEM Credit</strong>
        <p>{t("footerTrust")}</p>
      </div>
      <nav>
        <Link href="/privacy">{t("privacyPolicy")}</Link>
        <Link href="/terms">{t("termsDisclosure")}</Link>
        <Link href="/security">{t("security")}</Link>
        <Link href="/contact">{t("contact")}</Link>
      </nav>
    </footer>
  );
}
