create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('user', 'admin')),
  credit_score integer not null default 500,
  created_at timestamptz not null default now()
);

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
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'paid')),
  id_photo_url text,
  selfie_url text,
  selfie_with_id_url text,
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

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
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
