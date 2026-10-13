create or replace function public.generate_customer_no()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.customer_no is null then
    new.customer_no := 'C' || lpad(nextval('public.customer_number_seq'::regclass)::text, 4, '0');
  end if;
  return new;
end;
$$;
