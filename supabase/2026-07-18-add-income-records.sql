create table if not exists public.income_records (
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

create index if not exists income_records_user_date_idx on public.income_records (user_id, date desc);

drop trigger if exists income_records_set_updated_at on public.income_records;
create trigger income_records_set_updated_at before update on public.income_records
for each row execute function public.set_updated_at();

alter table public.income_records enable row level security;

drop policy if exists "owners manage income records" on public.income_records;
create policy "owners manage income records" on public.income_records
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop function if exists public.replace_budget_data(jsonb, jsonb, jsonb);

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

revoke all on public.income_records from anon;
grant select, insert, update, delete on public.income_records to authenticated;

revoke all on function public.replace_budget_data(jsonb, jsonb, jsonb, jsonb) from public;
revoke all on function public.replace_budget_data(jsonb, jsonb, jsonb, jsonb) from anon;
grant execute on function public.replace_budget_data(jsonb, jsonb, jsonb, jsonb) to authenticated;
