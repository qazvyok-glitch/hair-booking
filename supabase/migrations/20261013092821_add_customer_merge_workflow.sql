alter table public.customers
  add column if not exists is_active boolean not null default true,
  add column if not exists merged_into uuid references public.customers(id),
  add column if not exists merged_at timestamptz;

create index if not exists customers_active_phone_idx
  on public.customers (phone) where is_active;

create table if not exists public.customer_merge_logs (
  id uuid primary key default gen_random_uuid(),
  primary_customer_id uuid not null,
  duplicate_customer_id uuid not null,
  primary_before jsonb not null,
  duplicate_before jsonb not null,
  primary_after jsonb not null,
  booking_rows_before jsonb not null default '[]'::jsonb,
  note_rows_before jsonb not null default '[]'::jsonb,
  reason text not null,
  merged_by uuid not null,
  merged_by_username text not null,
  merged_at timestamptz not null default now(),
  reverted_at timestamptz,
  reverted_by uuid,
  status text not null default 'merged' check (status in ('merged', 'reverted'))
);

alter table public.customer_merge_logs enable row level security;

create policy "active admins read customer merge logs"
on public.customer_merge_logs for select
to authenticated
using (
  exists (
    select 1 from public.admin_profiles p
    where p.user_id = (select auth.uid()) and p.is_active
  )
);

revoke insert, update, delete on public.customer_merge_logs from anon, authenticated;
grant select on public.customer_merge_logs to authenticated;

create or replace function public.merge_customer_records(
  p_primary_id uuid,
  p_duplicate_id uuid,
  p_reason text
)
returns public.customer_merge_logs
language plpgsql
security definer
set search_path = ''
as $$
declare
  primary_row public.customers;
  duplicate_row public.customers;
  profile public.admin_profiles;
  primary_snapshot jsonb;
  duplicate_snapshot jsonb;
  booking_snapshot jsonb := '[]'::jsonb;
  note_snapshot jsonb := '[]'::jsonb;
  result public.customer_merge_logs;
  duplicate_phone text;
begin
  select p into profile from public.admin_profiles p
  where p.user_id = auth.uid() and p.is_active and p.role = 'owner' limit 1;
  if profile.user_id is null then raise exception 'permission denied'; end if;
  if p_primary_id = p_duplicate_id then raise exception 'SAME_CUSTOMER: 不能合併同一筆會員'; end if;
  if length(trim(coalesce(p_reason, ''))) < 4 then raise exception 'MERGE_REASON_REQUIRED: 請填寫至少 4 個字的合併原因'; end if;

  select * into primary_row from public.customers where id = p_primary_id for update;
  select * into duplicate_row from public.customers where id = p_duplicate_id for update;
  if primary_row.id is null or duplicate_row.id is null then raise exception 'CUSTOMER_NOT_FOUND: 找不到會員資料'; end if;
  if not primary_row.is_active or not duplicate_row.is_active then raise exception 'CUSTOMER_ALREADY_MERGED: 會員已停用或合併'; end if;

  if primary_row.line_user_id is not null and duplicate_row.line_user_id is not null and primary_row.line_user_id <> duplicate_row.line_user_id then
    raise exception 'LINE_ID_CONFLICT: 兩筆會員的 LINE 帳號不同，請先人工確認';
  end if;
  if primary_row.official_line_user_id is not null and duplicate_row.official_line_user_id is not null and primary_row.official_line_user_id <> duplicate_row.official_line_user_id then
    raise exception 'LINE_ID_CONFLICT: 兩筆會員的官方 LINE 綁定不同，請先人工確認';
  end if;

  primary_snapshot := to_jsonb(primary_row);
  duplicate_snapshot := to_jsonb(duplicate_row);
  duplicate_phone := regexp_replace(coalesce(duplicate_row.phone, ''), '\\D', '', 'g');

  if duplicate_phone <> '' then
    select coalesce(jsonb_agg(to_jsonb(b)), '[]'::jsonb) into booking_snapshot
    from public.bookings b
    where regexp_replace(coalesce(b.customer_phone, ''), '\\D', '', 'g') = duplicate_phone;

    select coalesce(jsonb_agg(to_jsonb(n)), '[]'::jsonb) into note_snapshot
    from public.customer_notes n
    where regexp_replace(coalesce(n.customer_phone, ''), '\\D', '', 'g') = duplicate_phone;

    perform set_config('app.booking_correction', 'unlock', true);
    update public.bookings
    set customer_name = coalesce(nullif(primary_row.name, ''), customer_name),
        customer_phone = coalesce(nullif(primary_row.phone, ''), customer_phone),
        customer_email = coalesce(nullif(primary_row.email, ''), customer_email)
    where regexp_replace(coalesce(customer_phone, ''), '\\D', '', 'g') = duplicate_phone;

    update public.customer_notes
    set customer_name = coalesce(nullif(primary_row.name, ''), customer_name),
        customer_phone = coalesce(nullif(primary_row.phone, ''), customer_phone)
    where regexp_replace(coalesce(customer_phone, ''), '\\D', '', 'g') = duplicate_phone;
  end if;

  update public.customers
  set name = coalesce(nullif(primary_row.name, ''), duplicate_row.name),
      phone = coalesce(nullif(primary_row.phone, ''), duplicate_row.phone),
      email = coalesce(nullif(primary_row.email, ''), duplicate_row.email),
      referrer = coalesce(nullif(primary_row.referrer, ''), duplicate_row.referrer),
      line_user_id = coalesce(primary_row.line_user_id, duplicate_row.line_user_id),
      official_line_user_id = coalesce(primary_row.official_line_user_id, duplicate_row.official_line_user_id),
      line_binding_code = coalesce(primary_row.line_binding_code, duplicate_row.line_binding_code),
      line_binding_expires_at = coalesce(primary_row.line_binding_expires_at, duplicate_row.line_binding_expires_at),
      line_bound_at = coalesce(primary_row.line_bound_at, duplicate_row.line_bound_at),
      updated_at = now()
  where id = primary_row.id
  returning * into primary_row;

  update public.customers
  set is_active = false, merged_into = primary_row.id, merged_at = now(), updated_at = now()
  where id = duplicate_row.id;

  insert into public.customer_merge_logs (
    primary_customer_id, duplicate_customer_id, primary_before, duplicate_before,
    primary_after, booking_rows_before, note_rows_before, reason,
    merged_by, merged_by_username
  ) values (
    primary_row.id, duplicate_row.id, primary_snapshot, duplicate_snapshot,
    to_jsonb(primary_row), booking_snapshot, note_snapshot, trim(p_reason),
    auth.uid(), profile.username
  ) returning * into result;

  return result;
end;
$$;

create or replace function public.revert_customer_merge(p_merge_id uuid)
returns public.customer_merge_logs
language plpgsql
security definer
set search_path = ''
as $$
declare
  merge_row public.customer_merge_logs;
  profile public.admin_profiles;
  item jsonb;
  result public.customer_merge_logs;
begin
  select p into profile from public.admin_profiles p
  where p.user_id = auth.uid() and p.is_active and p.role = 'owner' limit 1;
  if profile.user_id is null then raise exception 'permission denied'; end if;

  select * into merge_row from public.customer_merge_logs where id = p_merge_id for update;
  if merge_row.id is null then raise exception 'MERGE_NOT_FOUND: 找不到合併紀錄'; end if;
  if merge_row.status <> 'merged' then raise exception 'MERGE_ALREADY_REVERTED: 此合併已復原'; end if;
  if merge_row.merged_at < now() - interval '24 hours' then raise exception 'REVERT_WINDOW_EXPIRED: 已超過 24 小時復原期限'; end if;

  update public.customers set
    name = merge_row.primary_before->>'name', phone = merge_row.primary_before->>'phone',
    email = merge_row.primary_before->>'email', referrer = merge_row.primary_before->>'referrer',
    customer_no = merge_row.primary_before->>'customer_no', line_user_id = merge_row.primary_before->>'line_user_id',
    official_line_user_id = merge_row.primary_before->>'official_line_user_id',
    line_binding_code = merge_row.primary_before->>'line_binding_code',
    line_binding_expires_at = (merge_row.primary_before->>'line_binding_expires_at')::timestamptz,
    line_bound_at = (merge_row.primary_before->>'line_bound_at')::timestamptz,
    is_active = true, merged_into = null, merged_at = null, updated_at = now()
  where id = merge_row.primary_customer_id;

  update public.customers set
    name = merge_row.duplicate_before->>'name', phone = merge_row.duplicate_before->>'phone',
    email = merge_row.duplicate_before->>'email', referrer = merge_row.duplicate_before->>'referrer',
    customer_no = merge_row.duplicate_before->>'customer_no', line_user_id = merge_row.duplicate_before->>'line_user_id',
    official_line_user_id = merge_row.duplicate_before->>'official_line_user_id',
    line_binding_code = merge_row.duplicate_before->>'line_binding_code',
    line_binding_expires_at = (merge_row.duplicate_before->>'line_binding_expires_at')::timestamptz,
    line_bound_at = (merge_row.duplicate_before->>'line_bound_at')::timestamptz,
    is_active = true, merged_into = null, merged_at = null, updated_at = now()
  where id = merge_row.duplicate_customer_id;

  perform set_config('app.booking_correction', 'unlock', true);
  for item in select value from jsonb_array_elements(merge_row.booking_rows_before)
  loop
    update public.bookings set
      customer_name = item->>'customer_name', customer_phone = item->>'customer_phone',
      customer_email = item->>'customer_email'
    where id = (item->>'id')::integer;
  end loop;

  for item in select value from jsonb_array_elements(merge_row.note_rows_before)
  loop
    update public.customer_notes set
      customer_name = item->>'customer_name', customer_phone = item->>'customer_phone'
    where id = (item->>'id')::integer;
  end loop;

  update public.customer_merge_logs
  set status = 'reverted', reverted_at = now(), reverted_by = auth.uid()
  where id = merge_row.id
  returning * into result;
  return result;
end;
$$;

revoke all on function public.merge_customer_records(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.merge_customer_records(uuid, uuid, text) to authenticated;
revoke all on function public.revert_customer_merge(uuid) from public, anon, authenticated;
grant execute on function public.revert_customer_merge(uuid) to authenticated;
