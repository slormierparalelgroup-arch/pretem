with ordered_loans as (
  select
    id,
    amount,
    coalesce(repayment_days, 7) as repayment_days,
    row_number() over (partition by user_id order by created_at asc, id asc) as loan_number
  from public.loans
  where status <> 'canceled'
),
calculated_terms as (
  select
    id,
    case repayment_days
      when 7 then 0.10
      when 14 then 0.19
      when 21 then 0.28
      else 0.36
    end
    + case
      when loan_number <= 6 then 0.15
      when loan_number <= 20 then 0.10
      else 0
    end as normalized_interest_rate,
    amount
  from ordered_loans
)
update public.loans l
set
  interest_rate = round(c.normalized_interest_rate, 3),
  repayment = round(c.amount * (1 + c.normalized_interest_rate), 2)
from calculated_terms c
where c.id = l.id
  and l.status in ('pending', 'approved')
  and (
    l.interest_rate is null
    or l.interest_rate <> round(c.normalized_interest_rate, 3)
    or l.repayment is null
    or l.repayment <> round(c.amount * (1 + c.normalized_interest_rate), 2)
  );

update public.profiles p
set credit_score = 0
where not exists (
  select 1
  from public.loans l
  where l.user_id = p.id
    and l.status = 'paid'
    and l.repayment_review_status = 'accepted'
);
