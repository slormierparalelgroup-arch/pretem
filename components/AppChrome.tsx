"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login" || pathname === "/signup";

  return (
    <>
      {isAuthPage ? null : <Header />}
      <main>{children}</main>
      {isAuthPage ? null : <SiteFooter />}
    </>
  );
}
