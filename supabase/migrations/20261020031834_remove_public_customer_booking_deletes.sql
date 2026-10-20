revoke delete on public.bookings from anon;
drop policy if exists bookings_compat_delete on public.bookings;

revoke delete on public.customers from anon;
drop policy if exists customers_compat_delete on public.customers;
