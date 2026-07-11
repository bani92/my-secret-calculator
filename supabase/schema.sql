drop table if exists public.person_money_records cascade;
drop table if exists public.expenses cascade;
drop table if exists public.month_incomes cascade;

create table public.month_incomes (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  income integer not null check (income >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, month)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  category_id text not null check (
    category_id in ('lunch', 'living', 'fixed', 'dating', 'groceries', 'transport', 'health', 'gifts', 'other')
  ),
  amount integer not null check (amount > 0),
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (month = to_char(date, 'YYYY-MM'))
);

create table public.person_money_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  person_name text not null check (length(trim(person_name)) > 0),
  direction text not null check (direction in ('receivable', 'payable')),
  amount integer not null check (amount > 0),
  memo text not null default '',
  settled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index expenses_user_date_idx on public.expenses (user_id, date desc);
create index person_money_records_user_date_idx on public.person_money_records (user_id, date desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger month_incomes_set_updated_at before update on public.month_incomes
for each row execute function public.set_updated_at();
create trigger expenses_set_updated_at before update on public.expenses
for each row execute function public.set_updated_at();
create trigger person_money_records_set_updated_at before update on public.person_money_records
for each row execute function public.set_updated_at();

alter table public.month_incomes enable row level security;
alter table public.expenses enable row level security;
alter table public.person_money_records enable row level security;

create policy "owners manage month incomes" on public.month_incomes
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "owners manage expenses" on public.expenses
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "owners manage person money records" on public.person_money_records
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on public.month_incomes, public.expenses, public.person_money_records from anon;
grant select, insert, update, delete on public.month_incomes, public.expenses, public.person_money_records to authenticated;
