"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isEntryPage = pathname === "/";
  const isAuthPage = pathname === "/login" || pathname === "/signup";
  const hideHeader = isEntryPage || isAuthPage;
  const hideFooter = isAuthPage;

  return (
    <>
      {hideHeader ? null : <Header />}
      <main>{children}</main>
      {hideFooter ? null : <SiteFooter />}
    </>
  );
}
