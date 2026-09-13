/**
 * /assets/js/payslip-template.js
 *
 * Single source of truth for the professional A4 payslip used by both the
 * standalone Payslip Generator (calculator.html) and Employee Management
 * (employees.html). Markup and print CSS are extracted verbatim from
 * Employee Management's existing #payslip-document template, so the two
 * pages render an identical document instead of maintaining separate copies
 * that drift apart -- the same "shared engine" principle already applied to
 * tax calculations, applied here to the payslip template itself.
 *
 * Deliberately a plain classic script (no ES module `export`) so it can be
 * loaded with a normal <script src> tag on either page without a module
 * loader or bundler step.
 *
 * Usage:
 *   <div id="payslip-document"></div>
 *   <script src="/assets/js/payslip-template.js"></script>
 *   <script>
 *     document.getElementById('payslip-document').outerHTML = PayslipTemplate.markup();
 *     PayslipTemplate.applyProfile(employerProfile);
 *     PayslipTemplate.fillEmployee(employee, { period, payDate, payslipNo });
 *     PayslipTemplate.renderPreview({ basic, house, transport, otherAllow, sacco, pension, insurance, otherDed, otherDedLabel, period, payDate, payslipNo });
 *   </script>
 */
(function () {
  'use strict';

  // ── Markup (identical structure/ids to employees.html's #payslip-document) ──

  function markup() {
    return `<div id="payslip-document" class="payslip-a4" style="box-sizing:border-box;width:210mm;min-height:auto;margin:0 auto;background:#fff;padding:8mm 9mm 6mm;border:1px solid #ddd;box-shadow:0 2px 12px rgba(0,0,0,.12);font-size:10.5px;line-height:1.18;color:#1a1a1a;overflow:hidden;">
        <div class="ps-header" style="display:flex;align-items:flex-start;gap:16px;border-bottom:3px solid #2D6A4F;padding-bottom:12px;margin-bottom:10px;">
            <div class="ps-logo-block" style="flex:0 0 80px;">
                <img id="ps-company-logo" src="" alt="" style="max-height:70px;display:none;">
            </div>
            <div class="ps-company-info" style="flex:1;">
                <h1 id="ps-company-name" style="font-size:18px;font-weight:700;color:#2D6A4F;margin:0 0 4px;"></h1>
                <p id="ps-company-address" style="margin:1px 0;color:#555;font-size:10px;"></p>
                <p id="ps-company-contacts" style="margin:1px 0;color:#555;font-size:10px;"></p>
            </div>
            <div class="ps-company-reg" style="text-align:right;font-size:10px;">
                <p><strong>KRA PIN:</strong> <span id="ps-company-kra"></span></p>
                <p><strong>Registration No:</strong> <span id="ps-company-reg"></span></p>
                <p><strong>NSSF No:</strong> <span id="ps-company-nssf"></span></p>
                <p><strong>SHIF No:</strong> <span id="ps-company-shif"></span></p>
            </div>
        </div>

        <div class="ps-title-bar" style="background:#2D6A4F;color:#fff;font-size:14px;font-weight:700;letter-spacing:2px;padding:6px 12px;display:flex;justify-content:space-between;margin-bottom:10px;border-radius:3px;">
            <span>PAYSLIP</span>
            <span id="ps-display-period"></span>
        </div>

        <div class="ps-employee-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;background:#f8f9fa;padding:8px;border-radius:4px;border:1px solid #e0e0e0;">
            <div class="ps-info-block"><table class="ps-info-table" style="width:100%;font-size:10px;">
                <tr><td>Employee Name</td><td id="ps-emp-name"></td></tr>
                <tr><td>Employee No.</td><td id="ps-emp-no"></td></tr>
                <tr><td>KRA PIN</td><td id="ps-emp-kra"></td></tr>
                <tr><td>NSSF No.</td><td id="ps-emp-nssf">—</td></tr>
            </table></div>
            <div class="ps-info-block"><table class="ps-info-table" style="width:100%;font-size:10px;">
                <tr><td>Department</td><td id="ps-emp-dept"></td></tr>
                <tr><td>Designation</td><td id="ps-emp-position"></td></tr>
                <tr><td>Pay Date</td><td id="ps-pay-date-display"></td></tr>
                <tr><td>Payslip No.</td><td id="ps-payslip-no-display"></td></tr>
            </table></div>
            <div class="ps-info-block"><table class="ps-info-table" style="width:100%;font-size:10px;">
                <tr><td>Bank</td><td id="ps-emp-bank"></td></tr>
                <tr><td>Account</td><td id="ps-emp-account"></td></tr>
                <tr><td>Branch</td><td id="ps-emp-branch"></td></tr>
            </table></div>
        </div>

        <div class="ps-body-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
            <div class="ps-section">
                <div style="font-size:11px;font-weight:700;padding:4px 8px;border-radius:3px 3px 0 0;color:#fff;background:#2D6A4F;">EARNINGS</div>
                <table class="ps-table" style="width:100%;font-size:10px;border-collapse:collapse;">
                    <thead><tr><th>Description</th><th>Amount (KES)</th></tr></thead>
                    <tbody>
                        <tr><td>Basic Salary</td><td id="ps-r-basic" style="text-align:right;"></td></tr>
                        <tr id="ps-row-house"><td>House Allowance</td><td id="ps-r-house" style="text-align:right;"></td></tr>
                        <tr id="ps-row-transport"><td>Transport Allowance</td><td id="ps-r-transport" style="text-align:right;"></td></tr>
                        <tr id="ps-row-other-allow"><td>Other Allowances</td><td id="ps-r-other-allow" style="text-align:right;"></td></tr>
                    </tbody>
                    <tfoot><tr><td><strong>GROSS PAY</strong></td><td id="ps-r-gross" style="text-align:right;"></td></tr></tfoot>
                </table>

                <div style="font-size:9px;font-weight:700;padding:4px 8px;color:#fff;background:#6c757d;margin-top:12px;">EMPLOYER CONTRIBUTIONS (For Reference)</div>
                <table class="ps-table" style="width:100%;font-size:10px;border-collapse:collapse;">
                    <thead><tr><th>Description</th><th>Amount (KES)</th></tr></thead>
                    <tbody>
                        <tr><td>NSSF (Employer)</td><td id="ps-r-nssf-er" style="text-align:right;"></td></tr>
                        <tr><td>Housing Levy (Employer)</td><td id="ps-r-hl-er" style="text-align:right;"></td></tr>
                    </tbody>
                    <tfoot><tr><td><strong>Total Employer Cost</strong></td><td id="ps-r-total-er" style="text-align:right;"></td></tr></tfoot>
                </table>
            </div>

            <div class="ps-section">
                <div style="font-size:11px;font-weight:700;padding:4px 8px;border-radius:3px 3px 0 0;color:#fff;background:#c0392b;">DEDUCTIONS</div>
                <table class="ps-table" style="width:100%;font-size:10px;border-collapse:collapse;">
                    <thead><tr><th>Description</th><th>Amount (KES)</th></tr></thead>
                    <tbody>
                        <tr><td>PAYE</td><td id="ps-r-paye" style="text-align:right;"></td></tr>
                        <tr><td>NSSF (Employee)</td><td id="ps-r-nssf-ee" style="text-align:right;"></td></tr>
                        <tr><td>SHIF (Employee - 2.75%)</td><td id="ps-r-shif-ee" style="text-align:right;"></td></tr>
                        <tr><td>Housing Levy (Employee - 1.5%)</td><td id="ps-r-hl-ee" style="text-align:right;"></td></tr>
                        <tr id="ps-row-sacco" style="display:none"><td>SACCO Loan</td><td id="ps-r-sacco" style="text-align:right;"></td></tr>
                        <tr id="ps-row-pension" style="display:none"><td>Pension Scheme</td><td id="ps-r-pension" style="text-align:right;"></td></tr>
                        <tr id="ps-row-insurance" style="display:none"><td>Insurance Premium</td><td id="ps-r-insurance" style="text-align:right;"></td></tr>
                        <tr id="ps-row-other-ded" style="display:none"><td id="ps-r-other-ded-label">Other Deduction</td><td id="ps-r-other-ded" style="text-align:right;"></td></tr>
                    </tbody>
                    <tfoot><tr><td><strong>TOTAL DEDUCTIONS</strong></td><td id="ps-r-total-ded" style="text-align:right;"></td></tr></tfoot>
                </table>
                <div style="background:#2D6A4F;color:#fff;text-align:center;padding:8px;border-radius:4px;margin-top:7px;">
                    <div style="font-size:11px;letter-spacing:2px;opacity:.85;">NET PAY</div>
                    <div style="font-size:22px;font-weight:800;margin:2px 0;" id="ps-r-net-pay"></div>
                    <div style="font-size:9px;opacity:.9;font-style:italic;" id="ps-r-net-words"></div>
                </div>
            </div>
        </div>

        <div class="ps-signatures" style="display:flex;gap:20px;margin:16px 0 10px;padding-top:10px;border-top:1px dashed #ccc;">
            <div style="flex:1;text-align:center;font-size:10px;"><div style="border-top:1px solid #333;margin-bottom:4px;"></div><p>Prepared By</p></div>
            <div style="flex:1;text-align:center;font-size:10px;"><div style="border-top:1px solid #333;margin-bottom:4px;"></div><p>Authorised By</p></div>
            <div style="flex:1;text-align:center;font-size:10px;"><div style="border-top:1px solid #333;margin-bottom:4px;"></div><p>Employee Signature / Date</p></div>
        </div>

        <div style="text-align:center;font-size:9px;color:#888;border-top:1px solid #eee;padding-top:6px;">
            <p>This is a computer-generated payslip and does not require a manual signature.</p>
            <p>Generated by <strong>salarycalculator.co.ke</strong> | Compliant with Kenyan Employment Act, Cap. 226</p>
        </div>
    </div>`;
  }

  // Compact-for-print sizing rules, extracted verbatim from employees.html.
  var CSS = [
    '.payslip-a4{box-sizing:border-box!important;width:210mm!important;min-height:auto!important;margin:0 auto!important;padding:8mm 9mm 6mm!important;overflow:hidden!important;break-inside:avoid!important;page-break-inside:avoid!important;}',
    '.payslip-a4 *,.payslip-a4 *::before,.payslip-a4 *::after{box-sizing:border-box!important;}',
    '.payslip-a4 p{margin-top:1px!important;margin-bottom:1px!important;}',
    '.payslip-a4 table{table-layout:fixed!important;}',
    '.payslip-a4 th,.payslip-a4 td{padding:3px 5px!important;line-height:1.15!important;}',
    '.payslip-a4 .ps-header{padding-bottom:7px!important;margin-bottom:6px!important;}',
    '.payslip-a4 .ps-title-bar{margin-bottom:6px!important;padding-top:5px!important;padding-bottom:5px!important;}',
    '.payslip-a4 .ps-employee-grid{margin-bottom:7px!important;padding:6px!important;gap:6px!important;}',
    '.payslip-a4 .ps-body-grid{margin-bottom:7px!important;gap:9px!important;}',
    '.payslip-a4 .ps-signatures{margin:9px 0 5px!important;padding-top:8px!important;}',
    '@page{size:A4 portrait;margin:0;}'
  ].join('\n');

  // ── Formatting helpers ──────────────────────────────────────────────────

  function fmt(n) {
    return Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 });
  }

  function amountToWords(amount) {
    return 'Kenya Shillings ' + fmt(amount) + ' Only';
  }

  function getPeriodLabel(periodVal) {
    if (!periodVal) return '—';
    var parts = periodVal.split('-');
    var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return monthNames[Math.max(0, parseInt(parts[1], 10) - 1)] + ' ' + parts[0];
  }

  // ── Deduction calculation (delegates to the shared tax engine) ──────────

  function calcDeductions(gross) {
    var d = window.SalaryEngine.calculateDeductions(Math.max(Number(gross) || 0, 0), { year: '2026' });
    return {
      paye: Math.round(d.paye),
      nssfEmployee: Math.round(d.nssf),
      nssfEmployer: Math.round(d.nssf),
      shifEmployee: Math.round(d.shif),
      // SHIF has no employer-matching contribution -- only the employee's
      // own 2.75% is deducted and remitted, unlike NSSF and Housing Levy.
      hlEmployee: Math.round(d.housingLevy),
      hlEmployer: Math.round(d.housingLevy)
    };
  }

  // ── DOM population ────────────────────────────────────────────────────

  function applyProfile(profile) {
    profile = profile || {};
    setText('ps-company-name', profile.name || 'Your Company Name');
    setText('ps-company-address', profile.address || '');
    setText('ps-company-kra', profile.kraPin || '—');
    setText('ps-company-reg', profile.registrationNo || '—');
    setText('ps-company-nssf', profile.nssfNo || '—');
    setText('ps-company-shif', profile.shifNo || '—');
    setText('ps-company-contacts', [profile.email, profile.phone].filter(Boolean).join(' | '));

    var logoEl = document.getElementById('ps-company-logo');
    if (logoEl) {
      if (profile.logo_url) {
        logoEl.src = profile.logo_url;
        logoEl.style.display = 'block';
      } else {
        logoEl.style.display = 'none';
      }
    }
  }

  function fillEmployee(emp, opts) {
    opts = opts || {};
    emp = emp || {};
    setText('ps-emp-name', emp.name || '');
    setText('ps-emp-no', emp.employeeId || '');
    setText('ps-emp-kra', emp.kraPin || '—');
    setText('ps-emp-nssf', emp.nssfNumber || '—');
    setText('ps-emp-dept', emp.department || '—');
    setText('ps-emp-position', emp.position || '—');
    setText('ps-emp-bank', emp.bankName || '—');
    var acct = emp.accountNumber || '';
    setText('ps-emp-account', acct ? '****' + acct.slice(-4) : '—');
    setText('ps-emp-branch', emp.bankBranch || '—');
    setText('ps-payslip-no-display', opts.payslipNo || '—');
    setText('ps-pay-date-display', opts.payDate || '—');
    setText('ps-display-period', getPeriodLabel(opts.period));
  }

  function renderPreview(state) {
    state = state || {};
    var basic = Number(state.basic) || 0;
    var house = Number(state.house) || 0;
    var transport = Number(state.transport) || 0;
    var otherAllow = Number(state.otherAllow) || 0;
    var sacco = Number(state.sacco) || 0;
    var pension = Number(state.pension) || 0;
    var insurance = Number(state.insurance) || 0;
    var otherDed = Number(state.otherDed) || 0;
    var otherDedLabel = state.otherDedLabel || 'Other Deduction';

    var gross = basic + house + transport + otherAllow;
    var ded = calcDeductions(gross);
    var voluntaryDed = sacco + pension + insurance + otherDed;
    var totalDed = ded.paye + ded.nssfEmployee + ded.shifEmployee + ded.hlEmployee + voluntaryDed;
    var netPay = gross - totalDed;

    function show(rowId, cellId, value) {
      var row = document.getElementById(rowId);
      if (row) row.style.display = value > 0 ? '' : 'none';
      setText(cellId, fmt(value));
    }

    setText('ps-r-basic', fmt(basic));
    show('ps-row-house', 'ps-r-house', house);
    show('ps-row-transport', 'ps-r-transport', transport);
    show('ps-row-other-allow', 'ps-r-other-allow', otherAllow);
    setText('ps-r-gross', fmt(gross));

    setText('ps-r-nssf-er', fmt(ded.nssfEmployer));
    setText('ps-r-hl-er', fmt(ded.hlEmployer));
    setText('ps-r-total-er', fmt(ded.nssfEmployer + ded.hlEmployer));

    setText('ps-r-paye', fmt(ded.paye));
    setText('ps-r-nssf-ee', fmt(ded.nssfEmployee));
    setText('ps-r-shif-ee', fmt(ded.shifEmployee));
    setText('ps-r-hl-ee', fmt(ded.hlEmployee));

    show('ps-row-sacco', 'ps-r-sacco', sacco);
    show('ps-row-pension', 'ps-r-pension', pension);
    show('ps-row-insurance', 'ps-r-insurance', insurance);
    var otherRow = document.getElementById('ps-row-other-ded');
    if (otherRow) {
      if (otherDed > 0) {
        otherRow.style.display = '';
        setText('ps-r-other-ded-label', otherDedLabel);
        setText('ps-r-other-ded', fmt(otherDed));
      } else {
        otherRow.style.display = 'none';
      }
    }

    setText('ps-r-total-ded', fmt(totalDed));
    setText('ps-r-net-pay', 'KES ' + fmt(netPay));
    setText('ps-r-net-words', amountToWords(netPay));
    setText('ps-display-period', getPeriodLabel(state.period));
    setText('ps-pay-date-display', state.payDate || '—');
    setText('ps-payslip-no-display', state.payslipNo || '—');

    return { gross: gross, deductions: ded, voluntaryDed: voluntaryDed, totalDed: totalDed, netPay: netPay };
  }

  function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  window.PayslipTemplate = {
    markup: markup,
    CSS: CSS,
    fmt: fmt,
    amountToWords: amountToWords,
    getPeriodLabel: getPeriodLabel,
    calcDeductions: calcDeductions,
    applyProfile: applyProfile,
    fillEmployee: fillEmployee,
    renderPreview: renderPreview
  };
})();
