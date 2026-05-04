create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  country text,
  phone text,
  role text not null default 'user' check (role in ('user', 'admin')),
  credit_score integer not null default 500,
  verification_status text not null default 'not_submitted' check (verification_status in ('not_submitted', 'pending', 'verified', 'rejected')),
  id_photo_url text,
  selfie_url text,
  selfie_with_id_url text,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles
add column if not exists verification_status text not null default 'not_submitted' check (verification_status in ('not_submitted', 'pending', 'verified', 'rejected'));

alter table public.profiles
add column if not exists full_name text;

alter table public.profiles
add column if not exists country text;

alter table public.profiles
add column if not exists phone text;

alter table public.profiles
add column if not exists id_photo_url text;

alter table public.profiles
add column if not exists selfie_url text;

alter table public.profiles
add column if not exists selfie_with_id_url text;

alter table public.profiles
add column if not exists verified_at timestamptz;

create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  phone text not null,
  amount numeric not null check (amount > 0),
  repayment numeric not null check (repayment >= amount),
  destination_country text,
  currency text,
  payout_method text,
  payout_details jsonb not null default '{}'::jsonb,
  repayment_days integer not null default 7 check (repayment_days in (7, 14, 21, 28)),
  interest_rate numeric not null default 0.10 check (interest_rate in (0.10, 0.19, 0.28, 0.36)),
  reference text not null unique,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'paid', 'canceled')),
  id_photo_url text,
  selfie_url text,
  selfie_with_id_url text,
  terms_accepted boolean not null default false,
  terms_accepted_at timestamptz,
  agreement_version text,
  credit_reporting_acknowledged boolean not null default false,
  public_story_consent boolean not null default false,
  disbursement_transfer_id text,
  disbursed_at timestamptz,
  repayment_transfer_id text,
  repayment_submitted_at timestamptz,
  due_date timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.loans
add column if not exists repayment_days integer not null default 7 check (repayment_days in (7, 14, 21, 28));

alter table public.loans
add column if not exists interest_rate numeric not null default 0.10 check (interest_rate in (0.10, 0.19, 0.28, 0.36));

alter table public.loans
add column if not exists destination_country text;

alter table public.loans
add column if not exists currency text;

alter table public.loans
add column if not exists payout_method text;

alter table public.loans
add column if not exists payout_details jsonb not null default '{}'::jsonb;

alter table public.loans
add column if not exists terms_accepted boolean not null default false;

alter table public.loans
add column if not exists terms_accepted_at timestamptz;

alter table public.loans
add column if not exists agreement_version text;

alter table public.loans
add column if not exists credit_reporting_acknowledged boolean not null default false;

alter table public.loans
add column if not exists public_story_consent boolean not null default false;

alter table public.loans
add column if not exists disbursement_transfer_id text;

alter table public.loans
add column if not exists disbursed_at timestamptz;

alter table public.loans
add column if not exists repayment_transfer_id text;

alter table public.loans
add column if not exists repayment_submitted_at timestamptz;

alter table public.loans
drop constraint if exists loans_status_check;

alter table public.loans
add constraint loans_status_check check (status in ('pending', 'approved', 'rejected', 'paid', 'canceled'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, country, phone)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'country',
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.loans enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.save_profile_info(
  profile_full_name text,
  profile_country text,
  profile_phone text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, country, phone)
  values (auth.uid(), auth.jwt() ->> 'email', profile_full_name, profile_country, profile_phone)
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = excluded.full_name,
    country = excluded.country,
    phone = excluded.phone;
end;
$$;

revoke all on function public.save_profile_info(text, text, text) from public;
grant execute on function public.save_profile_info(text, text, text) to authenticated;

create or replace function public.submit_identity_verification(
  id_photo_path text,
  selfie_path text,
  selfie_with_id_path text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (auth.uid(), auth.jwt() ->> 'email')
  on conflict (id) do nothing;

  update public.profiles
  set
    id_photo_url = id_photo_path,
    selfie_url = selfie_path,
    selfie_with_id_url = selfie_with_id_path,
    verification_status = 'pending',
    verified_at = null
  where id = auth.uid();
end;
$$;

revoke all on function public.submit_identity_verification(text, text, text) from public;
grant execute on function public.submit_identity_verification(text, text, text) to authenticated;

create or replace function public.cancel_pending_loan(loan_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.loans
  set status = 'canceled'
  where id = loan_id
    and user_id = auth.uid()
    and status = 'pending';
end;
$$;

revoke all on function public.cancel_pending_loan(uuid) from public;
grant execute on function public.cancel_pending_loan(uuid) to authenticated;

create or replace function public.submit_loan_repayment(
  loan_id uuid,
  transfer_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.loans
  set
    repayment_transfer_id = nullif(trim(transfer_id), ''),
    repayment_submitted_at = now()
  where id = loan_id
    and user_id = auth.uid()
    and status = 'approved';
end;
$$;

revoke all on function public.submit_loan_repayment(uuid, text) from public;
grant execute on function public.submit_loan_repayment(uuid, text) to authenticated;

drop policy if exists "Users can read their profile" on public.profiles;
create policy "Users can read their profile"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "Admins can update profiles" on public.profiles;
create policy "Admins can update profiles"
on public.profiles for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Users can create their loans" on public.loans;
create policy "Users can create their loans"
on public.loans for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can read own loans or admins can read all" on public.loans;
create policy "Users can read own loans or admins can read all"
on public.loans for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Public can check by reference" on public.loans;
create policy "Public can check by reference"
on public.loans for select
to anon
using (true);

drop policy if exists "Admins can update loans" on public.loans;
create policy "Admins can update loans"
on public.loans for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into storage.buckets (id, name, public)
values ('selfies', 'selfies', false)
on conflict (id) do update set public = false;

drop policy if exists "Users upload verification images" on storage.objects;
create policy "Users upload verification images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'selfies' and owner = auth.uid());

drop policy if exists "Users update verification images" on storage.objects;
create policy "Users update verification images"
on storage.objects for update
to authenticated
using (bucket_id = 'selfies' and owner = auth.uid())
with check (bucket_id = 'selfies' and owner = auth.uid());

drop policy if exists "Public reads verification images" on storage.objects;
drop policy if exists "Users and admins read verification images" on storage.objects;
create policy "Users and admins read verification images"
on storage.objects for select
to authenticated
using (bucket_id = 'selfies' and (owner = auth.uid() or public.is_admin()));
