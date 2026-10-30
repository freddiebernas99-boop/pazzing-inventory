# PAZINGS Inventory & Sales Management System

A web application for Pazings Laundry Shop and Water Refilling Station. The Vercel application uses a same-origin API hosted on Vercel and Supabase for shared records and authentication.

## Features

- Water and laundry transactions with configurable rates and historical price snapshots.
- Expenses by business category, payment status, customer summaries, and daily reports.
- Owner-only customer, rate, and staff account screens.
- Responsive forms, transaction tables, CSV export, and print-friendly reports.

## Connect Vercel to Supabase

The Vercel app uses Supabase Auth and server-side Vercel API functions. It does not connect to a local PHP/MySQL database. Every device must use the same Vercel deployment and sign in with that user's unique account PIN after one-time enrollment.

1. In Vercel **Settings → Build and Deployment**, set **Root Directory** to the repository root (not `public`) so Vercel includes both `api/` and `public/`. Set **Output Directory** to `public` if Vercel does not detect it automatically.
2. In the Supabase project's SQL Editor, run [`supabase/setup.sql`](./supabase/setup.sql).
3. In Supabase Authentication, create the first user. Then run the following in the SQL Editor, replacing the email and display name with that account's details:

   ```sql
   update public.pazings_profiles
   set role = 'owner', full_name = 'Business Owner', status = 'active'
   where email = 'owner@example.com';
   ```

4. In the Vercel project settings, add these environment variables for Production (and Preview if needed):

   - `SUPABASE_URL` = `https://zsiwgubjobgmqxzzogqf.supabase.co`
   - `SUPABASE_ANON_KEY` = the project's publishable/anon key
   - `SUPABASE_SERVICE_ROLE_KEY` = the project's service-role/secret key

   Keep the service-role key only in Vercel server environment variables. Never put it in frontend files, Git, or chat.

5. Redeploy the Vercel project so the functions receive the environment variables. On the Hobby plan, make sure Git commits are authored by the GitHub account that owns the Vercel project; commits from other authors may be blocked.
6. Run the updated `supabase/setup.sql` in the Supabase SQL Editor before deploying the PIN-login API changes. Existing users must sign in once with their email and password to register an account PIN; they can then use that PIN on any device. Email/password remains available only for first-time PIN setup and recovery.

Users sign in with a unique four-digit account PIN. PINs are salted and hashed on the server, and the server applies persistent lockouts after repeated incorrect attempts. Four-digit PINs have limited entropy; choose a private PIN, do not share it, and use **Logout** on shared devices. There are no shared default PINs.

The API keeps the service-role key on the server, validates PIN-issued app sessions and Supabase Auth sessions, checks roles, and limits database access to its authenticated endpoints. The setup SQL enables row-level security and seeds default service rates. Existing browser-local PIN accounts, transactions, and expenses are not imported automatically; export or preserve any records you still need before switching.

## Local static demo

`start_server.bat` serves the static frontend locally. Its API requests only work when served through the configured Vercel deployment; it does not provide a local PHP or Supabase backend.

## Project structure

```text
PAZINGS-INVENTORY/
├── api/            # Authenticated Vercel serverless API
├── public/         # Static Vercel frontend
├── supabase/       # Supabase schema, RLS, triggers, and service seed data
├── database/       # Separate PHP/MySQL application setup
├── config/         # Separate PHP/MySQL configuration
├── modules/        # Separate PHP/MySQL application modules
├── tests/          # PowerShell regression checks
├── index.php       # Separate PHP/MySQL application entry point
├── index.html      # Redirects to the static frontend
└── start_server.bat
```
