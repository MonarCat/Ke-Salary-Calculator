# Copilot Prompt — salarycalculator.co.ke Full Audit & Feature Update

**Project:** Kenya Salary Calculator (`salarycalculator.co.ke`)  
**Repo:** `MonarCat/Ke-Salary-Calculator`  
**Stack:** Static HTML/CSS/JS on Vercel, Supabase (project: `wznopthjoaqusalqoyru`) as backend  
**Supabase URL:** `https://wznopthjoaqusalqoyru.supabase.co`  
**Date:** May 2026

---

## ✅ What Has Already Been Done (DB — Do Not Redo)

All migrations were applied to Supabase. The following are complete:

1. **Poll RLS fixed** — INSERT + SELECT policies added to `poll_participants`; trigger created to auto-update `poll_votes.count` on each new vote; existing 8 votes backfilled into counts; `get_poll_participant_count(poll_idx int)` function created.
2. **Registration trigger** — `on_auth_user_created` trigger on `auth.users` now writes `account_type`, `full_name`, `organization_name`, `organization_kra` from `raw_user_meta_data` into `user_profiles` on every signup.
3. **Employer auto-create trigger** — when `account_type = 'employer'` is set on a profile, a row is auto-created in `employers` table.
4. **`employers` table extended** — added: `nssf_number`, `nhif_number`, `payroll_day`, `default_currency`, `bank_name`, `bank_account`, `bank_branch`, `paybill_number`, `profile_complete`.
5. **Storage bucket created** — `org-logos` bucket (public, 2 MB limit, images only) with correct RLS policies for owner upload/delete and public read.
6. **`app_settings` table created** — canonical pricing stored in DB: `premium_monthly_price_kes = 99`, `premium_annual_price_kes = 999`.
7. **Newsletter policies deduplicated** — removed 3 conflicting INSERT policies, left one clean `Anyone can subscribe` policy.
8. **`payslip_history` RLS** — added missing INSERT + SELECT owner policies (was 0 rows because saving was blocked).
9. **`saved_calculations` RLS** — added missing INSERT + SELECT owner policies (same issue).

---

## 🔴 Frontend Fixes Required

### FIX A — Pricing Update (URGENT — visible to users)

**New prices:** Monthly = **KES 99**, Annual = **KES 999**

Search the entire codebase for any occurrence of old premium pricing (likely `499`, `4999`, `4,999`, `499/month`, `KES 499`) and replace with the new values.

Key files likely affected:
- `premium.html` or any pricing section on the site
- Any JS file that initialises Paystack (`amount` field in kobo — monthly should be `9900`, annual `99900`)
- Any modal or upgrade prompt showing pricing text
- Meta descriptions or page text mentioning premium price

Update all displayed pricing to:
```
Monthly Premium: KES 99/month
Annual Premium: KES 999/year  (Save KES 189 vs monthly)
```

Also update Paystack initialisation:
```js
// Monthly plan
amount: 9900,  // KES 99 in kobo

// Annual plan  
amount: 99900, // KES 999 in kobo
```

---

### FIX B — Poll: "0 Participated" Bug

**Root cause confirmed:** The frontend reads `poll_votes.count` (which was 0 for all current polls) for the participant count instead of querying `poll_participants`. The DB trigger is now fixed so new votes will count correctly. But the display logic must be updated.

**Changes required in the poll JS (likely in `index.html` or a `poll.js` module):**

1. **Participant count** — Replace any logic that sums `poll_votes.count` with a call to the new DB function:
   ```js
   const { data } = await supabase.rpc('get_poll_participant_count', { p_poll_idx: currentPollIdx });
   const participantCount = data ?? 0;
   participantElement.textContent = `${participantCount} Participated in this Poll`;
   ```

2. **Vote submission** — Ensure the INSERT to `poll_participants` uses this exact schema:
   ```js
   await supabase.from('poll_participants').insert({
     poll_idx: currentPollIdx,       // integer
     option_idx: selectedOptionIdx,  // integer
     user_id: session?.user?.id ?? null,
     anon_token: getOrCreateAnonToken(), // localStorage token for anon dedup
   });
   ```
   Then update `poll_votes` via the trigger (automatic — no manual update needed).

3. **Vote results display** — After voting, query `poll_votes` to show percentages:
   ```js
   const { data: votes } = await supabase
     .from('poll_votes')
     .select('option_idx, count')
     .eq('poll_idx', currentPollIdx);
   ```

4. **Dedup protection** — Before inserting, check `poll_participants` by `anon_token` OR `user_id` for this `poll_idx` to prevent double-voting.

---

### FIX C — Registration: account_type Not Being Sent

**Root cause:** The signup form collects `Account Type` (Individual vs Employer) but the JS is not passing it in `raw_user_meta_data` when calling `supabase.auth.signUp()`.

In `auth.html` (or the signup JS), find the `supabase.auth.signUp()` call and ensure metadata is included:

```js
const accountType = document.getElementById('accountType').value; // 'individual' or 'employer'
const fullName = document.getElementById('fullName').value;
const orgName = document.getElementById('orgName').value;

const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      full_name: fullName,
      account_type: accountType,           // CRITICAL — was missing
      organization_name: orgName || null,
      organization_kra: orgKra || null,
    }
  }
});
```

Also: After signup, redirect employer accounts to the new **Organisation Profile Setup** page (see FIX E).

---

### FIX D — Payslip History Not Saving

The `payslip_history` table had no INSERT RLS policy (now fixed in DB). The frontend may also not be calling the insert. Find where payslips are generated and add the save call:

```js
// After generating a payslip, save to history
if (session?.user) {
  await supabase.from('payslip_history').insert({
    user_id: session.user.id,
    employee_id: selectedEmployee?.id ?? null,
    employee_name: employeeName,
    pay_period: `${selectedMonth} ${selectedYear}`,
    gross_salary: grossSalary,
    net_salary: netSalary,
    paye: payeAmount,
    nssf: nssfAmount,
    shif: shifAmount,
    housing_levy: housingLevy,
  });
}
```

---

### FIX E — New Feature: Organisation Profile Page

**Purpose:** Employers fill their company details ONCE and the payslip generator auto-populates them every time — no re-entering company name, KRA PIN, logo, etc.

**Database table:** `employers` (already exists and is ready)

**Fields to expose in the profile form:**
- Company Name (`organization_name`)
- KRA PIN (`organization_kra_pin`)
- NSSF Number (`nssf_number`)
- NHIF/SHIF Number (`nhif_number`)
- Registration Number (`registration_number`)
- Business Type (`business_type`) — dropdown: Sole Proprietor, Partnership, Limited Company, NGO, Government, Other
- Industry (`industry`)
- County (`county`)
- Physical Address (`physical_address`)
- Contact Email (`contact_email`)
- Contact Phone (`contact_phone`)
- Website (`website`)
- Payroll Day (`payroll_day`) — day of month (1–31)
- Bank Name (`bank_name`)
- Bank Account Number (`bank_account`)
- Bank Branch (`bank_branch`)
- M-Pesa Paybill (`paybill_number`)
- Company Logo (`logo_url`) — upload to Supabase Storage bucket `org-logos`

**Logo upload flow:**
```js
// Upload to Supabase Storage
const file = logoInput.files[0];
const filePath = `${session.user.id}/${Date.now()}-${file.name}`;
const { data, error } = await supabase.storage
  .from('org-logos')
  .upload(filePath, file, { upsert: true });

const publicUrl = supabase.storage.from('org-logos').getPublicUrl(filePath).data.publicUrl;

// Save URL to employers table
await supabase.from('employers').upsert({
  user_id: session.user.id,
  logo_url: publicUrl,
  // ...other fields
}, { onConflict: 'user_id' });
```

**Where to add this page:**
- Create `/organisation-profile.html` (or `/org-profile.html`)
- Add to nav under logged-in employer account menu
- Redirect new employer registrations here after signup
- Show a "Profile incomplete" banner on dashboard/payslip generator if `profile_complete = false`

**Auto-fill payslip generator:**
When an employer opens the payslip generator, fetch their profile:
```js
const { data: orgProfile } = await supabase
  .from('employers')
  .select('*')
  .eq('user_id', session.user.id)
  .single();

if (orgProfile) {
  document.getElementById('companyName').value = orgProfile.organization_name;
  document.getElementById('companyKraPIN').value = orgProfile.organization_kra_pin;
  document.getElementById('companyLogo').src = orgProfile.logo_url;
  // ...etc
}
```

---

### FIX F — Newsletter Subscription Not Working

Find the newsletter subscribe button handler and ensure it's doing a proper upsert:
```js
const { error } = await supabase.from('newsletter_subscribers').upsert({
  email: subscriberEmail,
  user_id: session?.user?.id ?? null,
  confirmed: false,
  source: 'homepage',
}, { onConflict: 'email' });
```

---

### FIX G — Saved Calculations Not Saving

Same as payslip history — the RLS INSERT policy is now fixed in DB. Find the save calculation function and confirm it's inserting with `user_id: session.user.id`. Add error handling and user feedback (success toast / error message) so the user knows if saving succeeded.

---

## 📊 Database Table Reference (Full Audit)

| Table | Rows | Status | Use Case |
|-------|------|--------|----------|
| `user_profiles` | 96 | ⚠️ Broken | All `account_type` is NULL — fix via registration (FIX C) |
| `employees` | 12 | ✅ Working | Employer's employee roster |
| `employers` | 0 | ✅ Ready | Org profile — needs frontend (FIX E) |
| `poll_participants` | 8 | ✅ Fixed (DB) | Who voted on each poll |
| `poll_votes` | 12 | ✅ Fixed (DB) | Aggregated vote counts per option |
| `payslip_history` | 0 | ✅ Fixed (DB) | Generated payslip log — needs frontend insert |
| `saved_calculations` | 0 | ✅ Fixed (DB) | Saved salary calc — needs frontend insert |
| `newsletter_subscribers` | 0 | ✅ Fixed (DB) | Email subscribers — needs frontend fix |
| `paystack_transactions` | 0 | ⚠️ Broken | Payment log — Paystack webhook likely not configured |
| `blog_posts` | 0 | ℹ️ Empty | Blog content — not a bug, just no content yet |
| `app_settings` | 7 | ✅ New | Canonical pricing + config values |
| `paypal_transactions_archived` | 0 | 🗑️ Deprecated | PayPal replaced by Paystack — safe to ignore |
| `admin_users` | 2 | ✅ Working | Admin access control |

---

## ⚠️ Paystack Webhook (Separate Investigation Needed)

`paystack_transactions` has 0 rows despite 96 users. This means no payments have been recorded — either:
1. Paystack webhook URL is not configured in the Paystack dashboard
2. The webhook handler endpoint is broken/returning errors
3. No one has actually paid (least likely)

**Action needed:** In Paystack dashboard → Settings → Webhooks, confirm the webhook URL is set to your Vercel endpoint (e.g. `https://salarycalculator.co.ke/api/paystack-webhook` or a Supabase Edge Function URL). Then check the webhook logs for failed deliveries.

---

## 🎨 UI Notes

- All new pages should follow existing site design (dark mode toggle supported, existing nav pattern)
- Organisation Profile page should feel like a settings/account page, not a form page
- Show a progress indicator / profile completeness % to encourage employers to fill everything
- Poll result bars should animate on reveal after voting

---

*DB migrations applied by Claude. Frontend implementation by Copilot.*
