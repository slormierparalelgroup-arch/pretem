create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create or replace function public.notify_user(
  target_user_id uuid,
  notification_title text,
  notification_body text default null,
  notification_link text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if auth.uid() <> target_user_id and not public.is_admin() then
    raise exception 'Not allowed.';
  end if;

  insert into public.notifications (user_id, title, body, link)
  values (target_user_id, notification_title, notification_body, notification_link);
end;
$$;

revoke all on function public.notify_user(uuid, text, text, text) from public;
grant execute on function public.notify_user(uuid, text, text, text) to authenticated;

create or replace function public.notify_admins(
  notification_title text,
  notification_body text default null,
  notification_link text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  insert into public.notifications (user_id, title, body, link)
  select id, notification_title, notification_body, notification_link
  from public.profiles
  where role = 'admin';
end;
$$;

revoke all on function public.notify_admins(text, text, text) from public;
grant execute on function public.notify_admins(text, text, text) to authenticated;

drop policy if exists "Users read their notifications" on public.notifications;
create policy "Users read their notifications"
on public.notifications for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users update their notifications" on public.notifications;
create policy "Users update their notifications"
on public.notifications for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
