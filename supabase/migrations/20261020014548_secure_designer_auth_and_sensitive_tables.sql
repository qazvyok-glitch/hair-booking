alter table public.designer_auth
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create unique index if not exists designer_auth_user_id_unique
  on public.designer_auth(user_id) where user_id is not null;

create or replace function public.is_current_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_profiles p
    where p.user_id = auth.uid() and p.is_active
  );
$$;

create or replace function public.current_designer_id()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select da.designer_id
  from public.designer_auth da
  join public.designers d on d.id = da.designer_id
  where da.user_id = auth.uid() and d.is_active and d.status = 'active'
  limit 1;
$$;

create or replace function public.is_current_designer_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select d.is_manager
    from public.designer_auth da
    join public.designers d on d.id = da.designer_id
    where da.user_id = auth.uid() and d.is_active and d.status = 'active'
    limit 1
  ), false);
$$;

revoke all on function public.is_current_admin() from public, anon, authenticated;
revoke all on function public.current_designer_id() from public, anon, authenticated;
revoke all on function public.is_current_designer_manager() from public, anon, authenticated;

create or replace function public.current_designer_profile()
returns table (designer_id integer, name text, nickname text, is_manager boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.name, d.nickname, coalesce(d.is_manager, false)
  from public.designer_auth da
  join public.designers d on d.id = da.designer_id
  where da.user_id = auth.uid() and d.is_active and d.status = 'active'
  limit 1;
$$;

revoke all on function public.current_designer_profile() from public, anon, authenticated;
grant execute on function public.current_designer_profile() to authenticated;

drop policy if exists designer_auth_compat_select on public.designer_auth;
drop policy if exists designer_auth_compat_insert on public.designer_auth;
drop policy if exists designer_auth_compat_update on public.designer_auth;
drop policy if exists designer_auth_compat_delete on public.designer_auth;
create policy "admins manage designer authentication"
on public.designer_auth for all to authenticated
using ((select public.is_current_admin()))
with check ((select public.is_current_admin()));

drop policy if exists transactions_compat_insert on public.transactions;
drop policy if exists transactions_compat_update on public.transactions;
drop policy if exists transactions_compat_delete on public.transactions;
create policy "admins manage transactions"
on public.transactions for all to authenticated
using ((select public.is_current_admin()))
with check ((select public.is_current_admin()));
create policy "designers manage permitted transactions"
on public.transactions for all to authenticated
using ((select public.is_current_designer_manager()) or designer_id = (select public.current_designer_id()))
with check ((select public.is_current_designer_manager()) or designer_id = (select public.current_designer_id()));

drop policy if exists product_usage_compat_insert on public.product_usage;
drop policy if exists product_usage_compat_update on public.product_usage;
drop policy if exists product_usage_compat_delete on public.product_usage;
create policy "admins manage product usage"
on public.product_usage for all to authenticated
using ((select public.is_current_admin()))
with check ((select public.is_current_admin()));
create policy "designers manage permitted product usage"
on public.product_usage for all to authenticated
using ((select public.is_current_designer_manager()) or designer_id = (select public.current_designer_id()))
with check ((select public.is_current_designer_manager()) or designer_id = (select public.current_designer_id()));

drop policy if exists material_usage_compat_insert on public.material_usage;
drop policy if exists material_usage_compat_update on public.material_usage;
drop policy if exists material_usage_compat_delete on public.material_usage;
create policy "admins manage material usage"
on public.material_usage for all to authenticated
using ((select public.is_current_admin()))
with check ((select public.is_current_admin()));
create policy "designers manage permitted material usage"
on public.material_usage for all to authenticated
using ((select public.is_current_designer_manager()) or designer_id = (select public.current_designer_id()))
with check ((select public.is_current_designer_manager()) or designer_id = (select public.current_designer_id()));

drop policy if exists products_compat_insert on public.products;
drop policy if exists products_compat_update on public.products;
drop policy if exists products_compat_delete on public.products;
create policy "staff manage products"
on public.products for all to authenticated
using ((select public.is_current_admin()) or (select public.current_designer_id()) is not null)
with check ((select public.is_current_admin()) or (select public.current_designer_id()) is not null);

drop policy if exists stock_records_compat_insert on public.stock_records;
drop policy if exists stock_records_compat_update on public.stock_records;
drop policy if exists stock_records_compat_delete on public.stock_records;
create policy "staff manage stock records"
on public.stock_records for all to authenticated
using ((select public.is_current_admin()) or (select public.current_designer_id()) is not null)
with check ((select public.is_current_admin()) or (select public.current_designer_id()) is not null);

drop policy if exists designers_compat_insert on public.designers;
drop policy if exists designers_compat_update on public.designers;
drop policy if exists designers_compat_delete on public.designers;
create policy "admins manage designers"
on public.designers for all to authenticated
using ((select public.is_current_admin()))
with check ((select public.is_current_admin()));
