create table if not exists public.atlas_drafts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 payload jsonb not null check (jsonb_typeof(payload) = 'object'),
 revision bigint not null default 1,
 updated_at timestamptz not null default now()
);
alter table public.atlas_drafts enable row level security;
revoke all on public.atlas_drafts from anon, authenticated;
grant select, insert, update on public.atlas_drafts to authenticated;
create policy "Read own atlas" on public.atlas_drafts for select to authenticated using ((select auth.uid())=user_id);
create policy "Insert own atlas" on public.atlas_drafts for insert to authenticated with check ((select auth.uid())=user_id);
create policy "Update own atlas" on public.atlas_drafts for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create or replace function public.save_atlas_draft(draft jsonb, expected_revision bigint)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare new_revision bigint;
begin
 if auth.uid() is null then raise exception 'Not authenticated'; end if;
 if expected_revision = 0 then
  insert into public.atlas_drafts(user_id,payload) values(auth.uid(),draft)
  on conflict(user_id) do nothing returning revision into new_revision;
 else
  update public.atlas_drafts set payload=draft, revision=revision+1,updated_at=now()
  where user_id=auth.uid() and revision=expected_revision returning revision into new_revision;
 end if;
 if new_revision is null then raise exception 'Cloud draft changed; reload before saving' using errcode='40001'; end if;
 return new_revision;
end $$;
revoke all on function public.save_atlas_draft(jsonb,bigint) from public,anon;
grant execute on function public.save_atlas_draft(jsonb,bigint) to authenticated;
