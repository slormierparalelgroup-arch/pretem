import { Loan } from "@/lib/loans";

export const CREDIT_MIN = 300;
export const CREDIT_MAX = 850;
export const STARTING_CREDIT_SCORE = 500;

export type CreditOutcome = "early" | "on_time" | "late" | "bad";

export function clampCreditScore(score: number) {
  return Math.max(CREDIT_MIN, Math.min(CREDIT_MAX, Math.round(score)));
}

export function calculateCreditLimit(score: number) {
  if (score >= 800) return 1000;
  if (score >= 750) return 800;
  if (score >= 700) return 600;
  if (score >= 650) return 400;
  if (score >= 600) return 250;
  if (score >= 550) return 150;
  if (score >= 500) return 100;
  return 50;
}

export function creditScoreDelta(outcome: CreditOutcome) {
  if (outcome === "early") return 40;
  if (outcome === "on_time") return 25;
  if (outcome === "late") return -25;
  return -50;
}

export function projectCreditScore(score: number, outcome: CreditOutcome) {
  return clampCreditScore(score + creditScoreDelta(outcome));
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
  return loans.reduce((score, loan) => {
    const outcome = getRepaymentOutcome(loan);
    return outcome ? projectCreditScore(score, outcome) : score;
  }, startingScore);
}

export function getNextLimitProjection(score: number) {
  return {
    current: calculateCreditLimit(score),
    onTimeScore: projectCreditScore(score, "on_time"),
    earlyScore: projectCreditScore(score, "early"),
    onTimeLimit: calculateCreditLimit(projectCreditScore(score, "on_time")),
    earlyLimit: calculateCreditLimit(projectCreditScore(score, "early"))
  };
}
