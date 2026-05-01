export default function PrivacyPage() {
  return (
    <section className="page content-page">
      <div className="panel">
        <p className="eyebrow">PRETEM Credit</p>
        <h1>Privacy Policy</h1>
        <p className="muted">Last updated: May 1, 2026</p>

        <h2>Information We Collect</h2>
        <p>
          PRETEM collects information needed to review loan requests, including account details, contact information, loan amount, repayment
          selection, payout information, identity photos, selfies, request history, and administrative decisions.
        </p>

        <h2>How We Use Information</h2>
        <p>
          We use this information to create accounts, verify identity, review loan requests, communicate with borrowers, prevent fraud, manage
          repayment status, and maintain borrower history.
        </p>

        <h2>Identity Documents</h2>
        <p>
          Identity photos and selfies are stored in private Supabase Storage. They are not public website files. Authorized admins use temporary
          signed links to review documents, open images, or download records when needed for business operations.
        </p>

        <h2>Social Media</h2>
        <p>
          PRETEM will not publish borrower ID documents, selfies with ID, or private verification documents on social media. Any public testimonial
          or marketing use should be limited to non-sensitive materials and separate permission.
        </p>

        <h2>Sharing</h2>
        <p>
          PRETEM does not sell borrower information. We may share information only when needed for operations, fraud prevention, legal compliance,
          payment or payout processing, or with service providers that help run the platform.
        </p>

        <h2>Security</h2>
        <p>
          The website uses HTTPS encryption through Vercel. Database access is protected with Supabase authentication and row-level security rules.
          No online system can be guaranteed perfectly secure, but PRETEM uses reasonable safeguards to protect sensitive information.
        </p>

        <h2>Contact</h2>
        <p>Questions about privacy can be sent through the contact page or to PRETEM Credit support.</p>
      </div>
    </section>
  );
}
