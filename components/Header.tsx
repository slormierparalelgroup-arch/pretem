"use client";

import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { LanguageSelect, useLanguage } from "@/components/LanguageProvider";

export function Header() {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="site-header">
      <Link className="brand" href="/">
        <Image alt="PRETEM Credit" height={58} priority src="/images/pretem-logo-transparent.png" width={308} />
      </Link>
      <div className="header-actions">
        <LanguageSelect />
        <div className="menu-wrapper">
          <button
            aria-expanded={isOpen}
            aria-label={t("menu")}
            className="menu-button secondary"
            onClick={() => setIsOpen((value) => !value)}
            type="button"
          >
            {isOpen ? <X size={18} /> : <Menu size={18} />}
            <span>{t("menu")}</span>
          </button>
          {isOpen ? (
            <nav className="menu-panel">
              <Link href="/login" onClick={() => setIsOpen(false)}>
                {t("login")}
              </Link>
              <Link href="/request-loan" onClick={() => setIsOpen(false)}>
                {t("requestLoan")}
              </Link>
              <Link href="/request-status" onClick={() => setIsOpen(false)}>
                {t("track")}
              </Link>
              <Link href="/dashboard" onClick={() => setIsOpen(false)}>
                {t("dashboard")}
              </Link>
              <Link href="/admin" onClick={() => setIsOpen(false)}>
                {t("admin")}
              </Link>
            </nav>
          ) : null}
        </div>
      </div>
    </header>
  );
}
