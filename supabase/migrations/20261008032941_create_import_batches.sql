create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  admin_username text not null,
  status text not null default 'completed' check (status in ('completed', 'partial', 'reverted')),
  total_count integer not null default 0,
  success_count integer not null default 0,
  skipped_count integer not null default 0,
  error_count integer not null default 0,
  months text[] not null default '{}',
  transaction_ids bigint[] not null default '{}',
  error_messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  reverted_at timestamptz,
  reverted_by text
);

alter table public.transactions
  add column if not exists import_batch_id uuid references public.import_batches(id) on delete set null;

create index if not exists import_batches_created_at_idx
  on public.import_batches (created_at desc);

create index if not exists transactions_import_batch_id_idx
  on public.transactions (import_batch_id)
  where import_batch_id is not null;

alter table public.import_batches enable row level security;

revoke all on table public.import_batches from anon, authenticated;
grant select, insert, update on table public.import_batches to anon, authenticated;

drop policy if exists "import batches read" on public.import_batches;
create policy "import batches read"
  on public.import_batches for select
  to anon, authenticated
  using (true);

drop policy if exists "import batches insert" on public.import_batches;
create policy "import batches insert"
  on public.import_batches for insert
  to anon, authenticated
  with check (length(trim(admin_username)) > 0);

drop policy if exists "import batches update" on public.import_batches;
create policy "import batches update"
  on public.import_batches for update
  to anon, authenticated
  using (status in ('completed', 'partial'))
  with check (
    (status in ('completed', 'partial') and reverted_at is null)
    or
    (status = 'reverted' and reverted_at is not null and length(trim(reverted_by)) > 0)
  );
