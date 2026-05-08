# salarycalculator.co.ke — Premium Feature Refinement
## Implementation Package — May 2026
---

## FILES IN THIS PACKAGE

| File | Priority | Scope |
|------|----------|-------|
| `PROMPT-01-org-profile-fix.md` | 🔴 Critical | Fix Supabase `.catch` bug, remove M-Pesa field, add Industry/County/Bank dropdowns |
| `PROMPT-02-payslip-standard.md` | 🔴 Critical | Standard Kenyan payslip (A4, html2pdf, employer contributions, net pay) |
| `PROMPT-03-nav-and-plans.md` | 🟡 High | Reverse Calculator in global nav, `PLAN_FEATURES` config, Personal Premium surface |
| `PROMPT-04-p9a-refinement.md` | 🟡 High | Official P9A columns, auto-populate from history, Personal mode, PDF landscape |

---

## RECOMMENDED IMPLEMENTATION ORDER

### Session 1 — Fix the broken thing first
→ **PROMPT-01** (Org Profile: Supabase bug + dropdowns)
Test: Fill org profile → Save → Reload → Verify all fields restored. No error toast.

### Session 2 — The most valuable premium feature
→ **PROMPT-02** (Payslip: standard format + PDF)
Test: Add a test employee → Generate Payslip → Preview renders → Download PDF → PDF is A4 with company header, all deductions, NET PAY box, signature lines.

### Session 3 — Navigation & plan clarity
→ **PROMPT-03** (Nav + Plan Features config)
Test: Reverse Calculator appears in Calculators dropdown on every page. Free user
sees upgrade prompts on payroll-report.html. Personal Premium user can access their P9A.

### Session 4 — P9A completion
→ **PROMPT-04** (P9A generator)
Test: Select employee + 2025 → Auto-populate from history → PDF downloads as landscape A4.
Personal Premium user at `/p9a-generator.html?mode=personal` sees own tax card.

---

## GLOBAL PATTERN RULES (apply in every session)

### Supabase calls — ALWAYS use await/try-catch
```js
// ✅ ALWAYS THIS:
try {
  const { data, error } = await supabaseClient.from('table').select('*').eq('col', val);
  if (error) throw error;
} catch (err) {
  console.error(err);
  showError('Something went wrong. Please try again.');
}

// ❌ NEVER THIS:
supabaseClient.from('table').select('*').eq('col', val).catch(fn);
```

### Premium gating — use PLAN_FEATURES config
```js
if (!canAccess('payrollReport')) { showUpgradePrompt(); return; }
```

### PDF downloads — use html2pdf.js (CDN: cdnjs.cloudflare.com)
```js
html2pdf().set(opt).from(element).save();
```

### KES formatting — always use
```js
const fmt = n => Number(n||0).toLocaleString('en-KE', { minimumFractionDigits: 2 });
```

---

## PLAN FEATURE QUICK REFERENCE

### Free Plan
- 2 employees max
- 2 payslip downloads/month
- All calculator tools ✅
- No payroll history, no reports, no P9A, no org profile

### Premium Personal (KES 99/mo or 999/yr)
- Unlimited payslip downloads (own payslips)
- Own P9A form (`?mode=personal`)
- Personal payslip history
- Budget Planner (full)
- CSV export of own data
- ❌ Cannot manage employees

### Premium Organisation (KES 99/mo or 999/yr — same price)
- Everything in Personal +
- Up to 1,000 employees
- Bulk payslip generation
- Payroll analytics & reports
- CSV + PDF payroll export
- Payroll import (CSV/Excel)
- KRA compliance reports
- Organisation profile & branding
- Multi-department management
- P9A for all employees

---

## SUPABASE TABLE REFERENCE

| Table | Purpose |
|-------|---------|
| `org_profiles` | Organisation profile (one row per org user) |
| `employees` | Employee records |
| `payroll_history` | Monthly payslip records per employee |
| `p9a_records` | Saved P9A drafts per employee/year |
| `user_profiles` | User account details, plan, account_type |

`user_profiles.account_type` values: `'personal'` | `'organisation'`
`user_profiles.premium_source` values: `'paystack'` | `'easter_gift_2026'` | `null` (free)
