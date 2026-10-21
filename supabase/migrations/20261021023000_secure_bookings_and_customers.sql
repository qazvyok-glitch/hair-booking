alter table public.bookings
  add column if not exists public_access_token uuid not null default gen_random_uuid();

create unique index if not exists bookings_public_access_token_idx
  on public.bookings (public_access_token);

revoke all on public.bookings from anon;
revoke all on public.customers from anon;

drop policy if exists bookings_compat_select on public.bookings;
drop policy if exists bookings_compat_insert on public.bookings;
drop policy if exists bookings_compat_update on public.bookings;
drop policy if exists bookings_compat_delete on public.bookings;
drop policy if exists customers_compat_select on public.customers;
drop policy if exists customers_compat_insert on public.customers;
drop policy if exists customers_compat_update on public.customers;
drop policy if exists customers_compat_delete on public.customers;
drop policy if exists "staff and members read permitted bookings" on public.bookings;
drop policy if exists "staff create bookings" on public.bookings;
drop policy if exists "staff and members update permitted bookings" on public.bookings;
drop policy if exists "admins delete bookings" on public.bookings;
drop policy if exists "staff read permitted customers" on public.customers;
drop policy if exists "members create own customer profile" on public.customers;
drop policy if exists "staff and members update permitted customers" on public.customers;
drop policy if exists "admins delete customers" on public.customers;

create policy "staff and members read permitted bookings"
on public.bookings for select to authenticated
using (
  (select public.is_current_admin())
  or (select public.is_current_designer_manager())
  or designer_id = (select public.current_designer_id())
  or user_id = (select auth.uid())
);

create policy "staff create bookings"
on public.bookings for insert to authenticated
with check (
  (select public.is_current_admin())
  or (select public.is_current_designer_manager())
  or designer_id = (select public.current_designer_id())
  or user_id = (select auth.uid())
);

create policy "staff and members update permitted bookings"
on public.bookings for update to authenticated
using (
  (select public.is_current_admin())
  or (select public.is_current_designer_manager())
  or designer_id = (select public.current_designer_id())
  or user_id = (select auth.uid())
)
with check (
  (select public.is_current_admin())
  or (select public.is_current_designer_manager())
  or designer_id = (select public.current_designer_id())
  or user_id = (select auth.uid())
);

create policy "admins delete bookings"
on public.bookings for delete to authenticated
using ((select public.is_current_admin()));

create policy "staff read permitted customers"
on public.customers for select to authenticated
using (
  (select public.is_current_admin())
  or (select public.is_current_designer_manager())
  or id = (select auth.uid())
  or exists (
    select 1 from public.bookings b
    where b.customer_phone = customers.phone
      and b.designer_id = (select public.current_designer_id())
  )
);

create policy "members create own customer profile"
on public.customers for insert to authenticated
with check (
  (select public.is_current_admin())
  or (select public.is_current_designer_manager())
  or (select public.current_designer_id()) is not null
  or id = (select auth.uid())
);

create policy "staff and members update permitted customers"
on public.customers for update to authenticated
using (
  (select public.is_current_admin())
  or (select public.is_current_designer_manager())
  or id = (select auth.uid())
  or exists (
    select 1 from public.bookings b
    where b.customer_phone = customers.phone
      and b.designer_id = (select public.current_designer_id())
  )
)
with check (
  (select public.is_current_admin())
  or (select public.is_current_designer_manager())
  or id = (select auth.uid())
  or exists (
    select 1 from public.bookings b
    where b.customer_phone = customers.phone
      and b.designer_id = (select public.current_designer_id())
  )
);

create policy "admins delete customers"
on public.customers for delete to authenticated
using ((select public.is_current_admin()));

create or replace function public.get_public_booking_slots(
  p_designer_id integer,
  p_start_date date,
  p_end_date date
)
returns table (
  designer_id integer,
  booking_date date,
  booking_time text,
  duration_minutes integer,
  service_ids integer[],
  status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.designer_id, b.booking_date, b.booking_time,
         b.duration_minutes, b.service_ids, b.status
  from public.bookings b
  where b.designer_id = p_designer_id
    and b.booking_date between greatest(p_start_date, current_date)
                           and least(p_end_date, current_date + 120)
    and b.status in ('pending', 'confirmed', 'completed');
$$;

create or replace function public.issue_booking_line_binding(
  p_booking_id integer,
  p_access_token uuid
)
returns table (already_bound boolean, binding_code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_booking public.bookings;
  target_customer public.customers;
  new_code text;
  new_expiry timestamptz := now() + interval '30 minutes';
begin
  select * into target_booking
  from public.bookings b
  where b.id = p_booking_id and b.public_access_token = p_access_token;

  if target_booking.id is null then
    raise exception 'BOOKING_ACCESS_DENIED';
  end if;

  select * into target_customer
  from public.customers c
  where c.is_active
    and regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') =
        regexp_replace(coalesce(target_booking.customer_phone, ''), '\D', '', 'g')
  order by c.updated_at desc nulls last
  limit 1;

  if target_customer.id is null then
    insert into public.customers (name, phone)
    values (target_booking.customer_name, target_booking.customer_phone)
    returning * into target_customer;
  end if;

  if target_customer.official_line_user_id is not null then
    return query select true, null::text, null::timestamptz;
    return;
  end if;

  new_code := 'BC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 24));
  update public.customers
  set line_binding_code = new_code,
      line_binding_expires_at = new_expiry,
      updated_at = now()
  where id = target_customer.id;

  return query select false, new_code, new_expiry;
end;
$$;

create or replace function public.bind_line_user_by_code(
  p_binding_code text,
  p_official_line_user_id text
)
returns table (customer_id uuid, customer_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_customer public.customers;
begin
  if p_binding_code !~ '^BC-[A-F0-9]{24}$'
     or length(trim(coalesce(p_official_line_user_id, ''))) not between 8 and 128 then
    return;
  end if;

  select * into target_customer
  from public.customers c
  where c.is_active
    and upper(c.line_binding_code) = upper(p_binding_code)
    and c.line_binding_expires_at > now()
  limit 1;

  if target_customer.id is null then
    return;
  end if;

  update public.customers
  set official_line_user_id = trim(p_official_line_user_id),
      line_bound_at = now(),
      line_binding_code = null,
      line_binding_expires_at = null,
      updated_at = now()
  where id = target_customer.id;

  return query select target_customer.id, target_customer.name;
end;
$$;

create or replace function public.bind_booking_line_user(
  p_booking_id integer,
  p_access_token uuid,
  p_official_line_user_id text
)
returns table (customer_id uuid, already_bound boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_booking public.bookings;
  target_customer public.customers;
  was_bound boolean;
begin
  if length(trim(coalesce(p_official_line_user_id, ''))) not between 8 and 128 then
    raise exception 'INVALID_LINE_USER';
  end if;

  select * into target_booking
  from public.bookings b
  where b.id = p_booking_id and b.public_access_token = p_access_token;

  if target_booking.id is null then
    raise exception 'BOOKING_ACCESS_DENIED';
  end if;

  select * into target_customer
  from public.customers c
  where c.is_active
    and regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') =
        regexp_replace(coalesce(target_booking.customer_phone, ''), '\D', '', 'g')
  order by (c.official_line_user_id is not null) desc, c.updated_at desc nulls last
  limit 1;

  if target_customer.id is null then
    insert into public.customers (name, phone)
    values (target_booking.customer_name, target_booking.customer_phone)
    returning * into target_customer;
  end if;

  was_bound := target_customer.official_line_user_id is not null;
  update public.customers
  set name = target_booking.customer_name,
      phone = target_booking.customer_phone,
      official_line_user_id = trim(p_official_line_user_id),
      line_bound_at = now(),
      line_binding_code = null,
      line_binding_expires_at = null,
      updated_at = now()
  where id = target_customer.id;

  return query select target_customer.id, was_bound;
end;
$$;

create or replace function public.get_booking_notification_payload(
  p_booking_id integer,
  p_access_token uuid default null
)
returns table (
  id integer,
  designer_id integer,
  service_ids integer[],
  booking_date date,
  booking_time text,
  customer_name text,
  customer_phone text,
  note text,
  status text,
  user_id uuid,
  official_line_user_id text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_booking public.bookings;
begin
  select * into target_booking from public.bookings b where b.id = p_booking_id;

  if target_booking.id is null or not (
    target_booking.public_access_token = p_access_token
    or public.is_current_admin()
    or public.is_current_designer_manager()
    or target_booking.designer_id = public.current_designer_id()
  ) then
    raise exception 'BOOKING_ACCESS_DENIED';
  end if;

  return query
  select target_booking.id, target_booking.designer_id, target_booking.service_ids,
         target_booking.booking_date, target_booking.booking_time,
         target_booking.customer_name, target_booking.customer_phone,
         target_booking.note, target_booking.status, target_booking.user_id,
         (
           select c.official_line_user_id
           from public.customers c
           where c.is_active
             and (
               (target_booking.user_id is not null and c.id = target_booking.user_id)
               or regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') =
                  regexp_replace(coalesce(target_booking.customer_phone, ''), '\D', '', 'g')
             )
           order by (target_booking.user_id is not null and c.id = target_booking.user_id) desc,
                    c.line_bound_at desc nulls last
           limit 1
         );
end;
$$;

create or replace function public.create_public_booking(
  p_designer_id integer,
  p_service_ids integer[],
  p_booking_date date,
  p_booking_time text,
  p_customer_name text,
  p_customer_phone text,
  p_note text default null,
  p_duration_minutes integer default 60,
  p_reference_image_url text default null
)
returns table (id integer, public_access_token uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  created public.bookings;
  caller uuid := auth.uid();
  normalized_phone text := regexp_replace(coalesce(p_customer_phone, ''), '\D', '', 'g');
begin
  if length(trim(coalesce(p_customer_name, ''))) not between 1 and 80
     or length(normalized_phone) not between 8 and 15
     or p_booking_date < current_date
     or p_booking_date > current_date + 120
     or p_booking_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
     or p_duration_minutes not between 15 and 720
     or coalesce(array_length(p_service_ids, 1), 0) not between 1 and 30
     or length(coalesce(p_note, '')) > 3000 then
    raise exception 'INVALID_BOOKING_INPUT';
  end if;

  if p_designer_id is not null and not exists (
    select 1 from public.designers d
    where d.id = p_designer_id and d.is_active and d.status = 'active'
  ) then
    raise exception 'DESIGNER_UNAVAILABLE';
  end if;

  insert into public.bookings (
    designer_id, service_ids, booking_date, booking_time,
    customer_name, customer_phone, note, status, duration_minutes,
    reference_image_url, user_id
  ) values (
    p_designer_id, p_service_ids, p_booking_date, p_booking_time,
    trim(p_customer_name), trim(p_customer_phone), p_note, 'pending',
    p_duration_minutes, p_reference_image_url, caller
  ) returning * into created;

  if caller is not null then
    insert into public.customers (id, name, phone, email)
    values (caller, trim(p_customer_name), trim(p_customer_phone), null)
    on conflict (id) do update
      set name = excluded.name, phone = excluded.phone, updated_at = now();
  elsif not exists (
    select 1 from public.customers c
    where c.is_active and regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') = normalized_phone
  ) then
    insert into public.customers (name, phone)
    values (trim(p_customer_name), trim(p_customer_phone));
  end if;

  return query select created.id, created.public_access_token;
end;
$$;

revoke all on function public.get_public_booking_slots(integer, date, date) from public;
revoke all on function public.create_public_booking(integer, integer[], date, text, text, text, text, integer, text) from public;
revoke all on function public.issue_booking_line_binding(integer, uuid) from public;
revoke all on function public.bind_booking_line_user(integer, uuid, text) from public;
revoke all on function public.bind_line_user_by_code(text, text) from public;
revoke all on function public.get_booking_notification_payload(integer, uuid) from public;
grant execute on function public.get_public_booking_slots(integer, date, date) to anon, authenticated;
grant execute on function public.create_public_booking(integer, integer[], date, text, text, text, text, integer, text) to anon, authenticated;
grant execute on function public.issue_booking_line_binding(integer, uuid) to anon, authenticated;
grant execute on function public.bind_booking_line_user(integer, uuid, text) to anon, authenticated;
grant execute on function public.bind_line_user_by_code(text, text) to anon, authenticated;
grant execute on function public.get_booking_notification_payload(integer, uuid) to anon, authenticated;

