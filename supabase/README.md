# Supabase setup

1. Confirm `month_incomes`, `expenses`, and `person_money_records` contain no data.
2. Open Supabase Dashboard > SQL Editor.
3. Paste and run `schema.sql` once.
4. In Authentication > Providers > Email, keep new-user signup disabled.
5. Confirm the owner account exists in Authentication > Users.

If you already ran `schema.sql`, run the new `replace_budget_data` function and its revoke/grant statements in the SQL Editor. Rerun the full schema only after confirming all three budget tables are empty.

Do not place a Secret key in this repository or in Vercel's browser environment variables.
The Vue app uses only the project URL and Publishable key.
