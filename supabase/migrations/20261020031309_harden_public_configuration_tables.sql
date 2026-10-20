-- Public visitors only need to read booking configuration. Mutations belong to
-- authenticated staff, and private contracts/roles must never be returned.

grant execute on function public.is_current_admin() to authenticated;
grant execute on function public.current_designer_id() to authenticated;
grant execute on function public.is_current_designer_manager() to authenticated;

revoke insert, update, delete on public.announcements from anon;
drop policy if exists announcements_compat_select on public.announcements;
drop policy if exists announcements_compat_insert on public.announcements;
drop policy if exists announcements_compat_update on public.announcements;
drop policy if exists announcements_compat_delete on public.announcements;
create policy "public read active customer announcements" on public.announcements
for select to anon, authenticated
using (is_active and target in ('all', 'customer'));
create policy "admins manage announcements" on public.announcements
for all to authenticated
using ((select public.is_current_admin()))
with check ((select public.is_current_admin()));

revoke all on public.designer_accounts from anon;
drop policy if exists designer_accounts_compat_select on public.designer_accounts;
drop policy if exists designer_accounts_compat_insert on public.designer_accounts;
drop policy if exists designer_accounts_compat_update on public.designer_accounts;
drop policy if exists designer_accounts_compat_delete on public.designer_accounts;
create policy "admins manage legacy designer accounts" on public.designer_accounts
for all to authenticated
using ((select public.is_current_admin()))
with check ((select public.is_current_admin()));

revoke insert, update, delete on public.designer_off_days from anon;
drop policy if exists designer_off_days_compat_select on public.designer_off_days;
drop policy if exists designer_off_days_compat_insert on public.designer_off_days;
drop policy if exists designer_off_days_compat_update on public.designer_off_days;
drop policy if exists designer_off_days_compat_delete on public.designer_off_days;
create policy "public read designer off days" on public.designer_off_days
for select to anon, authenticated using (true);
create policy "staff manage designer off days" on public.designer_off_days
for all to authenticated
using ((select public.is_current_admin()) or (select public.is_current_designer_manager()) or designer_id = (select public.current_designer_id()))
with check ((select public.is_current_admin()) or (select public.is_current_designer_manager()) or designer_id = (select public.current_designer_id()));

revoke insert, update, delete on public.designer_off_slots from anon;
drop policy if exists designer_off_slots_compat_select on public.designer_off_slots;
drop policy if exists designer_off_slots_compat_insert on public.designer_off_slots;
drop policy if exists designer_off_slots_compat_update on public.designer_off_slots;
drop policy if exists designer_off_slots_compat_delete on public.designer_off_slots;
create policy "public read designer off slots" on public.designer_off_slots
for select to anon, authenticated using (true);
create policy "staff manage designer off slots" on public.designer_off_slots
for all to authenticated
using ((select public.is_current_admin()) or (select public.is_current_designer_manager()) or designer_id = (select public.current_designer_id()))
with check ((select public.is_current_admin()) or (select public.is_current_designer_manager()) or designer_id = (select public.current_designer_id()));

revoke insert, update, delete on public.designer_price_items from anon;
drop policy if exists "designer price items delete" on public.designer_price_items;
drop policy if exists "designer price items insert" on public.designer_price_items;
drop policy if exists "designer price items read" on public.designer_price_items;
drop policy if exists "designer price items update" on public.designer_price_items;
drop policy if exists designer_price_items_compat_delete on public.designer_price_items;
drop policy if exists designer_price_items_compat_insert on public.designer_price_items;
drop policy if exists designer_price_items_compat_select on public.designer_price_items;
drop policy if exists designer_price_items_compat_update on public.designer_price_items;
create policy "public read active designer prices" on public.designer_price_items
for select to anon, authenticated using (is_active);
create policy "admins manage designer prices" on public.designer_price_items
for all to authenticated
using ((select public.is_current_admin()))
with check ((select public.is_current_admin()));

revoke all on public.designer_settlement_items from anon;
drop policy if exists designer_settlement_items_compat_delete on public.designer_settlement_items;
drop policy if exists designer_settlement_items_compat_insert on public.designer_settlement_items;
drop policy if exists designer_settlement_items_compat_select on public.designer_settlement_items;
drop policy if exists designer_settlement_items_compat_update on public.designer_settlement_items;
create policy "admins manage designer settlement items" on public.designer_settlement_items
for all to authenticated
using ((select public.is_current_admin()))
with check ((select public.is_current_admin()));

revoke insert, update, delete on public.price_items from anon;
drop policy if exists price_items_compat_delete on public.price_items;
drop policy if exists price_items_compat_insert on public.price_items;
drop policy if exists price_items_compat_select on public.price_items;
drop policy if exists price_items_compat_update on public.price_items;
create policy "public read price items" on public.price_items
for select to anon, authenticated using (true);
create policy "admins manage price items" on public.price_items
for all to authenticated
using ((select public.is_current_admin()))
with check ((select public.is_current_admin()));

revoke insert, update, delete on public.service_categories from anon;
drop policy if exists service_categories_compat_delete on public.service_categories;
drop policy if exists service_categories_compat_insert on public.service_categories;
drop policy if exists service_categories_compat_select on public.service_categories;
drop policy if exists service_categories_compat_update on public.service_categories;
create policy "public read active service categories" on public.service_categories
for select to anon, authenticated using (is_active);
create policy "admins manage service categories" on public.service_categories
for all to authenticated
using ((select public.is_current_admin()))
with check ((select public.is_current_admin()));

revoke insert, update, delete on public.services from anon;
drop policy if exists services_compat_delete on public.services;
drop policy if exists services_compat_insert on public.services;
drop policy if exists services_compat_select on public.services;
drop policy if exists services_compat_update on public.services;
create policy "public read active services" on public.services
for select to anon, authenticated using (is_active);
create policy "admins manage services" on public.services
for all to authenticated
using ((select public.is_current_admin()))
with check ((select public.is_current_admin()));

revoke insert, update, delete on public.shop_info from anon;
drop policy if exists shop_info_compat_delete on public.shop_info;
drop policy if exists shop_info_compat_insert on public.shop_info;
drop policy if exists shop_info_compat_select on public.shop_info;
drop policy if exists shop_info_compat_update on public.shop_info;
create policy "public read safe shop information" on public.shop_info
for select to anon, authenticated
using (
  is_active and (
    key in ('address', 'facebook', 'hair_length_image_url', 'hours_closed', 'hours_weekday', 'ig', 'maps_url', 'name', 'notice_1', 'notice_2', 'notice_3', 'notice_4', 'phone', 'price_category_order', 'website')
    or key like 'designer_price_category_order_%'
  )
);
create policy "admins manage all shop information" on public.shop_info
for all to authenticated
using ((select public.is_current_admin()))
with check ((select public.is_current_admin()));
