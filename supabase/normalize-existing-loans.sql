alter table public.loans
add column if not exists destination_country text;

alter table public.loans
add column if not exists currency text;

alter table public.loans
add column if not exists payout_details jsonb not null default '{}'::jsonb;

alter table public.loans
add column if not exists repayment_days integer not null default 7 check (repayment_days in (7, 14, 21, 28));

alter table public.loans
add column if not exists interest_rate numeric not null default 0.10;

alter table public.loans
add column if not exists repayment_pause_status text not null default 'none' check (repayment_pause_status in ('none', 'pending', 'approved', 'rejected'));

alter table public.loans
add column if not exists repayment_pause_requested_days integer check (repayment_pause_requested_days between 1 and 14);

alter table public.loans
add column if not exists repayment_pause_reason text;

alter table public.loans
add column if not exists repayment_pause_requested_at timestamptz;

alter table public.loans
add column if not exists repayment_pause_reviewed_at timestamptz;

alter table public.loans
add column if not exists repayment_pause_until timestamptz;

alter table public.loans
add column if not exists disbursed_at timestamptz;

alter table public.loans
add column if not exists due_date timestamptz;

alter table public.loans
add column if not exists paid_at timestamptz;

alter table public.loans
add column if not exists repayment_review_status text not null default 'not_submitted' check (repayment_review_status in ('not_submitted', 'pending', 'accepted', 'rejected'));

alter table public.loans
add column if not exists repayment_submitted_at timestamptz;

alter table public.loans
add column if not exists repayment_submitted_amount numeric;

alter table public.loans
add column if not exists repayment_transfer_id text;

alter table public.loans
add column if not exists repayment_screenshot_url text;

alter table public.loans
add column if not exists rejected_at timestamptz;

alter table public.profiles
alter column credit_score type numeric using credit_score::numeric;

update public.loans l
set
  destination_country = coalesce(l.destination_country, p.country, 'haiti'),
  currency = coalesce(
    l.currency,
    case lower(coalesce(l.destination_country, p.country, 'haiti'))
      when 'usa' then 'USD'
      when 'mexico' then 'MXN'
      else 'HTG'
    end
  ),
  phone = coalesce(nullif(l.phone, ''), p.phone, l.phone),
  full_name = coalesce(nullif(l.full_name, ''), p.full_name, l.full_name),
  repayment_review_status = case
    when l.status = 'paid' and coalesce(l.repayment_review_status, 'not_submitted') = 'not_submitted' then 'accepted'
    else coalesce(l.repayment_review_status, 'not_submitted')
  end,
  repayment_pause_status = coalesce(l.repayment_pause_status, 'none'),
  payout_details = coalesce(l.payout_details, '{}'::jsonb),
  paid_at = case
    when l.status = 'paid' then coalesce(l.paid_at, l.repayment_submitted_at, l.due_date, l.created_at)
    else l.paid_at
  end,
  repayment_submitted_at = case
    when l.status = 'paid' then coalesce(l.repayment_submitted_at, l.paid_at, l.due_date, l.created_at)
    else l.repayment_submitted_at
  end,
  rejected_at = case
    when l.status = 'rejected' then coalesce(l.rejected_at, l.created_at)
    else l.rejected_at
  end
from public.profiles p
where p.id = l.user_id;

update public.loans l
set
  disbursed_at = coalesce(l.disbursed_at, l.created_at),
  due_date = coalesce(l.due_date, coalesce(l.disbursed_at, l.created_at) + make_interval(days => coalesce(l.repayment_days, 7)))
where l.status in ('approved', 'paid')
  and (l.disbursed_at is not null or l.disbursement_transfer_id is not null or l.status = 'paid');

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
