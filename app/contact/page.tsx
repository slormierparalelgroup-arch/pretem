import Link from "next/link";

export default function ContactPage() {
  return (
    <section className="page content-page">
      <div className="panel">
        <p className="eyebrow">PRETEM Credit</p>
        <h1>Contact PRETEM</h1>
        <p className="lead small">Use the official PRETEM Credit website and contact information when asking questions about a loan request.</p>

        <div className="grid two">
          <article className="card">
            <h3>Email</h3>
            <p className="muted">slormier.paralelgroup@gmail.com</p>
          </article>
          <article className="card">
            <h3>Official Website</h3>
            <p className="muted">www.pretemcredit.com</p>
          </article>
        </div>

        <div className="notice">
          PRETEM will not ask borrowers to send ID photos through unofficial links. Use the verification page inside this website.
        </div>

        <div className="actions">
          <Link className="button" href="/request-status">
            Track a request
          </Link>
          <Link className="button secondary" href="/security">
            Security information
          </Link>
        </div>
      </div>
    </section>
  );
}
