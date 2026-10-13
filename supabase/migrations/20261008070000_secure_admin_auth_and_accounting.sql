create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  role text not null check (role in ('owner', 'manager')),
  role_name text not null,
  permissions jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_profiles enable row level security;
revoke all on public.admin_profiles from anon, authenticated;
grant select on public.admin_profiles to authenticated;
create policy "admins read own profile" on public.admin_profiles for select to authenticated
using (user_id = (select auth.uid()) and is_active);

create or replace function public.current_admin_profile()
returns public.admin_profiles
language sql stable security definer set search_path = ''
as $$ select p from public.admin_profiles p where p.user_id = auth.uid() and p.is_active limit 1 $$;
revoke all on function public.current_admin_profile() from public;
grant execute on function public.current_admin_profile() to authenticated;

drop policy if exists "settlement audit read" on public.settlement_audit_logs;
drop policy if exists "settlement audit append" on public.settlement_audit_logs;
revoke all on public.settlement_audit_logs from anon, authenticated;
grant select, insert on public.settlement_audit_logs to authenticated;
create policy "admins read settlement audit" on public.settlement_audit_logs for select to authenticated
using (exists (select 1 from public.admin_profiles p where p.user_id = (select auth.uid()) and p.is_active));
create policy "admins append settlement audit" on public.settlement_audit_logs for insert to authenticated
with check (exists (select 1 from public.admin_profiles p where p.user_id = (select auth.uid()) and p.is_active and p.username = admin_username));

drop policy if exists "import batches read" on public.import_batches;
drop policy if exists "import batches insert" on public.import_batches;
drop policy if exists "import batches update" on public.import_batches;
revoke all on public.import_batches from anon, authenticated;
grant select, insert, update on public.import_batches to authenticated;
create policy "admins read import batches" on public.import_batches for select to authenticated
using (exists (select 1 from public.admin_profiles p where p.user_id = (select auth.uid()) and p.is_active));
create policy "admins create import batches" on public.import_batches for insert to authenticated
with check (exists (select 1 from public.admin_profiles p where p.user_id = (select auth.uid()) and p.is_active and p.username = admin_username));
create policy "admins finalize import batches" on public.import_batches for update to authenticated
using (exists (select 1 from public.admin_profiles p where p.user_id = (select auth.uid()) and p.is_active) and status in ('completed', 'partial'))
with check (status in ('completed', 'partial') and reverted_at is null);

create or replace function public.revert_import_batch_secure(p_batch_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.admin_profiles; b public.import_batches;
begin
  select * into p from public.admin_profiles where user_id = auth.uid() and is_active;
  if p.user_id is null or not (p.role = 'owner' or p.permissions ? 'admin_accounts') then raise exception 'permission denied'; end if;
  select * into b from public.import_batches where id = p_batch_id for update;
  if b.id is null or b.status = 'reverted' then raise exception 'batch unavailable'; end if;
  if exists (select 1 from public.shop_info where key = any(array(select 'monthly_settlement_' || x from unnest(b.months) x))) then raise exception 'locked month'; end if;
  delete from public.transactions where import_batch_id = b.id;
  update public.import_batches set status='reverted', reverted_at=now(), reverted_by=p.username where id=b.id;
end $$;
revoke all on function public.revert_import_batch_secure(uuid) from public;
grant execute on function public.revert_import_batch_secure(uuid) to authenticated;

revoke all on public.admin_auth from anon, authenticated;
drop policy if exists "admin_auth_compat_select" on public.admin_auth;
drop policy if exists "admin_auth_compat_insert" on public.admin_auth;
drop policy if exists "admin_auth_compat_update" on public.admin_auth;
drop policy if exists "admin_auth_compat_delete" on public.admin_auth;
grant select, insert, update, delete on public.admin_auth to authenticated;
create policy "owners manage legacy admin accounts" on public.admin_auth for all to authenticated
using (exists (select 1 from public.admin_profiles p where p.user_id = (select auth.uid()) and p.is_active and p.role = 'owner'))
with check (exists (select 1 from public.admin_profiles p where p.user_id = (select auth.uid()) and p.is_active and p.role = 'owner'));
