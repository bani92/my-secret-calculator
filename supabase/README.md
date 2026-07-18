# Supabase setup

1. Confirm `month_incomes`, `expenses`, `income_records`, and `person_money_records` contain no data.
2. Open Supabase Dashboard > SQL Editor.
3. Paste and run `schema.sql` once.
4. In Authentication > Providers > Email, keep new-user signup disabled.
5. Confirm the owner account exists in Authentication > Users.

If you already ran `schema.sql`, run the new `income_records` table definition, `drop function if exists public.replace_budget_data(jsonb, jsonb, jsonb);`, the updated `replace_budget_data` function, and its revoke/grant statements in the SQL Editor. Rerun the full schema only after confirming all four budget tables are empty.

Do not place a Secret key in this repository or in Vercel's browser environment variables.
The Vue app uses only the project URL and Publishable key.
