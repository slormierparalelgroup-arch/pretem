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
