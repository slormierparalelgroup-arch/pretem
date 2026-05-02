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

export function downloadLoanAgreement(loan: Loan, t: Translator) {
  const blob = new Blob([buildLoanAgreementText(loan, t)], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${loan.reference}-agreement.txt`.replace(/[^a-z0-9.-]+/gi, "-").toLowerCase();
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
