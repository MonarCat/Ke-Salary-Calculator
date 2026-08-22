# COPILOT PROMPT — Payslip Save + P9A Chain Fix
# salarycalculator.co.ke
# Files: employees.html, p9a-generator.html, payslip-generator-kenya.html

---

## CONTEXT

The P9A generator (p9a-generator.html) auto-populate was silently failing because
payslips were never being saved to the database after generation. Root cause audit:

- `savePayslipRecord()` in employees.html wrote to `payroll_history` (table does not exist)
- Column names were wrong: used `gross_pay`/`net_pay` instead of `gross_salary`/`net_salary`
- `employee_name` was not included in the insert
- `.insert()` was used instead of `.upsert()` — duplicate rows on re-generate
- `bulkGeneratePayslips()` never called `savePayslipRecord()` at all
- `payslip-generator-kenya.html` is a dead SEO landing page with no actual tool
- `p9a-generator.html` still queries `payroll_history` causing 404 console noise

The correct table is `payslip_history` with columns:
  id, user_id, employee_id, employee_name, pay_period, gross_salary, net_salary,
  paye, nssf, shif, housing_levy, downloaded, download_date, created_at

Unique constraint `payslip_history_unique_period` on (user_id, employee_id, pay_period)
already exists in Supabase — confirmed. No migration needed.

---

## FIX 1 — employees.html: Replace `savePayslipRecord()`

FIND this entire function (lines ~1836–1864):

```js
async function savePayslipRecord() {
    try {
        if (!currentPayslipEmployee || !currentUser || !supabaseClient) return;
        const basic = parseFloat(document.getElementById('ps-basic-salary').value) || 0;
        const house = parseFloat(document.getElementById('ps-house-allowance').value) || 0;
        const transport = parseFloat(document.getElementById('ps-transport-allowance').value) || 0;
        const otherAllow = parseFloat(document.getElementById('ps-other-allowances').value) || 0;
        const gross = basic + house + transport + otherAllow;
        const ded = calcPayslipDeductions(gross);
        const voluntary = (parseFloat(document.getElementById('ps-sacco').value)||0) + (parseFloat(document.getElementById('ps-pension').value)||0) + (parseFloat(document.getElementById('ps-insurance').value)||0) + (parseFloat(document.getElementById('ps-other-deduction').value)||0);
        const netPay = gross - (ded.paye + ded.nssfEmployee + ded.shifEmployee + ded.hlEmployee + voluntary);

        const { error } = await supabaseClient.from('payroll_history').insert({
            user_id: currentUser.id,
            employee_id: currentPayslipEmployee.id,
            pay_period: document.getElementById('ps-pay-period').value || null,
            gross_pay: gross,
            net_pay: netPay,
            paye: ded.paye,
            nssf: ded.nssfEmployee,
            shif: ded.shifEmployee,
            housing_levy: ded.hlEmployee,
            created_at: new Date().toISOString()
        });
        if (error) throw error;
    } catch (e) {
        console.warn('Payslip history save failed (non-critical):', e);
    }
}
```

REPLACE WITH:

```js
async function savePayslipRecord(overrides = {}) {
    try {
        if (!currentPayslipEmployee || !currentUser || !supabaseClient) return;

        const basic      = parseFloat(document.getElementById('ps-basic-salary').value) || 0;
        const house      = parseFloat(document.getElementById('ps-house-allowance').value) || 0;
        const transport  = parseFloat(document.getElementById('ps-transport-allowance').value) || 0;
        const otherAllow = parseFloat(document.getElementById('ps-other-allowances').value) || 0;
        const gross      = overrides.gross ?? (basic + house + transport + otherAllow);

        const ded        = calcPayslipDeductions(gross);
        const voluntary  = (parseFloat(document.getElementById('ps-sacco').value)            || 0)
                         + (parseFloat(document.getElementById('ps-pension').value)           || 0)
                         + (parseFloat(document.getElementById('ps-insurance').value)         || 0)
                         + (parseFloat(document.getElementById('ps-other-deduction').value)   || 0);
        const netPay     = gross - (ded.paye + ded.nssfEmployee + ded.shifEmployee + ded.hlEmployee + voluntary);

        const payPeriod  = overrides.pay_period
            ?? document.getElementById('ps-pay-period').value
            ?? null;

        const { error } = await supabaseClient
            .from('payslip_history')
            .upsert({
                user_id:       currentUser.id,
                employee_id:   currentPayslipEmployee.id,
                employee_name: currentPayslipEmployee.name || '',
                pay_period:    payPeriod,
                gross_salary:  gross,
                net_salary:    netPay,
                paye:          ded.paye,
                nssf:          ded.nssfEmployee,
                shif:          ded.shifEmployee,
                housing_levy:  ded.hlEmployee,
                downloaded:    true,
                download_date: new Date().toISOString()
            }, { onConflict: 'user_id,employee_id,pay_period' });

        if (error) throw error;
    } catch (e) {
        console.warn('Payslip history save failed (non-critical):', e);
    }
}
```

---

## FIX 2 — employees.html: Wire bulk save into `bulkGeneratePayslips()`

FIND this block (lines ~1956–1964):

```js
            const previousEmployee = currentPayslipEmployee;
            const payslipBlocks = activeEmps.map((emp, idx) => {
                fillPayslipForEmployee(emp, profile, {
                    period,
                    payslipNo: `PS-${String(idx + 1).padStart(3, '0')}`
                });
                return `<div class="ps-page">${document.getElementById('payslip-document').outerHTML}</div>`;
            }).join('');
            currentPayslipEmployee = previousEmployee;
```

REPLACE WITH (convert map to for-loop so await works, add save):

```js
            const previousEmployee = currentPayslipEmployee;
            const payslipBlocks = [];
            for (let idx = 0; idx < activeEmps.length; idx++) {
                const emp = activeEmps[idx];
                fillPayslipForEmployee(emp, profile, {
                    period,
                    payslipNo: `PS-${String(idx + 1).padStart(3, '0')}`
                });
                payslipBlocks.push(
                    `<div class="ps-page">${document.getElementById('payslip-document').outerHTML}</div>`
                );
                await savePayslipRecord({ pay_period: period });
            }
            currentPayslipEmployee = previousEmployee;
```

---

## FIX 3 — p9a-generator.html: Remove `payroll_history` from sourceQueries

`payroll_history` does not exist in Supabase. Remove it from BOTH the
`isPersonalMode` and org branches of `sourceQueries` inside `autoPopulateFromHistory()`.

FIND the full `sourceQueries` declaration (~lines 708–750) and REPLACE WITH:

```js
const sourceQueries = isPersonalMode
    ? [
        {
            table: 'payslip_history',
            select: payslipHistorySelect,
            sourceLabel: 'personal payslip history',
            filters: [
                { op: 'eq', column: 'user_id', value: currentUser.id },
                { op: 'like', column: 'pay_period', value: yearPattern }
            ]
        }
    ]
    : [
        {
            table: 'payslip_history',
            select: payslipHistorySelect,
            sourceLabel: 'employee payslip history',
            filters: [
                { op: 'eq', column: 'user_id', value: currentUser.id },
                { op: 'eq', column: 'employee_id', value: employeeId },
                { op: 'like', column: 'pay_period', value: yearPattern }
            ]
        }
    ];
```

Also remove the now-unused variable declared just above it:

```js
// DELETE this line:
const payrollHistorySelect = 'pay_period, gross_pay, paye, nssf, shif, housing_levy, net_pay';
```

---

## FIX 4 — p9a-generator.html: Extend `isMissingRelationError()` to catch column errors

FIND (~line 585):

```js
function isMissingRelationError(error) {
    if (!error) return false;
    const combined = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`.toLowerCase();
    return error.code === 'PGRST205'
        || Number(error.status) === 404
        || combined.includes('schema cache')
        || combined.includes('could not find the table')
        || /relation .* does not exist/.test(combined);
}
```

REPLACE WITH:

```js
function isMissingRelationError(error) {
    if (!error) return false;
    const combined = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`.toLowerCase();
    return error.code === 'PGRST205'
        || error.code === 'PGRST116'
        || error.code === '42703'
        || Number(error.status) === 404
        || combined.includes('schema cache')
        || combined.includes('could not find the table')
        || combined.includes('does not exist');
}
```

---

## FIX 5 — payslip-generator-kenya.html: Redirect to employees.html

This file is a ceremonial SEO landing page with no actual payslip tool.
The canonical payslip generator lives at employees.html.

KEEP the entire `<head>` section (all meta/SEO tags) but:
1. Update the canonical tag: `<link rel="canonical" href="https://salarycalculator.co.ke/employees.html">`
2. Replace the entire `<body>` content with:

```html
<body>
    <script>
        // Canonical payslip generation tool lives at employees.html
        window.location.replace('/employees.html');
    </script>
    <noscript>
        <meta http-equiv="refresh" content="0; url=/employees.html">
        <p>Redirecting to <a href="/employees.html">Payslip Generator</a>…</p>
    </noscript>
</body>
```

---

## VERIFICATION CHECKLIST

After applying all fixes, test this sequence:

1. Go to employees.html → generate a payslip for any employee → download PDF
2. Run in Supabase SQL editor:
   ```sql
   SELECT employee_name, pay_period, gross_salary, net_salary, paye
   FROM payslip_history
   ORDER BY created_at DESC
   LIMIT 5;
   ```
   → Should show the just-generated payslip row

3. Go to employees.html → Bulk Generate → enter a pay period → confirm
   → Same SQL above should show one row per active employee

4. Go to p9a-generator.html → select the same employee + same year
   → "Auto-populate" button should fill the monthly table from step 1/3 data

5. Open browser console — no more 404 errors for `payroll_history`

6. Visit /payslip-generator-kenya.html → should redirect to /employees.html

---

## RULES

- Do NOT create `payroll_history` table — it is intentionally removed from the codebase
- Do NOT change `calcDeductions()` or `calcPayslipDeductions()` — calculation logic is correct
- Do NOT change the payslip HTML template or PDF generation — only the save logic changes
- The `payslipHistorySelect` alias in p9a-generator.html (`gross_pay:gross_salary`) is correct PostgREST rename syntax — do not change it
- `savePayslipRecord()` is called by both `printPayslip()` and `downloadPayslipPDF()` — both paths already wire it correctly, no changes needed there
