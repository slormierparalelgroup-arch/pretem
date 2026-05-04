export type LoanStatus = "pending" | "approved" | "rejected" | "paid" | "canceled";
export type RepaymentDays = 7 | 14 | 21 | 28;
export type PayoutDetails = {
  mobile_number?: string;
  receiver?: string;
  bank_name?: string;
  account_name?: string;
  clabe?: string;
};

export const repaymentOptions = [
  { days: 7, rate: 0.1, label: "7 days", percentLabel: "10%" },
  { days: 14, rate: 0.19, label: "14 days", percentLabel: "19%" },
  { days: 21, rate: 0.28, label: "21 days", percentLabel: "28%" },
  { days: 28, rate: 0.36, label: "28 days", percentLabel: "36%" }
] as const satisfies ReadonlyArray<{
  days: RepaymentDays;
  rate: number;
  label: string;
  percentLabel: string;
}>;

export type Loan = {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  amount: number;
  repayment: number;
  destination_country: string | null;
  currency: string | null;
  payout_method: string | null;
  payout_details: PayoutDetails | null;
  repayment_days: RepaymentDays | null;
  interest_rate: number | null;
  reference: string;
  status: LoanStatus;
  id_photo_url: string | null;
  selfie_url: string | null;
  selfie_with_id_url: string | null;
  terms_accepted: boolean | null;
  terms_accepted_at: string | null;
  agreement_version: string | null;
  credit_reporting_acknowledged: boolean | null;
  public_story_consent: boolean | null;
  disbursement_transfer_id: string | null;
  disbursed_at: string | null;
  repayment_review_status: "not_submitted" | "pending" | "accepted" | "rejected" | null;
  repayment_submitted_amount: number | null;
  repayment_screenshot_url: string | null;
  repayment_transfer_id: string | null;
  repayment_submitted_at: string | null;
  due_date: string | null;
  paid_at: string | null;
  rejected_at: string | null;
  created_at: string;
};

export function getRepaymentOption(days: RepaymentDays) {
  return repaymentOptions.find((option) => option.days === days) ?? repaymentOptions[0];
}

export function calculateRepayment(amount: number, days: RepaymentDays) {
  const option = getRepaymentOption(days);
  return Number((amount * (1 + option.rate)).toFixed(2));
}

export function calculateInterest(amount: number, days: RepaymentDays) {
  return Number((calculateRepayment(amount, days) - amount).toFixed(2));
}

export function generateReference() {
  const value = Math.floor(1000 + Math.random() * 9000);
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `PRE-${value}-${suffix}`;
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}
