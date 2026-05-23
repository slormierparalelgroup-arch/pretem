import { DestinationCountry } from "@/lib/payout";
import { Loan } from "@/lib/loans";

export const CREDIT_MIN = 300;
export const CREDIT_MAX = 850;
export const STARTING_CREDIT_SCORE = 500;
export const PENALTY_DAYS = 20;

export type CreditOutcome = "early" | "on_time" | "late" | "bad";

const baseCreditLimits: Record<DestinationCountry, { amount: number; currency: string }> = {
  haiti: { amount: 500, currency: "HTG" },
  usa: { amount: 30, currency: "USD" },
  mexico: { amount: 500, currency: "MXN" }
};

export function normalizeCreditCountry(country: string | null | undefined): DestinationCountry {
  const normalized = (country || "").toLowerCase();
  if (normalized === "usa" || normalized === "us" || normalized === "united states" || normalized === "etazini") return "usa";
  if (normalized === "mexico" || normalized === "méxico" || normalized === "meksik") return "mexico";
  return "haiti";
}

export function getBaseCreditLine(country: string | null | undefined) {
  return baseCreditLimits[normalizeCreditCountry(country)];
}

export function formatCreditMoney(value: number, country: string | null | undefined) {
  const { currency } = getBaseCreditLine(country);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "HTG" || currency === "MXN" ? 0 : 2
  }).format(value);
}

export function clampCreditScore(score: number) {
  return Math.max(CREDIT_MIN, Math.min(CREDIT_MAX, Math.round(score)));
}

export function creditScoreDelta(outcome: CreditOutcome) {
  if (outcome === "early") return 40;
  if (outcome === "on_time") return 25;
  if (outcome === "late") return -80;
  return -100;
}

export function projectCreditScore(score: number, outcome: CreditOutcome) {
  return clampCreditScore(score + creditScoreDelta(outcome));
}

function eventDate(loan: Loan) {
  return loan.repayment_submitted_at || loan.paid_at || loan.rejected_at || loan.created_at;
}

function addDays(value: string, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

export function getRepaymentOutcome(loan: Loan): CreditOutcome | null {
  if (loan.repayment_review_status === "rejected" || loan.status === "rejected") return "bad";
  if (loan.status !== "paid" || loan.repayment_review_status !== "accepted") return null;

  if (!loan.due_date) return "on_time";

  const submittedAt = loan.repayment_submitted_at || loan.paid_at;
  if (!submittedAt) return "on_time";

  const submittedDate = new Date(submittedAt).getTime();
  const dueDate = new Date(loan.due_date).getTime();
  const oneDay = 24 * 60 * 60 * 1000;

  if (submittedDate < dueDate - oneDay) return "early";
  if (submittedDate <= dueDate) return "on_time";
  return "late";
}

export function calculateCreditScoreFromLoans(loans: Loan[], startingScore = STARTING_CREDIT_SCORE) {
  return loans
    .slice()
    .sort((a, b) => new Date(eventDate(a)).getTime() - new Date(eventDate(b)).getTime())
    .reduce((score, loan) => {
      const outcome = getRepaymentOutcome(loan);
      return outcome ? projectCreditScore(score, outcome) : score;
    }, startingScore);
}

export function calculateCreditProfile(loans: Loan[], country: string | null | undefined, now = new Date()) {
  const base = getBaseCreditLine(country);
  const sorted = loans
    .filter((loan) => getRepaymentOutcome(loan))
    .slice()
    .sort((a, b) => new Date(eventDate(a)).getTime() - new Date(eventDate(b)).getTime());

  const lastPenaltyLoan = sorted
    .slice()
    .reverse()
    .find((loan) => {
      const outcome = getRepaymentOutcome(loan);
      return outcome === "late" || outcome === "bad";
    });

  const penaltyStartedAt = lastPenaltyLoan ? eventDate(lastPenaltyLoan) : null;
  const penaltyUntil = penaltyStartedAt ? addDays(penaltyStartedAt, PENALTY_DAYS) : null;
  const isInPenalty = Boolean(penaltyUntil && penaltyUntil.getTime() > now.getTime());
  const historyAfterPenalty = penaltyStartedAt
    ? sorted.filter((loan) => new Date(eventDate(loan)).getTime() > new Date(penaltyStartedAt).getTime())
    : sorted;

  const earlyPayments = historyAfterPenalty.filter((loan) => getRepaymentOutcome(loan) === "early").length;
  const onTimePayments = historyAfterPenalty.filter((loan) => getRepaymentOutcome(loan) === "on_time").length;
  const onTimeMilestones = Math.floor(onTimePayments / 3);
  const multiplier = isInPenalty ? 1 : Math.pow(1.2, onTimeMilestones) * Math.pow(1.4, earlyPayments);
  const currentLimit = Math.round(base.amount * multiplier);

  const onTimeMilestonesAfterNext = Math.floor((onTimePayments + 1) / 3);
  const onTimeLimit = Math.round(base.amount * Math.pow(1.2, onTimeMilestonesAfterNext) * Math.pow(1.4, earlyPayments));
  const earlyLimit = Math.round(base.amount * Math.pow(1.2, onTimeMilestones) * Math.pow(1.4, earlyPayments + 1));

  return {
    baseLimit: base.amount,
    currency: base.currency,
    currentLimit,
    earlyPayments,
    onTimePayments,
    onTimeCreditsUntilIncrease: Math.max(0, 3 - (onTimePayments % 3 || 3)),
    onTimeLimit: isInPenalty ? base.amount : onTimeLimit,
    earlyLimit: isInPenalty ? base.amount : earlyLimit,
    penaltyUntil: penaltyUntil?.toISOString() || null,
    isInPenalty,
    score: calculateCreditScoreFromLoans(sorted)
  };
}

export function getNextLimitProjection(scoreOrLoans: number | Loan[], country: string | null | undefined = "usa") {
  if (Array.isArray(scoreOrLoans)) {
    const profile = calculateCreditProfile(scoreOrLoans, country);
    return {
      current: profile.currentLimit,
      onTimeScore: profile.score,
      earlyScore: projectCreditScore(profile.score, "early"),
      onTimeLimit: profile.onTimeLimit,
      earlyLimit: profile.earlyLimit
    };
  }

  const profile = calculateCreditProfile([], country);
  return {
    current: profile.currentLimit,
    onTimeScore: projectCreditScore(scoreOrLoans, "on_time"),
    earlyScore: projectCreditScore(scoreOrLoans, "early"),
    onTimeLimit: profile.onTimeLimit,
    earlyLimit: profile.earlyLimit
  };
}
