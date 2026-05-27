create table if not exists public.credit_limit_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  country text not null default 'haiti',
  currency text not null default 'HTG',
  requested_amount numeric not null check (requested_amount > 0),
  approved_amount numeric check (approved_amount > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.credit_limit_requests enable row level security;

drop policy if exists "Users create own credit limit requests" on public.credit_limit_requests;
create policy "Users create own credit limit requests"
on public.credit_limit_requests for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users read own credit limit requests or admins read all" on public.credit_limit_requests;
create policy "Users read own credit limit requests or admins read all"
on public.credit_limit_requests for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Admins update credit limit requests" on public.credit_limit_requests;
create policy "Admins update credit limit requests"
on public.credit_limit_requests for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create index if not exists credit_limit_requests_user_created_idx
on public.credit_limit_requests (user_id, created_at desc);

create index if not exists credit_limit_requests_status_created_idx
on public.credit_limit_requests (status, created_at desc);
