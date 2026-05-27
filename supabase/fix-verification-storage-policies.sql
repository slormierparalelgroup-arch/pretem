insert into storage.buckets (id, name, public)
values ('selfies', 'selfies', false)
on conflict (id) do update set public = false;

drop policy if exists "Users upload verification images" on storage.objects;
create policy "Users upload verification images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'selfies'
  and (
    owner = auth.uid()
    or (storage.foldername(name))[1] = auth.uid()::text
  )
);

drop policy if exists "Users update verification images" on storage.objects;
create policy "Users update verification images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'selfies'
  and (
    owner = auth.uid()
    or (storage.foldername(name))[1] = auth.uid()::text
  )
)
with check (
  bucket_id = 'selfies'
  and (
    owner = auth.uid()
    or (storage.foldername(name))[1] = auth.uid()::text
  )
);

drop policy if exists "Public reads verification images" on storage.objects;
drop policy if exists "Users and admins read verification images" on storage.objects;
create policy "Users and admins read verification images"
on storage.objects for select
to authenticated
using (
  bucket_id = 'selfies'
  and (
    owner = auth.uid()
    or (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
);

drop policy if exists "Admins delete denied verification images" on storage.objects;
create policy "Admins delete denied verification images"
on storage.objects for delete
to authenticated
using (bucket_id = 'selfies' and public.is_admin());
