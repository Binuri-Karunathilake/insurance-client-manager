# Insurance Client Manager

A mobile-first web app for an independent insurance agent in Sri Lanka: client records, policies across several insurers, premium / renewal / birthday reminders, and photos of documents filed under each client. Installs on a phone or tablet like an app, works in English and Sinhala, and keeps client data private behind two-step sign-in.

> All data in this repository, the screenshots and the demo is made up. Real client data never goes in the repo.

## Status

| Step | |
| --- | --- |
| Design (Figma: phone screens in English and Sinhala, tablet and laptop layouts, clickable prototype) | Done |
| Project setup: app, database, two-step sign-in, languages, installable app | **This commit** |
| Clients and policies screens | Next |
| Reminders: Today list, daily job, push and email | |
| Documents: camera upload and gallery | |
| Test with demo data, then go live | |

## Stack

- **Next.js 16** (App Router, Cache Components, Partial Prefetching), TypeScript, Tailwind CSS 4
- **Supabase**: Postgres with row-level security, Auth with TOTP two-step sign-in, private Storage
- **Vercel** hosting
- Installable web app (manifest, home-screen icons)

## How it fits together

```
phone / tablet ──► Next.js on Vercel ──► Supabase (Postgres + Auth + Storage)
                     │
                     └─ proxy.ts: language in the URL, sign-in steps
```

- **Every row belongs to an agency.** `agency_members` says who belongs to which agency, and row-level security on every table only lets members see and change their agency's rows. Today there is one member, the agent; adding an assistant later is one more row.
- **Reminders are worked out, not typed.** The `due_items` view lists premiums due in the next 7 days, renewals in the next 30, client and family birthdays in the next 7, open follow-ups and anything overdue, all in Sri Lanka time. Only manual follow-ups are stored (`follow_ups`).
- **Marking a premium paid** (`mark_premium_paid`) moves `next_due_date` forward by one payment period.
- **Documents** go in a private storage bucket under `<agency_id>/<client_id>/…`; files are only reachable through short-lived signed links.
- **Sign-in is two steps.** Password, then a 6-digit code from an authenticator app. `proxy.ts` sends visitors to the right step, pages check again before reading data (`src/lib/auth.ts`), and the database checks a third time. The app signs out after 30 minutes without activity.
- **Languages** live in the URL (`/en/…`, `/si/…`) with strings in `src/lib/dictionaries`. Fonts are Inter and Yaldevi (Sinhala), served from the repo.

## Run it locally

1. **Create a Supabase project** at [supabase.com](https://supabase.com) (the free plan is enough). Choose the Singapore or Mumbai region, closest to Sri Lanka.
2. **Create the database.** In the Supabase dashboard open *SQL Editor* and run each file in [`supabase/migrations`](supabase/migrations) in order, oldest first. When a new migration is added later, run just that file.
3. **Lock down sign-up.** *Authentication → Sign In / Providers*: turn off **Allow new users to sign up**. *Authentication → Multi-Factor*: make sure **TOTP** is enabled.
4. **Create your user.** *Authentication → Users → Add user*, with email and password and **Auto Confirm User** ticked. A trigger creates an agency for the new user automatically. To show a first name on the Today screen, add `{"full_name": "Your Name"}` to the user's metadata.
5. **(Optional) Load the demo clients.** In the SQL Editor run [`supabase/seed.sql`](supabase/seed.sql), then:
   ```sql
   select public.seed_demo_data(
     (select agency_id from public.agency_members
      where user_id = (select id from auth.users where email = 'you@example.com'))
   );
   ```
6. **Connect the app.**
   ```bash
   cp .env.example .env.local   # then paste the project URL and publishable key
   npm install
   npm run dev
   ```
7. Open http://localhost:3000, sign in, scan the QR code with Google Authenticator or Microsoft Authenticator, and enter the code.

## Deploy

Import the repo in [Vercel](https://vercel.com/new), add the two `NEXT_PUBLIC_SUPABASE_*` variables, and deploy. In Supabase, add the Vercel URL under *Authentication → URL Configuration*.

## Scripts

| Command | |
| --- | --- |
| `npm run dev` | Local development |
| `npm run build` | Production build (also type-checks) |
| `npm run lint` | ESLint |

## Project layout

```
src/
  proxy.ts                   language redirect + sign-in steps
  app/[lang]/(app)/          signed-in screens: Today, Clients, Reminders, Documents
  app/[lang]/(auth)/         sign in, two-step set-up and code entry
  components/                navigation, icons, form controls
  lib/supabase/              Supabase clients for browser, server and proxy
  lib/auth.ts                current user (requires two-step sign-in)
  lib/dictionaries/          English and Sinhala text
supabase/
  migrations/                schema, row-level security, storage rules
  seed.sql                   demo data (made-up clients)
```

## Privacy

The app holds NIC numbers, family details and sometimes health information, so:

- only the agent's own account can sign in; public sign-up is off
- two-step sign-in is required for every session
- row-level security on every table and on file storage
- no medical details in free-text notes
- daily database backups and an Excel export (planned) so the agent always owns a copy
- Sri Lanka's Personal Data Protection Act applies; insurer rules on where agents keep client documents are being checked before go-live

## Licences

Inter and Yaldevi fonts: SIL Open Font License 1.1.
