import { DestinationCountry } from "@/lib/payout";
import { getEffectiveDueDate, Loan } from "@/lib/loans";

export const CREDIT_MIN = 0;
export const STARTING_CREDIT_SCORE = 0;
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
  return Math.max(CREDIT_MIN, Number(score.toFixed(1)));
}

export function projectCreditScore(score: number, outcome: CreditOutcome) {
  if (outcome === "early" || outcome === "on_time") {
    return score === 0 ? 10 : score;
  }

  return 0;
}

function eventDate(loan: Loan) {
  return loan.repayment_submitted_at || loan.paid_at || loan.rejected_at || loan.created_at;
}

function addDays(value: string, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function paymentsUntilNextMilestone(count: number) {
  const remainder = count % 3;
  return remainder === 0 ? 3 : 3 - remainder;
}

function daysAfter(date: Date, now = new Date()) {
  const diffMs = now.getTime() - date.getTime();
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

export function getRepaymentOutcome(loan: Loan): CreditOutcome | null {
  if (loan.repayment_review_status === "rejected" || loan.status === "rejected") return "bad";
  if (loan.status !== "paid" || loan.repayment_review_status !== "accepted") return null;

  const dueDateValue = getEffectiveDueDate(loan);
  if (!dueDateValue) return "on_time";

  const submittedAt = loan.repayment_submitted_at || loan.paid_at;
  if (!submittedAt) return "on_time";

  const submittedDate = new Date(submittedAt).getTime();
  const dueDate = dueDateValue.getTime();
  const oneDay = 24 * 60 * 60 * 1000;

  if (submittedDate < dueDate - oneDay) return "early";
  if (submittedDate <= dueDate) return "on_time";
  return "late";
}

export function getGoodPaidLoanCount(loans: Loan[]) {
  return loans.filter((loan) => {
    const outcome = getRepaymentOutcome(loan);
    return outcome === "early" || outcome === "on_time";
  }).length;
}

export function canRequestRepaymentPause(loans: Loan[], loan: Loan, now = new Date()) {
  if (loan.status !== "approved" || loan.repayment_transfer_id) return false;
  if (loan.repayment_pause_status === "pending" || loan.repayment_pause_status === "approved") return false;
  if (getGoodPaidLoanCount(loans) < 6) return false;

  const dueDate = getEffectiveDueDate(loan);
  return Boolean(dueDate && now.getTime() > dueDate.getTime());
}

export function calculateCreditScoreFromLoans(loans: Loan[], startingScore = STARTING_CREDIT_SCORE) {
  const sorted = loans
    .slice()
    .sort((a, b) => new Date(eventDate(a)).getTime() - new Date(eventDate(b)).getTime());

  let score = startingScore;
  let goodPayments = 0;

  for (const loan of sorted) {
    if (loan.repayment_pause_requested_at) score -= 5;

    const outcome = getRepaymentOutcome(loan);
    if (outcome === "early" || outcome === "on_time") {
      goodPayments += 1;
      if (score === 0) score = 10;
      if (goodPayments > 1 && goodPayments % 3 === 0) score += 5;
    }

    if (outcome === "late" || outcome === "bad") {
      score = goodPayments >= 6 ? score * 0.9 : 0;
    }
  }

  return clampCreditScore(score);
}

export function calculateCreditProfile(loans: Loan[], country: string | null | undefined, now = new Date()) {
  const base = getBaseCreditLine(country);
  const sorted = loans
    .slice()
    .sort((a, b) => new Date(eventDate(a)).getTime() - new Date(eventDate(b)).getTime());

  const lastPenaltyLoan = sorted
    .slice()
    .reverse()
    .find((loan) => {
      const outcome = getRepaymentOutcome(loan);
      return outcome === "late" || outcome === "bad";
    });

  const matureBorrower = getGoodPaidLoanCount(sorted) >= 6;
  const penaltyStartedAt = lastPenaltyLoan && !matureBorrower ? eventDate(lastPenaltyLoan) : null;
  const penaltyUntil = penaltyStartedAt ? addDays(penaltyStartedAt, PENALTY_DAYS) : null;
  const activeOverdueLoan = sorted.find((loan) => {
    if (loan.status !== "approved" || !loan.disbursed_at || loan.repayment_transfer_id) return false;
    const dueDate = getEffectiveDueDate(loan);
    if (!dueDate) return false;
    const graceDays = matureBorrower && loan.repayment_pause_status !== "approved" ? 3 : 0;
    const penaltyDate = new Date(dueDate);
    penaltyDate.setDate(penaltyDate.getDate() + graceDays);
    return penaltyDate.getTime() < now.getTime();
  });
  const isInPenalty = Boolean(!matureBorrower && penaltyUntil && penaltyUntil.getTime() > now.getTime());
  const historyAfterPenalty =
    penaltyStartedAt && !matureBorrower ? sorted.filter((loan) => new Date(eventDate(loan)).getTime() > new Date(penaltyStartedAt).getTime()) : sorted;

  const earlyPayments = historyAfterPenalty.filter((loan) => getRepaymentOutcome(loan) === "early").length;
  const onTimePayments = historyAfterPenalty.filter((loan) => getRepaymentOutcome(loan) === "on_time").length;
  const goodPayments = earlyPayments + onTimePayments;
  const onTimeMilestones = Math.floor(onTimePayments / 3);
  const earlyMilestones = Math.floor(earlyPayments / 3);
  const badBehaviors = sorted.filter((loan) => {
    const outcome = getRepaymentOutcome(loan);
    return outcome === "late" || outcome === "bad";
  }).length + (activeOverdueLoan ? 1 : 0);
  const maturePenaltyMultiplier = matureBorrower ? Math.pow(0.9, badBehaviors) : 1;
  const multiplier = isInPenalty ? 1 : Math.pow(1.2, onTimeMilestones) * Math.pow(1.3, earlyMilestones) * maturePenaltyMultiplier;
  const currentLimit = Math.round(base.amount * multiplier);

  const onTimeMilestonesAfterNext = onTimeMilestones + 1;
  const earlyMilestonesAfterNext = earlyMilestones + 1;
  const onTimeLimit = Math.round(base.amount * Math.pow(1.2, onTimeMilestonesAfterNext) * Math.pow(1.3, earlyMilestones));
  const earlyLimit = Math.round(base.amount * Math.pow(1.2, onTimeMilestones) * Math.pow(1.3, earlyMilestonesAfterNext));

  let score = calculateCreditScoreFromLoans(sorted);
  if (activeOverdueLoan && matureBorrower) {
    score = score * 0.9;
    if (activeOverdueLoan.repayment_pause_status === "approved" && activeOverdueLoan.repayment_pause_until) {
      score -= daysAfter(new Date(activeOverdueLoan.repayment_pause_until), now) * 0.5;
    }
  }

  return {
    baseLimit: base.amount,
    currency: base.currency,
    currentLimit,
    earlyPayments,
    goodPayments,
    onTimePayments,
    onTimeCreditsUntilIncrease: paymentsUntilNextMilestone(onTimePayments),
    earlyCreditsUntilIncrease: paymentsUntilNextMilestone(earlyPayments),
    onTimeLimit: isInPenalty ? base.amount : onTimeLimit,
    earlyLimit: isInPenalty ? base.amount : earlyLimit,
    penaltyUntil: penaltyUntil?.toISOString() || null,
    isInPenalty,
    canRequestPause: Boolean(activeOverdueLoan && matureBorrower),
    score: clampCreditScore(score)
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
