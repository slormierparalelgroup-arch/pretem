# PRETEM

PRETEM is a Next.js and Supabase micro-loan platform for the Haitian community. Users can create an account, request a loan, upload verification images, track status by reference, and view their loan history. Admins can review requests, inspect uploaded images, approve or reject loans, and mark loans as paid.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_ADMIN_EMAILS=admin@example.com
```

3. Run `supabase/schema.sql` in the Supabase SQL editor.

4. Promote an admin account after signup:

```sql
update public.profiles
set role = 'admin'
where email = 'admin@example.com';
```

5. Start the app:

```bash
npm run dev
```

## Routes

- `/` home
- `/signup` user signup
- `/login` user login
- `/request-loan` authenticated loan request form
- `/request-status` reference lookup
- `/dashboard` user loan history
- `/admin/login` admin login
- `/admin` admin dashboard

## Supabase

The app expects:

- `loans` table with user, amount, repayment, status, due date, payment, and verification image URL fields
- `profiles` table with `role` and `credit_score`
- private `selfies` storage bucket
- RLS policies from `supabase/schema.sql`

## Sensitive ID Protection

- Keep the `selfies` bucket private.
- Store file paths in the database, not public image URLs.
- Use short-lived signed URLs when admins review verification images.
- Never expose the Supabase `service_role` key in the frontend or Vercel public environment variables.
- Limit admin access to trusted accounts and keep RLS enabled.
