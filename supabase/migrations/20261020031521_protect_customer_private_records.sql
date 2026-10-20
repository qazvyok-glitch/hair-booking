revoke all on public.customer_notes from anon;
drop policy if exists customer_notes_compat_select on public.customer_notes;
drop policy if exists customer_notes_compat_insert on public.customer_notes;
drop policy if exists customer_notes_compat_update on public.customer_notes;
drop policy if exists customer_notes_compat_delete on public.customer_notes;
create policy "staff read customer notes" on public.customer_notes
for select to authenticated
using ((select public.is_current_admin()) or (select public.is_current_designer_manager()) or designer_id = (select public.current_designer_id()));
create policy "staff create customer notes" on public.customer_notes
for insert to authenticated
with check ((select public.is_current_admin()) or (select public.is_current_designer_manager()) or designer_id = (select public.current_designer_id()));
create policy "staff update customer notes" on public.customer_notes
for update to authenticated
using ((select public.is_current_admin()) or (select public.is_current_designer_manager()) or designer_id = (select public.current_designer_id()))
with check ((select public.is_current_admin()) or (select public.is_current_designer_manager()) or designer_id = (select public.current_designer_id()));
create policy "staff delete customer notes" on public.customer_notes
for delete to authenticated
using ((select public.is_current_admin()) or (select public.is_current_designer_manager()) or designer_id = (select public.current_designer_id()));

revoke all on public.customer_photos from anon;
drop policy if exists customer_photos_compat_select on public.customer_photos;
drop policy if exists customer_photos_compat_insert on public.customer_photos;
drop policy if exists customer_photos_compat_update on public.customer_photos;
drop policy if exists customer_photos_compat_delete on public.customer_photos;
create policy "staff read customer photos" on public.customer_photos
for select to authenticated
using ((select public.is_current_admin()) or (select public.is_current_designer_manager()) or designer_id = (select public.current_designer_id()));
create policy "staff create customer photos" on public.customer_photos
for insert to authenticated
with check ((select public.is_current_admin()) or (select public.is_current_designer_manager()) or designer_id = (select public.current_designer_id()));
create policy "staff update customer photos" on public.customer_photos
for update to authenticated
using ((select public.is_current_admin()) or (select public.is_current_designer_manager()) or designer_id = (select public.current_designer_id()))
with check ((select public.is_current_admin()) or (select public.is_current_designer_manager()) or designer_id = (select public.current_designer_id()));
create policy "staff delete customer photos" on public.customer_photos
for delete to authenticated
using ((select public.is_current_admin()) or (select public.is_current_designer_manager()) or designer_id = (select public.current_designer_id()));
