drop table if exists public.person_money_records cascade;
drop table if exists public.income_records cascade;
drop table if exists public.expenses cascade;
drop table if exists public.month_incomes cascade;
drop function if exists public.replace_budget_data(jsonb, jsonb, jsonb);

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

create table public.income_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  category_id text not null check (
    category_id in ('salary', 'side', 'carryOver', 'refund', 'transfer', 'other')
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
create index income_records_user_date_idx on public.income_records (user_id, date desc);
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
create trigger income_records_set_updated_at before update on public.income_records
for each row execute function public.set_updated_at();
create trigger person_money_records_set_updated_at before update on public.person_money_records
for each row execute function public.set_updated_at();

alter table public.month_incomes enable row level security;
alter table public.expenses enable row level security;
alter table public.income_records enable row level security;
alter table public.person_money_records enable row level security;

create policy "owners manage month incomes" on public.month_incomes
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "owners manage expenses" on public.expenses
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "owners manage income records" on public.income_records
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "owners manage person money records" on public.person_money_records
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create or replace function public.replace_budget_data(
  p_months jsonb,
  p_expenses jsonb,
  p_income_records jsonb,
  p_person_records jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;

  delete from public.month_incomes where user_id = v_user_id;
  delete from public.expenses where user_id = v_user_id;
  delete from public.income_records where user_id = v_user_id;
  delete from public.person_money_records where user_id = v_user_id;

  insert into public.month_incomes (user_id, month, income)
  select
    v_user_id,
    item.value ->> 'month',
    (item.value ->> 'income')::integer
  from pg_catalog.jsonb_array_elements(p_months) as item(value);

  insert into public.expenses (id, user_id, date, month, category_id, amount, memo, created_at)
  select
    (item.value ->> 'id')::uuid,
    v_user_id,
    (item.value ->> 'date')::date,
    item.value ->> 'month',
    item.value ->> 'category_id',
    (item.value ->> 'amount')::integer,
    item.value ->> 'memo',
    coalesce((item.value ->> 'created_at')::timestamptz, (item.value ->> 'date')::timestamptz)
  from pg_catalog.jsonb_array_elements(p_expenses) as item(value);

  insert into public.income_records (id, user_id, date, month, category_id, amount, memo, created_at)
  select
    (item.value ->> 'id')::uuid,
    v_user_id,
    (item.value ->> 'date')::date,
    item.value ->> 'month',
    item.value ->> 'category_id',
    (item.value ->> 'amount')::integer,
    item.value ->> 'memo',
    coalesce((item.value ->> 'created_at')::timestamptz, (item.value ->> 'date')::timestamptz)
  from pg_catalog.jsonb_array_elements(p_income_records) as item(value);

  insert into public.person_money_records (
    id,
    user_id,
    date,
    person_name,
    direction,
    amount,
    memo,
    settled
  )
  select
    (item.value ->> 'id')::uuid,
    v_user_id,
    (item.value ->> 'date')::date,
    item.value ->> 'person_name',
    item.value ->> 'direction',
    (item.value ->> 'amount')::integer,
    item.value ->> 'memo',
    (item.value ->> 'settled')::boolean
  from pg_catalog.jsonb_array_elements(p_person_records) as item(value);
end;
$$;

revoke all on public.month_incomes, public.expenses, public.income_records, public.person_money_records from anon;
grant select, insert, update, delete on public.month_incomes, public.expenses, public.income_records, public.person_money_records to authenticated;

revoke all on function public.replace_budget_data(jsonb, jsonb, jsonb, jsonb) from public;
revoke all on function public.replace_budget_data(jsonb, jsonb, jsonb, jsonb) from anon;
grant execute on function public.replace_budget_data(jsonb, jsonb, jsonb, jsonb) to authenticated;
