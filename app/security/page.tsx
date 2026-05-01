import { LockKeyhole, ShieldCheck, UserCheck } from "lucide-react";

export default function SecurityPage() {
  return (
    <section className="page content-page">
      <div className="panel">
        <p className="eyebrow">PRETEM Credit</p>
        <h1>Security And Trust</h1>
        <p className="lead small">
          PRETEM uses encrypted access, private document storage, and admin-only review tools to help protect borrower information.
        </p>
      </div>

      <div className="grid three">
        <article className="card">
          <LockKeyhole size={24} />
          <h3>HTTPS Protection</h3>
          <p className="muted">The live website uses HTTPS through Vercel, so users should see the secure padlock in their browser.</p>
        </article>
        <article className="card">
          <ShieldCheck size={24} />
          <h3>Private ID Storage</h3>
          <p className="muted">Identity photos are stored in a private Supabase bucket, not as public website images.</p>
        </article>
        <article className="card">
          <UserCheck size={24} />
          <h3>Admin Review</h3>
          <p className="muted">Only authorized admins can review borrower documents and make loan decisions.</p>
        </article>
      </div>

      <div className="panel">
        <h2>How Users Can Check PRETEM</h2>
        <ul className="clean-list">
          <li>Use the official website: www.pretemcredit.com</li>
          <li>Look for HTTPS and the browser padlock.</li>
          <li>Check that the logo, language options, and request flow match PRETEM Credit.</li>
          <li>Do not send identity documents through unofficial links or social media messages.</li>
        </ul>
      </div>
    </section>
  );
}
