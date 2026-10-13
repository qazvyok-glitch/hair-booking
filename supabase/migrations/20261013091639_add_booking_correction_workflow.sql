alter table public.booking_audit_logs
  add column if not exists reason text;

alter table public.booking_audit_logs
  drop constraint if exists booking_audit_logs_action_check;

alter table public.booking_audit_logs
  add constraint booking_audit_logs_action_check
  check (action in ('created', 'updated', 'status_changed', 'deleted', 'unlocked', 'relocked'));

create or replace function public.enforce_booking_safety()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_owner boolean := public.is_current_admin_owner();
  correction_operation text := coalesce(current_setting('app.booking_correction', true), '');
  start_at timestamp;
  end_at timestamp;
begin
  if tg_op = 'DELETE' then
    if old.is_test_data or is_owner then
      return old;
    end if;
    raise exception 'BOOKING_LOCKED: 正式預約不可刪除，請由最高管理員執行更正';
  end if;

  if tg_op = 'UPDATE' and not old.is_test_data then
    if old.locked_at is not null and correction_operation <> 'unlock' then
      raise exception 'BOOKING_LOCKED: 此預約已完成並鎖定，請先填寫原因解除鎖定';
    end if;

    if old.status = 'completed' and old.locked_at is null and not is_owner then
      raise exception 'BOOKING_CORRECTION_OWNER_ONLY: 更正中的正式預約僅限最高管理員修改';
    end if;

    if new.status is distinct from old.status and not is_owner then
      if not (
        (old.status = 'pending' and new.status in ('confirmed', 'cancelled'))
        or (old.status = 'confirmed' and new.status in ('completed', 'cancelled'))
      ) then
        raise exception 'INVALID_BOOKING_STATUS_TRANSITION: 不允許的預約狀態變更';
      end if;
    end if;
  end if;

  if new.designer_id is not null
     and new.status in ('pending', 'confirmed', 'completed')
     and new.booking_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
     and (
       tg_op = 'INSERT'
       or new.designer_id is distinct from old.designer_id
       or new.booking_date is distinct from old.booking_date
       or new.booking_time is distinct from old.booking_time
       or new.duration_minutes is distinct from old.duration_minutes
       or new.status is distinct from old.status
     ) then
    perform pg_advisory_xact_lock(
      hashtextextended(new.designer_id::text || ':' || new.booking_date::text, 0)
    );

    start_at := new.booking_date + new.booking_time::time;
    end_at := start_at + make_interval(mins => greatest(coalesce(new.duration_minutes, 60), 15));

    if exists (
      select 1
      from public.bookings b
      where b.designer_id = new.designer_id
        and b.id <> coalesce(new.id, -1)
        and b.status in ('pending', 'confirmed', 'completed')
        and b.booking_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        and (b.booking_date + b.booking_time::time) < end_at
        and (
          b.booking_date + b.booking_time::time
          + make_interval(mins => greatest(coalesce(b.duration_minutes, 60), 15))
        ) > start_at
    ) then
      raise exception 'BOOKING_TIME_CONFLICT: 此設計師在該時段已有預約';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_booking_safety() from public, anon, authenticated;

create or replace function public.unlock_booking_for_correction(
  p_booking_id integer,
  p_reason text
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.bookings;
  profile public.admin_profiles;
begin
  select p into profile
  from public.admin_profiles p
  where p.user_id = auth.uid() and p.is_active and p.role = 'owner'
  limit 1;

  if profile.user_id is null then
    raise exception 'permission denied';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 4 then
    raise exception 'CORRECTION_REASON_REQUIRED: 請填寫至少 4 個字的解除原因';
  end if;

  perform set_config('app.booking_correction', 'unlock', true);

  update public.bookings
  set locked_at = null
  where id = p_booking_id
    and not is_test_data
    and locked_at is not null
    and status = 'completed'
  returning * into result;

  if result.id is null then
    raise exception 'BOOKING_NOT_LOCKED: 找不到已鎖定的正式預約';
  end if;

  insert into public.booking_audit_logs (
    booking_id, action, before_data, after_data, actor_user_id,
    actor_username, actor_role, is_test_data, reason
  ) values (
    result.id, 'unlocked', null, to_jsonb(result), auth.uid(),
    profile.username, profile.role_name, false, trim(p_reason)
  );

  return result;
end;
$$;

create or replace function public.relock_booking_after_correction(
  p_booking_id integer,
  p_reason text
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.bookings;
  profile public.admin_profiles;
begin
  select p into profile
  from public.admin_profiles p
  where p.user_id = auth.uid() and p.is_active and p.role = 'owner'
  limit 1;

  if profile.user_id is null then
    raise exception 'permission denied';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 4 then
    raise exception 'CORRECTION_REASON_REQUIRED: 請填寫至少 4 個字的更正說明';
  end if;

  update public.bookings
  set locked_at = now(), completed_at = coalesce(completed_at, now())
  where id = p_booking_id
    and not is_test_data
    and locked_at is null
    and status = 'completed'
  returning * into result;

  if result.id is null then
    raise exception 'BOOKING_NOT_EDITABLE: 找不到可重新鎖定的正式預約';
  end if;

  insert into public.booking_audit_logs (
    booking_id, action, before_data, after_data, actor_user_id,
    actor_username, actor_role, is_test_data, reason
  ) values (
    result.id, 'relocked', null, to_jsonb(result), auth.uid(),
    profile.username, profile.role_name, false, trim(p_reason)
  );

  return result;
end;
$$;

revoke all on function public.unlock_booking_for_correction(integer, text) from public, anon, authenticated;
grant execute on function public.unlock_booking_for_correction(integer, text) to authenticated;

revoke all on function public.relock_booking_after_correction(integer, text) from public, anon, authenticated;
grant execute on function public.relock_booking_after_correction(integer, text) to authenticated;
