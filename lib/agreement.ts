import { formatMoney, Loan } from "@/lib/loans";
import { formatPayoutDetails, getDestinationLabel, getPayoutMethodLabel } from "@/lib/payout";

const AGREEMENT_VERSION = "PRETEM-2026-05-01";

type Translator = (key: string) => string;

export function getAgreementVersion() {
  return AGREEMENT_VERSION;
}

export function buildLoanAgreementText(loan: Loan, t: Translator) {
  const acceptedAt = loan.terms_accepted_at ? new Date(loan.terms_accepted_at).toLocaleString() : t("notProvided");
  const dueDate = loan.due_date ? new Date(loan.due_date).toLocaleDateString() : t("notProvided");

  return [
    "PRETEM CREDIT - BORROWER AGREEMENT RECORD",
    "",
    `Agreement version: ${loan.agreement_version || AGREEMENT_VERSION}`,
    `Accepted at: ${acceptedAt}`,
    "",
    "Borrower",
    `Name: ${loan.full_name}`,
    `Phone: ${loan.phone}`,
    `Reference: ${loan.reference}`,
    "",
    "Loan request",
    `Requested amount: ${formatMoney(loan.amount)}`,
    `Total payback: ${formatMoney(loan.repayment)}`,
    `Repayment period: ${loan.repayment_days ?? "?"} ${t("dayUnit")}`,
    `Interest rate: ${loan.interest_rate != null ? `${Math.round(loan.interest_rate * 100)}%` : t("notProvided")}`,
    `Due date: ${dueDate}`,
    `Destination: ${getDestinationLabel(loan.destination_country, t)} ${loan.currency ? `(${loan.currency})` : ""}`,
    `Payout method: ${getPayoutMethodLabel(loan.payout_method, t)}`,
    `Payout details: ${formatPayoutDetails(loan.payout_details, t)}`,
    `Status: ${t(`status${loan.status.charAt(0).toUpperCase()}${loan.status.slice(1)}`)}`,
    `Disbursement transfer ID: ${loan.disbursement_transfer_id || t("notProvided")}`,
    `Repayment transfer ID: ${loan.repayment_transfer_id || t("notProvided")}`,
    "",
    "Borrower acknowledgments",
    "- I certify that the information and documents I submitted are true, complete, and belong to me.",
    "- I authorize PRETEM Credit to review and store my identity verification documents for account and loan review.",
    "- I understand the repayment amount, repayment period, due date, and fees shown before submission.",
    "- I agree to repay according to the terms shown in this request if the loan is approved and funded.",
    "- I understand that late, unpaid, or defaulted obligations may be sent to collections or reported to credit/consumer reporting agencies only as permitted by applicable law.",
    "- I understand that credit reporting requires accurate records and that I may dispute inaccurate information.",
    "- I understand that PRETEM Credit may use lawful recovery methods, including private reminders, collections, legal action, or credit reporting as permitted by applicable law.",
    "- I understand that PRETEM Credit will not publish my name, photos, ID document, selfie with ID, debt information, or private verification documents on social media.",
    loan.public_story_consent
      ? "- I separately allow PRETEM Credit to contact me about using non-sensitive testimonials or approved marketing photos. This does not include ID documents."
      : "- I did not give optional public story or marketing consent.",
    "",
    "Important",
    "This record is generated from the online loan request and agreement acceptance. It is not legal advice. PRETEM Credit should follow applicable lending, privacy, collections, and credit reporting laws."
  ].join("\n");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDateTime(value: string | null | undefined, fallback: string) {
  return value ? new Date(value).toLocaleString() : fallback;
}

function formatDate(value: string | null | undefined, fallback: string) {
  return value ? new Date(value).toLocaleDateString() : fallback;
}

function agreementRows(rows: Array<[string, string]>) {
  return rows
    .map(
      ([label, value]) => `
        <div class="row">
          <dt>${escapeHtml(label)}</dt>
          <dd>${escapeHtml(value)}</dd>
        </div>
      `
    )
    .join("");
}

export function buildLoanAgreementHtml(loan: Loan, t: Translator, logoUrl = "/images/pretem-logo-transparent.png") {
  const acceptedAt = formatDateTime(loan.terms_accepted_at, t("notProvided"));
  const dueDate = formatDate(loan.due_date, t("notProvided"));
  const status = t(`status${loan.status.charAt(0).toUpperCase()}${loan.status.slice(1)}`);
  const interestRate = loan.interest_rate != null ? `${Math.round(loan.interest_rate * 100)}%` : t("notProvided");
  const destination = `${getDestinationLabel(loan.destination_country, t)} ${loan.currency ? `(${loan.currency})` : ""}`;
  const repaymentAmount = loan.repayment_submitted_amount ? formatMoney(loan.repayment_submitted_amount) : t("notProvided");

  const borrowerRows = agreementRows([
    [t("fullName"), loan.full_name],
    [t("phoneNumber"), loan.phone],
    [t("referenceNumber"), loan.reference],
    [t("status"), status],
    ["Agreement version", loan.agreement_version || AGREEMENT_VERSION],
    ["Accepted at", acceptedAt]
  ]);

  const loanRows = agreementRows([
    [t("requested"), formatMoney(loan.amount)],
    [t("totalPayback"), formatMoney(loan.repayment)],
    [t("repaymentPeriod"), `${loan.repayment_days ?? "?"} ${t("dayUnit")}`],
    [t("interest"), interestRate],
    [t("dueDate"), dueDate],
    [t("destinationFallback"), destination],
    [t("payoutMethod"), getPayoutMethodLabel(loan.payout_method, t)],
    [t("payoutInfo"), formatPayoutDetails(loan.payout_details, t)]
  ]);

  const paymentRows = agreementRows([
    [t("moneySentTransferId"), loan.disbursement_transfer_id || t("notProvided")],
    [t("repaymentAmount"), repaymentAmount],
    [t("repaymentTransferId"), loan.repayment_transfer_id || t("notProvided")],
    [t("repaymentProof"), loan.repayment_review_status || t("notProvided")],
    [t("statusPaid"), loan.paid_at ? formatDateTime(loan.paid_at, t("notProvided")) : t("notProvided")]
  ]);

  const acknowledgments = [
    "I certify that the information and documents I submitted are true, complete, and belong to me.",
    "I authorize PRETEM Credit to review and store my identity verification documents for account and loan review.",
    "I understand the requested amount, repayment amount, repayment period, due date, and fees shown before submission.",
    "I agree to repay according to the terms shown in this request if the loan is approved and funded.",
    "I understand that late, unpaid, or defaulted obligations may be sent to collections or reported to credit/consumer reporting agencies only as permitted by applicable law.",
    "I understand that PRETEM Credit may use lawful recovery methods, including private reminders, collections, legal action, or credit reporting as permitted by applicable law.",
    "I understand that PRETEM Credit will not publish my ID document, selfie with ID, or private verification documents on social media.",
    loan.public_story_consent
      ? "I separately allow PRETEM Credit to contact me about using non-sensitive testimonials or approved marketing photos. This does not include ID documents."
      : "I did not give optional public story or marketing consent."
  ];

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(loan.reference)} PRETEM Credit Agreement</title>
    <style>
      @page { margin: 18mm; size: letter; }
      * { box-sizing: border-box; }
      body {
        background: #eef4fa;
        color: #0b1f3a;
        font-family: Arial, Helvetica, sans-serif;
        margin: 0;
        padding: 24px;
      }
      .sheet {
        background: white;
        border: 1px solid #d6e3ef;
        margin: 0 auto;
        max-width: 920px;
        padding: 34px;
      }
      header {
        align-items: flex-start;
        border-bottom: 3px solid #f59e42;
        display: flex;
        gap: 18px;
        justify-content: space-between;
        padding-bottom: 18px;
      }
      .logo { height: 58px; object-fit: contain; width: auto; }
      h1 { color: #0b3d75; font-size: 24px; margin: 10px 0 6px; }
      h2 {
        border-bottom: 1px solid #d6e3ef;
        color: #0b3d75;
        font-size: 16px;
        margin: 28px 0 12px;
        padding-bottom: 8px;
      }
      .meta {
        color: #52657b;
        font-size: 12px;
        line-height: 1.5;
        text-align: right;
      }
      dl {
        display: grid;
        gap: 0;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        margin: 0;
      }
      .row {
        border-bottom: 1px solid #e8eef5;
        display: grid;
        gap: 4px;
        padding: 10px 12px 10px 0;
      }
      dt {
        color: #52657b;
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
      }
      dd { font-size: 14px; font-weight: 700; margin: 0; }
      ul { color: #26394f; line-height: 1.55; margin: 0; padding-left: 20px; }
      li { margin-bottom: 8px; }
      .signature {
        display: grid;
        gap: 18px;
        grid-template-columns: 1fr 1fr;
        margin-top: 28px;
      }
      .signature div {
        border-top: 1px solid #0b1f3a;
        color: #52657b;
        font-size: 12px;
        padding-top: 8px;
      }
      .notice {
        background: #f8fbff;
        border-left: 4px solid #f59e42;
        color: #52657b;
        line-height: 1.55;
        margin-top: 22px;
        padding: 12px;
      }
      .actions {
        display: flex;
        gap: 10px;
        justify-content: center;
        margin: 18px auto 0;
        max-width: 920px;
      }
      button {
        background: #0b3d75;
        border: 0;
        border-radius: 8px;
        color: white;
        cursor: pointer;
        font-weight: 800;
        min-height: 42px;
        padding: 0 18px;
      }
      button.secondary { background: white; border: 1px solid #0b3d75; color: #0b3d75; }
      @media print {
        body { background: white; padding: 0; }
        .sheet { border: 0; max-width: none; padding: 0; }
        .actions { display: none; }
      }
    </style>
  </head>
  <body>
    <main class="sheet">
      <header>
        <div>
          <img class="logo" alt="PRETEM Credit" src="${escapeHtml(logoUrl)}" />
          <h1>Borrower Loan Agreement</h1>
          <strong>PRETEM Credit</strong>
        </div>
        <div class="meta">
          <div>Reference: <strong>${escapeHtml(loan.reference)}</strong></div>
          <div>Generated: ${escapeHtml(new Date().toLocaleString())}</div>
          <div>Agreement: ${escapeHtml(loan.agreement_version || AGREEMENT_VERSION)}</div>
        </div>
      </header>

      <h2>Borrower and Acceptance</h2>
      <dl>${borrowerRows}</dl>

      <h2>Loan Terms</h2>
      <dl>${loanRows}</dl>

      <h2>Disbursement and Repayment Record</h2>
      <dl>${paymentRows}</dl>

      <h2>Borrower Acknowledgments</h2>
      <ul>${acknowledgments.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>

      <div class="signature">
        <div>Borrower electronic acceptance: ${escapeHtml(loan.full_name)}</div>
        <div>PRETEM Credit authorized review</div>
      </div>

      <p class="notice">
        This record is generated from the online loan request and agreement acceptance. It is not legal advice.
        PRETEM Credit should follow applicable lending, privacy, collections, and credit reporting laws.
      </p>
    </main>
    <div class="actions">
      <button onclick="window.print()">Save as PDF</button>
      <button class="secondary" onclick="window.close()">Close</button>
    </div>
    <script>
      window.addEventListener("load", () => window.setTimeout(() => window.print(), 400));
    </script>
  </body>
</html>`;
}

export function downloadLoanAgreement(loan: Loan, t: Translator) {
  const logoUrl = `${window.location.origin}/images/pretem-logo-transparent.png`;
  const html = buildLoanAgreementHtml(loan, t, logoUrl);
  const printWindow = window.open("", "_blank", "noopener,noreferrer");

  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    return;
  }

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${loan.reference}-agreement.html`.replace(/[^a-z0-9.-]+/gi, "-").toLowerCase();
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
