"use client";

import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LanguageSelect, useLanguage } from "@/components/LanguageProvider";
import { supabase } from "@/lib/supabase";

export function Header() {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    async function checkAdmin() {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) {
        setShowAdmin(false);
        return;
      }

      const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      setShowAdmin(profile?.role === "admin" || adminEmails.includes(user.email?.toLowerCase() || ""));
    }

    checkAdmin();
    const { data } = supabase.auth.onAuthStateChange(() => checkAdmin());
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    function closeOnOutsideClick(event: MouseEvent | TouchEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menuRef.current?.contains(target)) return;
      setIsOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("touchstart", closeOnOutsideClick);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("touchstart", closeOnOutsideClick);
    };
  }, [isOpen]);

  return (
    <header className="site-header">
      <Link className="brand" href="/">
        <Image alt="PRETEM Credit" height={58} priority src="/images/pretem-logo-transparent.png" width={308} />
      </Link>
      <div className="header-actions">
        <LanguageSelect />
        <div className="menu-wrapper" ref={menuRef}>
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
              <Link href="/verify-identity" onClick={() => setIsOpen(false)}>
                {t("verifyIdentity")}
              </Link>
              <Link href="/security" onClick={() => setIsOpen(false)}>
                {t("security")}
              </Link>
              <Link href="/contact" onClick={() => setIsOpen(false)}>
                {t("contact")}
              </Link>
              {showAdmin ? (
                <Link href="/admin" onClick={() => setIsOpen(false)}>
                  {t("admin")}
                </Link>
              ) : null}
            </nav>
          ) : null}
        </div>
      </div>
    </header>
  );
}
