revoke all on function public.set_booking_runtime_fields() from public, anon, authenticated;
revoke all on function public.enforce_booking_safety() from public, anon, authenticated;
revoke all on function public.audit_booking_change() from public, anon, authenticated;
revoke all on function public.is_current_admin_owner() from public, anon, authenticated;

revoke all on function public.set_booking_data_mode(text, text) from public, anon, authenticated;
grant execute on function public.set_booking_data_mode(text, text) to authenticated;

revoke all on function public.clear_test_booking_data(text) from public, anon, authenticated;
grant execute on function public.clear_test_booking_data(text) to authenticated;
