# Premium Purchase Root-Cause Report

## 1. Files inspected

- `assets/js/premium.js`
- `assets/js/account-billing.js`
- `profile.html`
- `premium-thank-you.html`
- `api/paystack-intent.js`
- `api/paystack-verify.js`
- `api/paystack-webhook.js`
- `api/paystack-donation-verify.js`
- `assets/js/donate.js`
- `vercel.json`
- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/022_secure_user_profiles_authorization.sql`
- `supabase/migrations/024_secure_paystack_payment_processing.sql`
- `supabase/migrations/025_donations.sql`
- recent commits `967ce01`, `264052f`, and `2410f44`

## 2. Execution flow

1. The authenticated user clicks Upgrade in the account billing widget, premium gate, or profile page.
2. Browser code posts the selected plan and Supabase access token to `/api/paystack-intent`.
3. `api/paystack-intent.js` authenticates the user, creates a server-issued payment reference, and inserts a pending row in `public.payment_intents`.
4. The browser opens Paystack Inline with that reference, plan metadata, and the server-issued amount.
5. After Paystack succeeds, the browser calls `/api/paystack-verify`; Paystack also sends `charge.success` to `/api/paystack-webhook`.
6. Either server path verifies the transaction, checks it against the payment intent, then calls `public.process_verified_paystack_payment` as the Supabase service role.
7. That RPC writes `public.payments`, marks the intent processed, and updates `public.user_profiles` with Premium access and expiry.
8. `checkPremium()` reads `user_profiles`; RLS permits the signed-in user to read only their own profile.

The donation path is separate: it uses `SC-DONATE-*` references, `public.donations`, and `/api/paystack-donation-verify`. It does not use Premium intents, payments, or activation RPCs.

## 3. Confirmed root cause

The production Supabase schema is missing the database objects introduced by
`supabase/migrations/024_secure_paystack_payment_processing.sql`:

- `public.payment_intents`
- `public.payments`
- `public.process_verified_paystack_payment(...)`

The code deployed in `api/paystack-intent.js`, `api/paystack-verify.js`, and
`api/paystack-webhook.js` requires these objects. Therefore Premium cannot create an
intent and cannot verify/activate a payment. The process stops before subscription
activation and before the `user_profiles` update.

## 4. Evidence

Read-only production Supabase REST probes using the configured public key returned:

| Probe | Result |
| --- | --- |
| `GET /rest/v1/payment_intents?select=*&limit=1` | `404 PGRST205`: table not found in schema cache |
| `GET /rest/v1/payments?select=*&limit=1` | `404 PGRST205`: table not found in schema cache |
| `GET /rest/v1/rpc/process_verified_paystack_payment` | `404 PGRST202`: function not found in schema cache |
| `GET /rest/v1/user_profiles?select=*&limit=1` | `200`: existing subscription profile table is present |
| `GET /rest/v1/donations?select=*&limit=1` | `404 PGRST205`: donation table is also not yet deployed |

The production `/api/paystack-intent` route itself is deployed and reaches its
authentication check (an intentionally invalid diagnostic token returned `401
Unauthenticated`), ruling out a missing Vercel route and confirming the Vercel runtime
has `SUPABASE_ANON_KEY`.

`2410f44` (the donation merge) did not modify Premium handlers, Premium UI, or
Premium tables. It only added the isolated donation endpoint/migration, donation page,
navigation, and two rewrites. It did not cause this failure.

## 5. Recommended fix

Apply `supabase/migrations/024_secure_paystack_payment_processing.sql` to the
production Supabase project exactly once, using the Supabase CLI or SQL Editor. Apply
`025_donations.sql` immediately afterwards so the new donation verifier can record
verified donations. Then re-run the schema probes and execute a Paystack test
transaction for each flow.

No application-code change is needed: the deployed Premium code and migration are
already designed to work together. Applying a fallback to the old insecure flow would
weaken payment validation and could double-process payments.

## 6. Risk assessment

- **Fix risk: low.** Migration 024 creates new tables, indexes, RLS policies, and an
  idempotent activation RPC; it does not modify or revoke existing Premium rows.
- **Existing subscriptions: low risk.** They remain in `user_profiles`; the migration
  only reads their existing expiry when a new verified payment is processed.
- **Donation risk: low.** Donations use their own table and verifier. Migration 024
  does not touch `public.donations` or donation references. The production
  `public.donations` table is currently missing, so migration 025 is also required for
  the donation flow to complete verification successfully.
- **Operational risk: medium if applied out of order.** Apply after migrations
  `001`–`023`, particularly `022` and `023`, because it relies on `user_profiles` and
  uses the service-role database pattern.
