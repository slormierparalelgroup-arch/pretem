export type CreditLimitRequestStatus = "pending" | "approved" | "rejected";

export type CreditLimitRequest = {
  id: string;
  user_id: string;
  country: string;
  currency: string;
  requested_amount: number;
  approved_amount: number | null;
  status: CreditLimitRequestStatus;
  admin_note: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export function getApprovedCreditLimitOverride(requests: CreditLimitRequest[], country: string | null | undefined) {
  const normalizedCountry = (country || "haiti").toLowerCase();

  return requests
    .filter((request) => request.status === "approved" && request.country === normalizedCountry && request.approved_amount)
    .reduce((highest, request) => Math.max(highest, Number(request.approved_amount || 0)), 0);
}

export function getPendingCreditLimitRequest(requests: CreditLimitRequest[], country: string | null | undefined) {
  const normalizedCountry = (country || "haiti").toLowerCase();
  return requests.find((request) => request.status === "pending" && request.country === normalizedCountry) || null;
}
