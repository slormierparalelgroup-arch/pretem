"use client";

import Image from "next/image";
import Link from "next/link";
import { ReactNode } from "react";
import { LanguageSelect } from "@/components/LanguageProvider";

type AuthShellProps = {
  children: ReactNode;
};

export function AuthShell({ children }: AuthShellProps) {
  return (
    <section className="auth-page">
      <div className="auth-background" aria-hidden="true" />
      <div className="auth-card">
        <div className="auth-language">
          <LanguageSelect />
        </div>
        <Link className="auth-logo" href="/">
          <Image alt="PRETEM Credit" height={72} priority src="/images/pretem-logo-transparent.png" width={382} />
        </Link>
        {children}
      </div>
    </section>
  );
}
