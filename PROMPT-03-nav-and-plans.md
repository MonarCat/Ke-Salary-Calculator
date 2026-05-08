# COPILOT PROMPT — 03: Reverse Calculator Nav + Premium Feature Matrix
## Files: All HTML pages (global nav) + `account.html` / plan comparison
---

## PART A — Reverse Calculator: Add to Global Navigation

### Problem
`reverse-salary-calculator.html` is currently only linked from inside `employees.html`
as a tool button. It must appear in the **Calculators dropdown** of the global nav,
alongside Salary Calculator, PAYE Calculator, Statutory Deductions, and Payslip Generator.

### Fix — Apply to EVERY page's `<nav>` Calculators dropdown

Locate the Calculators dropdown block (present on every page). It currently reads:
```html
<div class="nav-dropdown">
  <a href="/calculator.html">Salary Calculator</a>
  <a href="/paye-calculator-kenya.html">PAYE Calculator</a>
  <a href="/statutory-deductions-kenya.html">Statutory Deductions</a>
  <a href="/payslip-generator-kenya.html">Payslip Generator</a>
</div>
```

Replace with:
```html
<div class="nav-dropdown">
  <a href="/calculator.html">Salary Calculator</a>
  <a href="/paye-calculator-kenya.html">PAYE Calculator</a>
  <a href="/statutory-deductions-kenya.html">Statutory Deductions</a>
  <a href="/payslip-generator-kenya.html">Payslip Generator</a>
  <a href="/reverse-salary-calculator.html">Reverse Calculator</a>
  <a href="/salary-after-tax.html">Salary After Tax</a>
  <a href="/global-salary-calculator.html">Global Calculator</a>
  <a href="/budget-planner.html">Budget Planner</a>
</div>
```

> **Note:** If there is a shared nav partial / include file (e.g. `nav.html`, `header.html`
> or a JS-rendered nav component), make the change only in that one file.
> If nav is copy-pasted across pages, a global find-and-replace across all `.html` files is needed.

---

## PART B — Remove Reverse Calculator from `employees.html` quick-links row

In `employees.html`, the Reverse Calculator currently appears as a button in the
"quick tools" row below the employee table. Remove it from there since it now lives
in the global nav:

```html
<!-- REMOVE this link from the quick-tools row in employees.html: -->
<a href="/reverse-salary-calculator.html" class="tool-btn">Reverse Calculator</a>
```

Keep: Payroll Import, P9A Generator (these are org-specific tools that belong there).

---

## PART C — Premium Feature Gating Matrix

Define the feature access rules clearly. Implement these as a central `PLAN_FEATURES`
config object read by all pages at runtime, rather than scattering `if (isPremium)`
checks ad hoc.

### Central config object (add to a shared `js/plan-features.js` or inline in `auth.js`)

```js
// ============================================================
// PLAN FEATURES CONFIG — single source of truth
// Edit this object when plans change; all pages read from it.
// ============================================================
const PLAN_FEATURES = {

  free: {
    label: 'Free Plan',
    // Calculator tools — always available to all
    calculators: true,          // Salary, PAYE, Statutory, Reverse, After-Tax, Global, Budget
    payslipGenerator: true,     // /payslip-generator-kenya.html — 2 downloads/month
    payslipDownloadsPerMonth: 2,

    // Employee Management
    maxEmployees: 2,
    bulkPayslips: false,
    payrollHistory: false,
    payrollReport: false,
    csvExport: false,
    pdfExport: false,
    p9aGenerator: false,
    payrollImport: false,
    orgProfile: false,
  },

  // ── PERSONAL PREMIUM ──────────────────────────────────────
  // For individual employees / sole traders tracking own salary
  premium_personal: {
    label: 'Premium — Personal',
    calculators: true,
    payslipGenerator: true,       // Unlimited payslip downloads
    payslipDownloadsPerMonth: Infinity,
    personalPayslipHistory: true, // View own past payslips
    p9aPersonal: true,            // Generate own annual P9A form
    budgetPlanner: true,          // Full Budget Planner (premium features)
    csvExport: true,              // Export own payslip history to CSV

    // NOT included in Personal:
    maxEmployees: 0,              // Cannot manage employees
    bulkPayslips: false,
    payrollHistory: false,
    payrollReport: false,
    orgProfile: false,
    payrollImport: false,
    p9aGenerator: false,          // Org P9A (for multiple employees) not included
  },

  // ── ORGANISATION PREMIUM ─────────────────────────────────
  // For employers / HR managing a team
  premium_org: {
    label: 'Premium — Organisation',
    calculators: true,
    payslipGenerator: true,
    payslipDownloadsPerMonth: Infinity,
    maxEmployees: 1000,
    bulkPayslips: true,           // Bulk generate payslips for all employees
    payrollHistory: true,         // Full payroll history (all employees)
    payrollReport: true,          // Payroll analytics & reports page
    csvExport: true,              // Export payroll data (CSV)
    pdfExport: true,              // Export payroll data (PDF)
    p9aGenerator: true,           // P9A for all employees
    payrollImport: true,          // Import payroll from CSV/Excel
    orgProfile: true,             // Organisation profile & branding
    multipleDepts: true,          // Department management
    kraComplianceReports: true,   // KRA-formatted statutory reports
    personalPayslipHistory: true,
    p9aPersonal: true,
    budgetPlanner: true,
  }
};

// Helper — call this to check if current user can access a feature
function canAccess(feature) {
  const plan = getCurrentUserPlan(); // returns 'free' | 'premium_personal' | 'premium_org'
  return !!PLAN_FEATURES[plan]?.[feature];
}
```

### Page-level gating pattern

On each page that has premium-gated content, use:

```js
// On page load:
document.addEventListener('DOMContentLoaded', async () => {
  const plan = await getCurrentUserPlan();

  if (!canAccess('payrollReport')) {
    // Show upgrade prompt instead of report content
    document.getElementById('report-content').innerHTML = `
      <div class="upgrade-gate">
        <h3>📊 Payroll Reports — Organisation Premium</h3>
        <p>Unlock payroll analytics, compliance reports and CSV/PDF exports.</p>
        <a href="/account.html" class="btn-upgrade">Upgrade to Organisation Premium</a>
      </div>`;
    return;
  }
  // ... load actual report
});
```

---

## PART D — Personal Premium: Key Features to Surface

The following features should be clearly available to Personal Premium users.
Ensure each has a working page + nav link:

| Feature | Page | Status |
|---------|------|--------|
| Unlimited payslip downloads | `/payslip-generator-kenya.html` | Wire up download count removal |
| Own payslip history | `/payroll-history.html?mode=personal` | Filter history to user only |
| Personal P9A form | `/p9a-generator.html?mode=personal` | Pre-select user as "employee" |
| Budget Planner (full) | `/budget-planner.html` | Unlock premium budget features |
| CSV export of own data | In payroll-history page | Add export button for personal |

**For Personal mode on p9a-generator.html:**
When `?mode=personal` is in the URL (or user's account type is `personal`):
- Hide the "Select Employee" dropdown
- Pre-fill with the logged-in user's own name, KRA PIN
- Show a single "My Annual Tax Card" UI
- Allow PDF download of their own P9A

---

## PART E — Pricing Correction

Confirm pricing displayed across all plan comparison sections:

```
Free Plan:          KES 0/month
Premium Personal:   KES 99/month or KES 999/year  (saves ~2 months)
Premium Organisation: KES 99/month or KES 999/year (same price, more features)
```

> Both premium tiers cost the same — the distinction is **feature set**, not price.
> Ensure any pricing table on `account.html` or landing pages reflects this accurately.
> Add a clear comparison table row: "Account Type" → Personal / Organisation
> with a toggle or separate signup flow (radio: "I am an Employee" / "I am an Employer").

---

## SUMMARY OF CHANGES
| # | Change | File(s) |
|---|--------|---------|
| A | Add Reverse Calculator + 3 other tools to global Calculators nav | All `.html` files / shared nav |
| B | Remove Reverse Calculator from employees.html quick-links | `employees.html` |
| C | Add `PLAN_FEATURES` config object | `js/plan-features.js` (new) or `auth.js` |
| D | Surface Personal Premium features on relevant pages | `p9a-generator.html`, `payroll-history.html` |
| E | Verify pricing display consistency | `account.html` |
