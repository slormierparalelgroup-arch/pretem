import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { LanguageProvider } from "@/components/LanguageProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "PRETEM",
  description: "Micro-loans for the Haitian community"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: `
              body{margin:0;background:#f4f8fb;color:#0b1f3a;font-family:Arial,Helvetica,sans-serif}
              a{color:inherit;text-decoration:none}
              .site-header{align-items:center;background:rgba(244,248,251,.96);border-bottom:1px solid #d6e3ef;display:flex;gap:24px;justify-content:space-between;padding:18px 32px;position:sticky;top:0;z-index:10}
              .brand{color:#0b3d75;font-size:24px;font-weight:800}
              nav{display:flex;flex-wrap:wrap;gap:18px;color:#52657b;font-size:14px;font-weight:700}
              .language-select{align-items:center;display:flex;gap:8px;width:auto}
              .page{margin:0 auto;max-width:1120px;padding:48px 24px}
              .panel,.card{background:#fff;border:1px solid #d6e3ef;border-radius:8px}
              .panel{padding:24px}
              .form{display:grid;gap:18px;max-width:720px}
              label{color:#52657b;display:grid;font-size:13px;font-weight:800;gap:7px}
              input,select{background:#fff;border:1px solid #d6e3ef;border-radius:8px;color:#0b1f3a;font:inherit;min-height:44px;padding:10px 12px;width:100%}
              .actions{display:flex;flex-wrap:wrap;gap:12px}
              .button,button{align-items:center;background:#ff8a1c;border:1px solid #ff8a1c;border-radius:8px;color:#1b2430;cursor:pointer;display:inline-flex;font-size:15px;font-weight:800;justify-content:center;min-height:44px;padding:0 16px}
              .button.secondary,button.secondary{background:#fff;color:#0b3d75}
              @media(max-width:820px){.site-header{align-items:flex-start;flex-direction:column}.page{padding:28px 18px}}
            `
          }}
        />
      </head>
      <body>
        <LanguageProvider>
          <Header />
          <main>{children}</main>
        </LanguageProvider>
      </body>
    </html>
  );
}
