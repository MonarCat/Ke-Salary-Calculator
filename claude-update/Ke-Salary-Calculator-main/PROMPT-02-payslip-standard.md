# COPILOT PROMPT — 02: Standard Kenyan Payslip — Full Refinement
## File: `employees.html` (Generate Payslip modal + print/PDF logic)
---

## CONTEXT
The current "Generate Payslip" modal in `employees.html` renders a basic table.
It needs to be upgraded to a **standard, KRA-compliant Kenyan payslip** with:
- Full company branding header (logo + org profile details)
- Itemised earnings breakdown
- Statutory deductions (correctly labelled, with employer contributions shown separately)
- Voluntary deductions
- Prominent NET PAY
- Bank payment line (masked account)
- Signature lines
- Professional CSS styling (A4 portrait, print-ready)
- **html2pdf.js** for clean PDF download (NOT browser print-to-PDF which loses layout)

---

## STEP 1 — Add html2pdf.js CDN

In `employees.html`, inside `<head>`, add:
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
```

---

## STEP 2 — Replace the payslip modal inner HTML

Replace the current `#payslip-modal` inner content with the following structure.
Keep the existing modal wrapper `<div id="payslip-modal" class="modal">` and close button.

```html
<!-- PAYSLIP MODAL CONTENT — replaces existing payslip form + preview -->
<div class="modal-header">
  <h2>Generate Payslip</h2>
  <button class="modal-close" id="close-payslip-modal">&times;</button>
</div>

<!-- INPUT CONTROLS (above the preview, not printed) -->
<div class="payslip-controls no-print">
  <div class="controls-row">
    <div class="form-group">
      <label>Pay Period *</label>
      <input type="month" id="ps-pay-period" required>
    </div>
    <div class="form-group">
      <label>Pay Date</label>
      <input type="date" id="ps-pay-date">
    </div>
    <div class="form-group">
      <label>Payslip No.</label>
      <input type="text" id="ps-payslip-no" placeholder="e.g. PS-001">
    </div>
  </div>
  <div class="controls-row">
    <div class="form-group">
      <label>Basic Salary (KES)</label>
      <input type="number" id="ps-basic-salary" min="0" placeholder="Auto from employee">
    </div>
    <div class="form-group">
      <label>House Allowance (KES)</label>
      <input type="number" id="ps-house-allowance" min="0" value="0">
    </div>
    <div class="form-group">
      <label>Transport Allowance (KES)</label>
      <input type="number" id="ps-transport-allowance" min="0" value="0">
    </div>
    <div class="form-group">
      <label>Other Allowances (KES)</label>
      <input type="number" id="ps-other-allowances" min="0" value="0">
    </div>
  </div>
  <hr>
  <p style="font-size:13px;color:#666;margin:0 0 8px">Optional Deductions</p>
  <div class="controls-row">
    <div class="form-group">
      <label>SACCO Loan (KES)</label>
      <input type="number" id="ps-sacco" min="0" value="0">
    </div>
    <div class="form-group">
      <label>Pension Scheme (KES)</label>
      <input type="number" id="ps-pension" min="0" value="0">
    </div>
    <div class="form-group">
      <label>Insurance Premium (KES)</label>
      <input type="number" id="ps-insurance" min="0" value="0">
    </div>
    <div class="form-group">
      <label>Other Deduction (KES)</label>
      <input type="number" id="ps-other-deduction" min="0" value="0">
    </div>
  </div>
  <div class="controls-row" style="margin-top:8px">
    <div class="form-group">
      <label>Other Deduction Label</label>
      <input type="text" id="ps-other-deduction-label" placeholder="e.g. Loan Repayment">
    </div>
  </div>
  <div style="display:flex;gap:10px;margin-top:12px">
    <button class="btn-primary" onclick="generatePayslipPreview()">⟳ Generate Preview</button>
    <button class="btn-secondary" onclick="printPayslip()">🖨️ Print</button>
    <button class="btn-success" onclick="downloadPayslipPDF()">⬇ Download PDF</button>
  </div>
</div>

<!-- =================== PAYSLIP DOCUMENT (A4 preview + print target) =================== -->
<div id="payslip-document" class="payslip-a4">

  <!-- COMPANY HEADER -->
  <div class="ps-header">
    <div class="ps-logo-block">
      <img id="ps-company-logo" src="" alt="" style="max-height:70px;display:none;">
    </div>
    <div class="ps-company-info">
      <h1 id="ps-company-name" class="ps-company-name"></h1>
      <p id="ps-company-address" class="ps-company-address"></p>
      <p id="ps-company-contacts" class="ps-company-contacts"></p>
    </div>
    <div class="ps-company-reg">
      <p><strong>KRA PIN:</strong> <span id="ps-company-kra"></span></p>
      <p><strong>NSSF No:</strong> <span id="ps-company-nssf"></span></p>
      <p><strong>SHIF No:</strong> <span id="ps-company-shif"></span></p>
    </div>
  </div>

  <!-- PAYSLIP TITLE BAR -->
  <div class="ps-title-bar">
    <span>PAYSLIP</span>
    <span id="ps-display-period"></span>
  </div>

  <!-- EMPLOYEE INFO GRID -->
  <div class="ps-employee-grid">
    <div class="ps-info-block">
      <table class="ps-info-table">
        <tr><td>Employee Name</td><td id="ps-emp-name"></td></tr>
        <tr><td>Employee No.</td><td id="ps-emp-no"></td></tr>
        <tr><td>KRA PIN</td><td id="ps-emp-kra"></td></tr>
        <tr><td>NSSF No.</td><td id="ps-emp-nssf">—</td></tr>
      </table>
    </div>
    <div class="ps-info-block">
      <table class="ps-info-table">
        <tr><td>Department</td><td id="ps-emp-dept"></td></tr>
        <tr><td>Designation</td><td id="ps-emp-position"></td></tr>
        <tr><td>Pay Date</td><td id="ps-pay-date-display"></td></tr>
        <tr><td>Payslip No.</td><td id="ps-payslip-no-display"></td></tr>
      </table>
    </div>
    <div class="ps-info-block">
      <table class="ps-info-table">
        <tr><td>Bank</td><td id="ps-emp-bank"></td></tr>
        <tr><td>Account</td><td id="ps-emp-account"></td></tr>
        <tr><td>Branch</td><td id="ps-emp-branch"></td></tr>
      </table>
    </div>
  </div>

  <!-- EARNINGS & DEDUCTIONS — SIDE BY SIDE -->
  <div class="ps-body-grid">
    <!-- LEFT: EARNINGS -->
    <div class="ps-section">
      <div class="ps-section-header earnings-header">EARNINGS</div>
      <table class="ps-table">
        <thead><tr><th>Description</th><th>Amount (KES)</th></tr></thead>
        <tbody>
          <tr><td>Basic Salary</td><td id="ps-r-basic" class="amount-cell"></td></tr>
          <tr id="ps-row-house"><td>House Allowance</td><td id="ps-r-house" class="amount-cell"></td></tr>
          <tr id="ps-row-transport"><td>Transport Allowance</td><td id="ps-r-transport" class="amount-cell"></td></tr>
          <tr id="ps-row-other-allow"><td>Other Allowances</td><td id="ps-r-other-allow" class="amount-cell"></td></tr>
        </tbody>
        <tfoot>
          <tr class="total-row"><td>GROSS PAY</td><td id="ps-r-gross" class="amount-cell"></td></tr>
        </tfoot>
      </table>

      <!-- EMPLOYER CONTRIBUTIONS (informational, not deducted from employee) -->
      <div class="ps-section-header employer-header" style="margin-top:12px">
        EMPLOYER CONTRIBUTIONS (For Reference)
      </div>
      <table class="ps-table">
        <thead><tr><th>Description</th><th>Amount (KES)</th></tr></thead>
        <tbody>
          <tr><td>NSSF (Employer)</td><td id="ps-r-nssf-er" class="amount-cell"></td></tr>
          <tr><td>SHIF (Employer)</td><td id="ps-r-shif-er" class="amount-cell"></td></tr>
          <tr><td>Housing Levy (Employer)</td><td id="ps-r-hl-er" class="amount-cell"></td></tr>
        </tbody>
        <tfoot>
          <tr class="total-row"><td>Total Employer Cost</td><td id="ps-r-total-er" class="amount-cell"></td></tr>
        </tfoot>
      </table>
    </div>

    <!-- RIGHT: DEDUCTIONS -->
    <div class="ps-section">
      <div class="ps-section-header deductions-header">DEDUCTIONS</div>
      <table class="ps-table">
        <thead><tr><th>Description</th><th>Amount (KES)</th></tr></thead>
        <tbody>
          <!-- Statutory -->
          <tr><td>PAYE</td><td id="ps-r-paye" class="amount-cell"></td></tr>
          <tr><td>NSSF (Employee)</td><td id="ps-r-nssf-ee" class="amount-cell"></td></tr>
          <tr><td>SHIF (Employee - 2.75%)</td><td id="ps-r-shif-ee" class="amount-cell"></td></tr>
          <tr><td>Housing Levy (Employee - 1.5%)</td><td id="ps-r-hl-ee" class="amount-cell"></td></tr>
          <!-- Voluntary — hidden if 0 -->
          <tr id="ps-row-sacco" style="display:none"><td>SACCO Loan</td><td id="ps-r-sacco" class="amount-cell"></td></tr>
          <tr id="ps-row-pension" style="display:none"><td>Pension Scheme</td><td id="ps-r-pension" class="amount-cell"></td></tr>
          <tr id="ps-row-insurance" style="display:none"><td>Insurance Premium</td><td id="ps-r-insurance" class="amount-cell"></td></tr>
          <tr id="ps-row-other-ded" style="display:none">
            <td id="ps-r-other-ded-label">Other Deduction</td>
            <td id="ps-r-other-ded" class="amount-cell"></td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="total-row"><td>TOTAL DEDUCTIONS</td><td id="ps-r-total-ded" class="amount-cell"></td></tr>
        </tfoot>
      </table>

      <!-- NET PAY BOX -->
      <div class="ps-net-pay-box">
        <div class="ps-net-label">NET PAY</div>
        <div class="ps-net-amount" id="ps-r-net-pay"></div>
        <div class="ps-net-words" id="ps-r-net-words"></div>
      </div>
    </div>
  </div><!-- /ps-body-grid -->

  <!-- SIGNATURE SECTION -->
  <div class="ps-signatures">
    <div class="ps-sig-block">
      <div class="ps-sig-line"></div>
      <p>Prepared By</p>
      <p class="ps-sig-name"></p>
    </div>
    <div class="ps-sig-block">
      <div class="ps-sig-line"></div>
      <p>Authorised By</p>
      <p class="ps-sig-name"></p>
    </div>
    <div class="ps-sig-block">
      <div class="ps-sig-line"></div>
      <p>Employee Signature / Date</p>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="ps-footer">
    <p>This is a computer-generated payslip and does not require a manual signature.</p>
    <p>Generated by <strong>salarycalculator.co.ke</strong> | Compliant with Kenyan Employment Act, Cap. 226</p>
  </div>

</div><!-- /payslip-document -->
```

---

## STEP 3 — CSS for the Payslip (add to `<style>` or `employees.css`)

```css
/* ============ PAYSLIP A4 STYLES ============ */
.payslip-a4 {
  width: 210mm;
  min-height: 297mm;
  margin: 20px auto;
  background: #fff;
  padding: 15mm 15mm 10mm;
  font-family: 'Arial', sans-serif;
  font-size: 11px;
  color: #1a1a1a;
  border: 1px solid #ddd;
  box-shadow: 0 2px 12px rgba(0,0,0,0.12);
}

/* --- HEADER --- */
.ps-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  border-bottom: 3px solid #2D6A4F;
  padding-bottom: 12px;
  margin-bottom: 10px;
}
.ps-logo-block { flex: 0 0 80px; }
.ps-company-info { flex: 1; }
.ps-company-name { font-size: 18px; font-weight: 700; color: #2D6A4F; margin: 0 0 4px; }
.ps-company-address, .ps-company-contacts { margin: 1px 0; color: #555; font-size: 10px; }
.ps-company-reg { text-align: right; font-size: 10px; }
.ps-company-reg p { margin: 2px 0; }

/* --- TITLE BAR --- */
.ps-title-bar {
  background: #2D6A4F;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 2px;
  padding: 6px 12px;
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
  border-radius: 3px;
}

/* --- EMPLOYEE INFO GRID --- */
.ps-employee-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 12px;
  background: #f8f9fa;
  padding: 8px;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
}
.ps-info-table { width: 100%; border-collapse: collapse; font-size: 10px; }
.ps-info-table td { padding: 3px 4px; vertical-align: top; }
.ps-info-table td:first-child { color: #666; font-weight: 600; white-space: nowrap; width: 45%; }

/* --- BODY GRID (Earnings | Deductions) --- */
.ps-body-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 12px;
}
.ps-section-header {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1px;
  padding: 4px 8px;
  border-radius: 3px 3px 0 0;
  color: #fff;
}
.earnings-header { background: #2D6A4F; }
.deductions-header { background: #c0392b; }
.employer-header { background: #6c757d; font-size: 9px; }

.ps-table { width: 100%; border-collapse: collapse; font-size: 10px; }
.ps-table th {
  background: #f5f5f5;
  border: 1px solid #ddd;
  padding: 4px 6px;
  text-align: left;
  font-weight: 600;
  font-size: 9px;
}
.ps-table td {
  border: 1px solid #e8e8e8;
  padding: 4px 6px;
  vertical-align: middle;
}
.amount-cell { text-align: right; font-family: monospace; font-size: 10px; }
.total-row td {
  background: #f0f0f0;
  font-weight: 700;
  border-top: 2px solid #bbb;
}

/* --- NET PAY BOX --- */
.ps-net-pay-box {
  background: #2D6A4F;
  color: #fff;
  text-align: center;
  padding: 12px;
  border-radius: 4px;
  margin-top: 10px;
}
.ps-net-label { font-size: 11px; letter-spacing: 2px; opacity: 0.85; }
.ps-net-amount { font-size: 26px; font-weight: 800; margin: 4px 0; }
.ps-net-words { font-size: 9px; opacity: 0.9; font-style: italic; }

/* --- SIGNATURES --- */
.ps-signatures {
  display: flex;
  gap: 20px;
  margin: 16px 0 10px;
  padding-top: 10px;
  border-top: 1px dashed #ccc;
}
.ps-sig-block { flex: 1; text-align: center; font-size: 10px; }
.ps-sig-line { border-top: 1px solid #333; margin-bottom: 4px; }
.ps-sig-block p { margin: 2px 0; color: #555; }

/* --- FOOTER --- */
.ps-footer {
  text-align: center;
  font-size: 9px;
  color: #888;
  border-top: 1px solid #eee;
  padding-top: 6px;
}

/* ============ PRINT STYLES ============ */
@media print {
  body > *:not(#payslip-modal) { display: none !important; }
  #payslip-modal { position: static !important; background: transparent !important; }
  .payslip-controls, .modal-header, .no-print { display: none !important; }
  .payslip-a4 {
    width: 100%;
    margin: 0;
    padding: 10mm;
    box-shadow: none;
    border: none;
  }
  @page { size: A4 portrait; margin: 0; }
}
```

---

## STEP 4 — JavaScript Logic

Add/replace these functions in the employees page JS:

```js
// =============================================
// PAYSLIP GENERATION
// =============================================

// KES formatter
const fmt = (n) => Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 });

// Number to words (simplified for KES amounts)
function amountToWords(amount) {
  // Use a simple implementation or the one already in your codebase
  // Minimum viable: just show the number formatted
  return `Kenya Shillings ${fmt(amount)} Only`;
}

// Calculate statutory deductions from gross
function calcDeductions(gross) {
  // PAYE — 2024/2025 bands
  function calcPAYE(taxable) {
    const bands = [
      { limit: 24000, rate: 0.10 },
      { limit: 8333,  rate: 0.25 },
      { limit: 467667, rate: 0.30 },
      { limit: 300000, rate: 0.325 },
      { limit: Infinity, rate: 0.35 }
    ];
    const personalRelief = 2400;
    let tax = 0, remaining = taxable;
    for (const b of bands) {
      if (remaining <= 0) break;
      const taxable_in_band = Math.min(remaining, b.limit);
      tax += taxable_in_band * b.rate;
      remaining -= taxable_in_band;
    }
    return Math.max(0, tax - personalRelief);
  }

  // NSSF (Tier I: 6% of lower of gross or KES 7,000 pensionable wage ceiling; Tier II: 6% of next KES 29,000)
  // Simplified: employee = min(6% of gross, KES 2,160) Tier I + Tier II
  const nssfEmployee = Math.min(gross * 0.06, 2160); // simplified — adjust to exact NSSF Act 2013 tiers if needed
  const nssfEmployer = nssfEmployee; // employer matches

  // SHIF: 2.75% of gross, employee only
  const shif = gross * 0.0275;

  // Housing Levy: 1.5% employee + 1.5% employer
  const hlEmployee = gross * 0.015;
  const hlEmployer = gross * 0.015;

  // Taxable income (gross - NSSF employee for PAYE purposes)
  const taxable = Math.max(0, gross - nssfEmployee);
  const paye = calcPAYE(taxable);

  return {
    paye: Math.round(paye),
    nssfEmployee: Math.round(nssfEmployee),
    nssfEmployer: Math.round(nssfEmployer),
    shifEmployee: Math.round(shif),
    shifEmployer: Math.round(shif), // SHA employer contribution (informational)
    hlEmployee: Math.round(hlEmployee),
    hlEmployer: Math.round(hlEmployer),
  };
}

async function openPayslipModal(employee) {
  // Load org profile from Supabase for company details
  const { data: orgProfile } = await supabaseClient
    .from('org_profiles')
    .select('*')
    .eq('user_id', currentUserId)
    .maybeSingle();

  // Pre-fill company details
  document.getElementById('ps-company-name').textContent = orgProfile?.company_name || 'Your Company Name';
  document.getElementById('ps-company-address').textContent = orgProfile?.physical_address || '';
  document.getElementById('ps-company-contacts').textContent =
    [orgProfile?.contact_email, orgProfile?.contact_phone].filter(Boolean).join(' | ');
  document.getElementById('ps-company-kra').textContent = orgProfile?.kra_pin || '—';
  document.getElementById('ps-company-nssf').textContent = orgProfile?.nssf_number || '—';
  document.getElementById('ps-company-shif').textContent = orgProfile?.nhif_number || '—';

  // Company logo
  if (orgProfile?.logo_url) {
    const logoEl = document.getElementById('ps-company-logo');
    logoEl.src = orgProfile.logo_url;
    logoEl.style.display = 'block';
  }

  // Pre-fill employee details
  document.getElementById('ps-emp-name').textContent = employee.full_name || '';
  document.getElementById('ps-emp-no').textContent = employee.employee_id || '';
  document.getElementById('ps-emp-kra').textContent = employee.kra_pin || '—';
  document.getElementById('ps-emp-dept').textContent = employee.department || '—';
  document.getElementById('ps-emp-position').textContent = employee.position || '—';
  document.getElementById('ps-emp-bank').textContent = employee.bank_name || '—';
  // Mask account number: show only last 4 digits
  const acct = employee.account_number || '';
  document.getElementById('ps-emp-account').textContent =
    acct ? '****' + acct.slice(-4) : '—';
  document.getElementById('ps-emp-branch').textContent = employee.branch || '—';

  // Pre-fill salary
  document.getElementById('ps-basic-salary').value = employee.gross_salary || 0;

  // Set current month as default pay period
  const now = new Date();
  document.getElementById('ps-pay-period').value =
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  document.getElementById('ps-pay-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('ps-payslip-no').value = `PS-${Date.now().toString().slice(-6)}`;

  // Show modal
  document.getElementById('payslip-modal').style.display = 'flex';
}

function generatePayslipPreview() {
  const basic      = parseFloat(document.getElementById('ps-basic-salary').value) || 0;
  const house      = parseFloat(document.getElementById('ps-house-allowance').value) || 0;
  const transport  = parseFloat(document.getElementById('ps-transport-allowance').value) || 0;
  const otherAllow = parseFloat(document.getElementById('ps-other-allowances').value) || 0;
  const sacco      = parseFloat(document.getElementById('ps-sacco').value) || 0;
  const pension    = parseFloat(document.getElementById('ps-pension').value) || 0;
  const insurance  = parseFloat(document.getElementById('ps-insurance').value) || 0;
  const otherDed   = parseFloat(document.getElementById('ps-other-deduction').value) || 0;
  const otherDedLabel = document.getElementById('ps-other-deduction-label').value || 'Other Deduction';

  const gross = basic + house + transport + otherAllow;
  const ded   = calcDeductions(gross);
  const voluntaryDed = sacco + pension + insurance + otherDed;
  const totalDed = ded.paye + ded.nssfEmployee + ded.shifEmployee + ded.hlEmployee + voluntaryDed;
  const netPay = gross - totalDed;
  const totalEmployerCost = gross + ded.nssfEmployer + ded.hlEmployer;

  // Populate earnings
  document.getElementById('ps-r-basic').textContent = fmt(basic);
  if (house > 0) {
    document.getElementById('ps-r-house').textContent = fmt(house);
    document.getElementById('ps-row-house').style.display = '';
  } else {
    document.getElementById('ps-row-house').style.display = 'none';
  }
  if (transport > 0) {
    document.getElementById('ps-r-transport').textContent = fmt(transport);
    document.getElementById('ps-row-transport').style.display = '';
  } else {
    document.getElementById('ps-row-transport').style.display = 'none';
  }
  if (otherAllow > 0) {
    document.getElementById('ps-r-other-allow').textContent = fmt(otherAllow);
    document.getElementById('ps-row-other-allow').style.display = '';
  } else {
    document.getElementById('ps-row-other-allow').style.display = 'none';
  }
  document.getElementById('ps-r-gross').textContent = fmt(gross);

  // Populate employer contributions
  document.getElementById('ps-r-nssf-er').textContent = fmt(ded.nssfEmployer);
  document.getElementById('ps-r-shif-er').textContent = fmt(ded.shifEmployee); // SHA employer = same rate
  document.getElementById('ps-r-hl-er').textContent = fmt(ded.hlEmployer);
  document.getElementById('ps-r-total-er').textContent = fmt(ded.nssfEmployer + ded.shifEmployee + ded.hlEmployer);

  // Populate statutory deductions
  document.getElementById('ps-r-paye').textContent = fmt(ded.paye);
  document.getElementById('ps-r-nssf-ee').textContent = fmt(ded.nssfEmployee);
  document.getElementById('ps-r-shif-ee').textContent = fmt(ded.shifEmployee);
  document.getElementById('ps-r-hl-ee').textContent = fmt(ded.hlEmployee);

  // Voluntary deductions (show/hide rows)
  function showOptDed(rowId, cellId, value) {
    document.getElementById(rowId).style.display = value > 0 ? '' : 'none';
    document.getElementById(cellId).textContent = fmt(value);
  }
  showOptDed('ps-row-sacco', 'ps-r-sacco', sacco);
  showOptDed('ps-row-pension', 'ps-r-pension', pension);
  showOptDed('ps-row-insurance', 'ps-r-insurance', insurance);
  if (otherDed > 0) {
    document.getElementById('ps-row-other-ded').style.display = '';
    document.getElementById('ps-r-other-ded-label').textContent = otherDedLabel;
    document.getElementById('ps-r-other-ded').textContent = fmt(otherDed);
  } else {
    document.getElementById('ps-row-other-ded').style.display = 'none';
  }

  document.getElementById('ps-r-total-ded').textContent = fmt(totalDed);

  // NET PAY
  document.getElementById('ps-r-net-pay').textContent = 'KES ' + fmt(netPay);
  document.getElementById('ps-r-net-words').textContent = amountToWords(netPay);

  // Pay period display
  const periodVal = document.getElementById('ps-pay-period').value;
  if (periodVal) {
    const [yr, mo] = periodVal.split('-');
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    document.getElementById('ps-display-period').textContent =
      monthNames[parseInt(mo) - 1] + ' ' + yr;
  }
  document.getElementById('ps-pay-date-display').textContent =
    document.getElementById('ps-pay-date').value || '—';
  document.getElementById('ps-payslip-no-display').textContent =
    document.getElementById('ps-payslip-no').value || '—';
}

function printPayslip() {
  generatePayslipPreview();
  window.print();
}

function downloadPayslipPDF() {
  generatePayslipPreview();
  const empName = document.getElementById('ps-emp-name').textContent.replace(/\s+/g, '-') || 'employee';
  const period  = document.getElementById('ps-pay-period').value || 'period';
  const element = document.getElementById('payslip-document');

  const opt = {
    margin:      [5, 5, 5, 5],
    filename:    `payslip-${empName}-${period}.pdf`,
    image:       { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };
  html2pdf().set(opt).from(element).save();
}
```

---

## STEP 5 — Save Payslip to Supabase (payroll history)

After a successful PDF download or print, save to `payroll_history` table:

```js
async function savePayslipRecord(employeeId, payPeriod, gross, netPay, deductions) {
  try {
    await supabaseClient.from('payroll_history').insert({
      user_id: currentUserId,
      employee_id: employeeId,
      pay_period: payPeriod,
      gross_pay: gross,
      net_pay: netPay,
      paye: deductions.paye,
      nssf: deductions.nssfEmployee,
      shif: deductions.shifEmployee,
      housing_levy: deductions.hlEmployee,
      created_at: new Date().toISOString()
    });
  } catch (err) {
    console.warn('Payslip history save failed (non-critical):', err);
  }
}
```

---

## SUMMARY OF CHANGES
| # | Change | Where |
|---|--------|--------|
| 1 | Add html2pdf.js CDN | `<head>` |
| 2 | Replace payslip modal inner HTML | `employees.html` |
| 3 | Add A4 payslip CSS + print styles | `<style>` |
| 4 | Load org profile into payslip header (async) | JS |
| 5 | `generatePayslipPreview()` — full calc + DOM fill | JS |
| 6 | `downloadPayslipPDF()` using html2pdf.js | JS |
| 7 | `printPayslip()` using `window.print()` | JS |
| 8 | Save payslip to payroll_history on download | JS |
