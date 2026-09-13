// Tax rates by year
// Rate tables now live in assets/js/salary-engine.js (window.SalaryEngine),
// the single shared source of truth also used by 9 other pages. This file
// used to carry its own full copy of TAX_RATES, which is how the KES
// 3,800.10 PAYE band-base bug had to be hotfixed here separately from the
// shared engine (see commit 0779e03). getRates() below just forwards to it.
function debounce(fn, delay) {
    let t;
    return function() { clearTimeout(t); t = setTimeout(fn, delay); };
}
const calculateSalaryDebounced = debounce(calculateSalary, 300);

function getSelectedYear(selectId) {
    const el = document.getElementById(selectId);
    return el ? el.value : '2026';
}

function getRates(year) {
    return window.SalaryEngine.getRates(year);
}

// Tab functionality
function openTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => { el.style.display = 'none'; });
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));

    document.getElementById(tabName).style.display = 'block';

    const activeBtn = document.querySelector(`.tab-button[data-tab="${tabName}"]`);
    if (activeBtn) activeBtn.classList.add('active');
}

// Shared auth check helper – returns true if a Supabase session is active.
async function checkIsAuthenticated() {
    if (typeof supabaseClient !== 'undefined' && supabaseClient &&
        typeof isSupabaseConfigured === 'function' && isSupabaseConfigured()) {
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            return !!session;
        } catch (e) {
            return false;
        }
    }
    return false;
}

// Generic helper: opens a tab and shows either the form or the auth prompt.
async function openProtectedTab(tabName, formContentId, authPromptId) {
    openTab(tabName);
    const formContent = document.getElementById(formContentId);
    const authPrompt  = document.getElementById(authPromptId);
    if (!formContent || !authPrompt) return;
    const isAuthenticated = await checkIsAuthenticated();
    if (isAuthenticated) {
        formContent.style.display = 'block';
        authPrompt.style.display  = 'none';
    } else {
        formContent.style.display = 'none';
        authPrompt.style.display  = 'block';
    }
}

// Load employer profile from Supabase and pre-fill payslip company fields.
async function prefillEmployerProfileFromSupabase() {
    if (typeof supabaseClient === 'undefined' || !supabaseClient ||
        typeof isSupabaseConfigured !== 'function' || !isSupabaseConfigured()) return;
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) return;
        const { data, error } = await supabaseClient
            .from('employers')
            .select('organization_name, organization_kra_pin, county, physical_address, postal_address, contact_email, contact_phone, registration_number, nssf_number, nhif_number, logo_url')
            .eq('user_id', session.user.id)
            .maybeSingle();
        if (error || !data) return;
        const address = data.physical_address || data.postal_address || data.county || '';
        const profile = {
            name: data.organization_name || '',
            kraPin: data.organization_kra_pin || '',
            address: address,
            county: data.county || '',
            email: data.contact_email || '',
            phone: data.contact_phone || '',
            registrationNo: data.registration_number || '',
            nssfNo: data.nssf_number || '',
            shifNo: data.nhif_number || '',
            logo_url: data.logo_url || ''
        };
        localStorage.setItem('employerProfile', JSON.stringify(profile));
        window.__SC_LAST_EMPLOYER_PROFILE = profile;
        applyEmployerProfileToPayslip(profile, true);
    } catch (e) {
        // Fail silently – table may not exist
    }
}

function applyEmployerProfileToPayslip(profile, onlyEmpty) {
    if (!profile) return;
    const companyNameEl = document.getElementById('companyName');
    const companyAddrEl = document.getElementById('companyAddress');
    const companyKraEl  = document.getElementById('companyKra');
    const companyContactsEl = document.getElementById('companyContacts');
    const canSet = (el) => el && (!onlyEmpty || !el.value);
    if (canSet(companyNameEl)) companyNameEl.value = profile.name || '';
    if (canSet(companyAddrEl)) companyAddrEl.value = profile.address || profile.county || '';
    if (canSet(companyKraEl))  companyKraEl.value  = profile.kraPin || '';
    if (canSet(companyContactsEl)) {
        const parts = [];
        if (profile.phone) parts.push('Tel: ' + profile.phone);
        if (profile.email) parts.push('Email: ' + profile.email);
        companyContactsEl.value = parts.join(' | ');
    }
}

async function getCachedEmployerProfile() {
    let profile = null;
    try {
        profile = JSON.parse(localStorage.getItem('employerProfile') || 'null');
    } catch (e) {}
    if (profile) return profile;
    if (typeof supabaseClient === 'undefined' || !supabaseClient ||
        typeof isSupabaseConfigured !== 'function' || !isSupabaseConfigured()) return null;
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) return null;
        return JSON.parse(localStorage.getItem('employerProfile_' + userId) || 'null');
    } catch (e) {
        return null;
    }
}

// Open the Payslip Generator tab with an auth check.
// Unauthenticated users see a sign-in prompt instead of the form.
async function openPayslipTab() {
    openTab('payslip');
    const formContent = document.getElementById('payslip-form-content');
    const authPrompt  = document.getElementById('payslip-auth-prompt');
    if (formContent) formContent.style.display = 'block';
    if (authPrompt)  authPrompt.style.display = 'none';
    // Attempt to load employer profile from Supabase if not already cached
    await prefillEmployerProfileFromSupabase();
    const cachedProfile = await getCachedEmployerProfile();
    if (cachedProfile) {
        applyEmployerProfileToPayslip(cachedProfile, true);
        window.__SC_LAST_EMPLOYER_PROFILE = window.__SC_LAST_EMPLOYER_PROFILE || cachedProfile;
    }
    // Load saved employees, if any, so the user can pick one instead of typing
    await loadPayslipEmployees();
}

// Open the Gross-Up Calculator tab with an auth check.
async function openGrossUpTab() {
    await openProtectedTab('grossup', 'grossup-form-content', 'grossup-auth-prompt');
}

// Open the Salary Comparison tab with an auth check.
async function openComparisonTab() {
    await openProtectedTab('comparison', 'comparison-form-content', 'comparison-auth-prompt');
}

// Open the Kenya Percentile tab with an auth check.
async function openPercentileTab() {
    await openProtectedTab('percentile', 'percentile-form-content', 'percentile-auth-prompt');
}

// Fire-and-forget activity recorder for the admin dashboard's usage stats.
// Uses getSession() (local/cached, no network round-trip) to skip the RPC
// entirely for anonymous visitors -- calculating doesn't require signup on
// this site, so most calculations are anonymous and shouldn't trigger a
// wasted network call. record_user_activity() itself is also safely a
// no-op for any caller without a valid session, as a second layer of
// safety, but checking locally first avoids the round-trip for the common
// anonymous case. Never awaited -- must not block or slow down the
// calculation UI in any way, and errors are swallowed since this is
// purely for internal analytics, never user-facing.
function recordUserActivity(action) {
    try {
        const client = window.supabaseClient;
        if (!client || typeof client.auth?.getSession !== 'function') return;
        client.auth.getSession().then(({ data }) => {
            if (data?.session) {
                client.rpc('record_user_activity', { p_action: action }).catch(() => {});
            }
        }).catch(() => {});
    } catch (_) {
        // Never let analytics tracking break the calculator.
    }
}

// Site-wide activity counter -- unlike recordUserActivity above, this fires
// unconditionally regardless of login state, since bump_site_activity() has
// no identity requirement at all. This is what actually captures total site
// activity: calculating doesn't require an account on this site, so most
// real usage would be invisible to a per-user counter alone.
function bumpSiteActivity(eventType) {
    try {
        const client = window.supabaseClient;
        if (!client || typeof client.rpc !== 'function') return;
        client.rpc('bump_site_activity', { p_event_type: eventType }).catch(() => {});
    } catch (_) {
        // Never let analytics tracking break the calculator.
    }
}

// Salary Calculator Functions
function calculateSalary() {
    const grossPay = parseFloat(document.getElementById('grossPay').value) || 0;
    const allowances = parseFloat(document.getElementById('allowances').value) || 0;
    const benefits = parseFloat(document.getElementById('benefits').value) || 0;
    const year = getSelectedYear('taxYear');
    const rates = getRates(year);

    // Update badge
    const badge = document.getElementById('ratesBadge');
    if (badge) badge.textContent = rates.label;

    const totalIncome = grossPay + allowances + benefits;

    const nssf = calculateNSSF(grossPay, rates);
    const housingLevy = totalIncome * rates.housingLevyRate;
    const shif = Math.max(totalIncome * rates.shifRate, 300);

    const deductionsBeforeTax = nssf + housingLevy + shif;
    const taxablePay = totalIncome - deductionsBeforeTax;

    const paye = calculatePAYE(taxablePay, rates);

    const personalRelief = rates.personalRelief;
    const netPay = totalIncome - (paye + deductionsBeforeTax);

    displayResults(
        totalIncome, paye, nssf, shif, housingLevy,
        personalRelief, netPay
    );

    document.getElementById('results').style.display = 'block';
    recordUserActivity('calculation');
    bumpSiteActivity('calculation');
    renderDeductionsChart('deductionsChart', paye, nssf, shif, housingLevy, netPay);

    // Voluntary / additional deductions
    const helb = parseFloat(document.getElementById('helbRepayment')?.value) || 0;
    const sacco = parseFloat(document.getElementById('saccoContribution')?.value) || 0;
    const pension = parseFloat(document.getElementById('pensionTopUp')?.value) || 0;
    const insurance = parseFloat(document.getElementById('insurancePremium')?.value) || 0;
    const childCare = parseFloat(document.getElementById('childCare')?.value) || 0;
    const commuter = parseFloat(document.getElementById('commuterAllowanceDeduction')?.value) || 0;
    const totalVoluntary = helb + sacco + pension + insurance + childCare + commuter;

    function showVolRow(rowId, valId, annualId, val) {
        const row = document.getElementById(rowId);
        if (!row) return;
        if (val > 0) {
            row.style.display = '';
            document.getElementById(valId).textContent = formatKES(val);
            document.getElementById(annualId).textContent = formatKES(val * 12);
        } else {
            row.style.display = 'none';
        }
    }
    showVolRow('row-helb', 'dispHelb', 'dispHelbAnnual', helb);
    showVolRow('row-sacco', 'dispSacco', 'dispSaccoAnnual', sacco);
    showVolRow('row-pension', 'dispPension', 'dispPensionAnnual', pension);
    showVolRow('row-insurance', 'dispInsurance', 'dispInsuranceAnnual', insurance);
    showVolRow('row-childcare', 'dispChildCare', 'dispChildCareAnnual', childCare);
    showVolRow('row-commuter', 'dispCommuter', 'dispCommuterAnnual', commuter);

    const takeHomeRow = document.getElementById('row-takehome');
    if (takeHomeRow) {
        if (totalVoluntary > 0) {
            const takeHome = netPay - totalVoluntary;
            takeHomeRow.style.display = '';
            document.getElementById('dispTakeHome').textContent = formatKES(takeHome);
            document.getElementById('dispTakeHomeAnnual').textContent = formatKES(takeHome * 12);
        } else {
            takeHomeRow.style.display = 'none';
        }
    }

    // Employer cost section
    const empNssf = nssf; // employer matches employee NSSF
    // Note: SHIF has no employer-matching contribution -- the employer only
    // deducts and remits the employee's own 2.75%, unlike NSSF and Housing
    // Levy which are genuinely employer-matched. Confirmed against multiple
    // independent sources (WTW, FNJ & Associates) plus eCitizen's own SHIF
    // Calculator, which shows only an Employee Contribution line.
    const empLevy = totalIncome * rates.housingLevyRate;
    const totalCostToCompany = totalIncome + empNssf + empLevy;

    const empSection = document.getElementById('employerCostSection');
    if (empSection && grossPay > 0) {
        empSection.style.display = 'block';
        document.getElementById('empGross').textContent = formatKES(totalIncome);
        document.getElementById('empGrossAnnual').textContent = formatKES(totalIncome * 12);
        document.getElementById('empNssf').textContent = formatKES(empNssf);
        document.getElementById('empNssfAnnual').textContent = formatKES(empNssf * 12);
        document.getElementById('empLevy').textContent = formatKES(empLevy);
        document.getElementById('empLevyAnnual').textContent = formatKES(empLevy * 12);
        document.getElementById('empTotal').textContent = formatKES(totalCostToCompany);
        document.getElementById('empTotalAnnual').textContent = formatKES(totalCostToCompany * 12);
    }

    // Share / save link
    generateShareLink(grossPay, allowances, benefits, year, helb, sacco, pension, insurance, childCare, commuter);

    // Notify premium/share/financial-tools components of the new calculation
    window.dispatchEvent(new CustomEvent('salaryCalculated', { detail: {
        grossPay: totalIncome,
        netPay,
        paye,
        nssf,
        shif,
        housingLevy,
        totalIncome
    } }));
}

function calculatePAYE(taxablePay, rates) {
    if (!rates) rates = getRates('2026');
    return window.SalaryEngine.calculatePAYE(taxablePay, 0, rates.personalRelief, rates);
}

function calculateNSSF(grossPay, rates) {
    if (!rates) rates = getRates('2026');
    return window.SalaryEngine.calculateNSSF(grossPay, rates);
}

function calculateSHIF(grossPay, rates) {
    if (!rates) rates = getRates('2026');
    return window.SalaryEngine.calculateSHIF(grossPay, rates);
}

function calculateHousingLevy(grossPay, rates) {
    if (!rates) rates = getRates('2026');
    return window.SalaryEngine.calculateHousingLevy(grossPay, rates);
}

function displayResults(taxablePay, paye, nssf, shif, housingLevy, personalRelief, netPay) {
    function setText(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }
    setText('displayGross', formatKES(taxablePay));
    setText('displayGrossAnnual', formatKES(taxablePay * 12));
    setText('paye', formatKES(paye));
    setText('payeAnnual', formatKES(paye * 12));
    setText('nssf', formatKES(nssf));
    setText('nssfAnnual', formatKES(nssf * 12));
    setText('nhif', formatKES(shif));
    setText('nhifAnnual', formatKES(shif * 12));
    setText('housingLevy', formatKES(housingLevy));
    setText('housingLevyAnnual', formatKES(housingLevy * 12));
    setText('personalRelief', formatKES(personalRelief));
    setText('personalReliefAnnual', formatKES(personalRelief * 12));
    setText('netPay', formatKES(netPay));
    setText('netPayAnnual', formatKES(netPay * 12));
}

// Chart.js deductions pie chart — keyed by canvas ID for safe instance management
const chartInstances = { deductionsChart: null, grossupChart: null, comparisonChart: null };

function renderDeductionsChart(canvasId, paye, nssf, shif, housingLevy, netPay) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;

    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }

    chartInstances[canvasId] = new Chart(canvas, {
        type: 'pie',
        data: {
            labels: ['Net Pay', 'PAYE', 'NSSF', 'SHIF', 'Housing Levy'],
            datasets: [{
                data: [
                    Math.max(netPay, 0).toFixed(2),
                    paye.toFixed(2),
                    nssf.toFixed(2),
                    shif.toFixed(2),
                    housingLevy.toFixed(2)
                ],
                backgroundColor: ['#006600', '#CC0000', '#1a56a0', '#e07b00', '#6a1fa0'],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: function(ctx) {
                            return ctx.label + ': KES ' + Number(ctx.parsed).toLocaleString('en-KE', {minimumFractionDigits:2});
                        }
                    }
                }
            }
        }
    });
}

// Gross-Up / Reverse Calculator
function calculateGrossUp() {
    const desiredNet = parseFloat(document.getElementById('desiredNet').value) || 0;
    const year = getSelectedYear('taxYearGrossup');
    const rates = getRates(year);

    if (desiredNet <= 0) return;

    // Binary search for the gross salary that yields the desired net pay.
    // 60 iterations converges to sub-cent accuracy (2^-60 of initial range).
    const MAX_BINARY_SEARCH_ITERATIONS = 60;
    let lo = desiredNet, hi = desiredNet * 5;
    for (let i = 0; i < MAX_BINARY_SEARCH_ITERATIONS; i++) {
        const mid = (lo + hi) / 2;
        const nssf = calculateNSSF(mid, rates);
        const shif = Math.max(mid * rates.shifRate, 300);
        const levy = mid * rates.housingLevyRate;
        const taxable = mid - nssf - shif - levy;
        const paye = calculatePAYE(taxable, rates);
        const net = mid - paye - nssf - shif - levy;
        if (Math.abs(net - desiredNet) < 0.01) break;
        if (net < desiredNet) lo = mid; else hi = mid;
    }

    const gross = (lo + hi) / 2;
    const nssf = calculateNSSF(gross, rates);
    const shif = Math.max(gross * rates.shifRate, 300);
    const levy = gross * rates.housingLevyRate;
    const taxable = gross - nssf - shif - levy;
    const paye = calculatePAYE(taxable, rates);
    const net = gross - paye - nssf - shif - levy;

    function setText(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }
    setText('guGross', formatKES(gross));
    setText('guGrossAnnual', formatKES(gross * 12));
    setText('guPaye', formatKES(paye));
    setText('guPayeAnnual', formatKES(paye * 12));
    setText('guNssf', formatKES(nssf));
    setText('guNssfAnnual', formatKES(nssf * 12));
    setText('guShif', formatKES(shif));
    setText('guShifAnnual', formatKES(shif * 12));
    setText('guLevy', formatKES(levy));
    setText('guLevyAnnual', formatKES(levy * 12));
    setText('guNet', formatKES(net));
    setText('guNetAnnual', formatKES(net * 12));

    document.getElementById('grossupResults').style.display = 'block';
    renderDeductionsChart('grossupChart', paye, nssf, shif, levy, net);
}

// Salary Comparison
function compareSalaries() {
    const grossA = parseFloat(document.getElementById('compGrossA').value) || 0;
    const grossB = parseFloat(document.getElementById('compGrossB').value) || 0;
    const labelA = document.getElementById('compLabelA').value || 'Salary A';
    const labelB = document.getElementById('compLabelB').value || 'Salary B';
    const year = getSelectedYear('taxYearComp');
    const rates = getRates(year);

    function calcBreakdown(gross) {
        const nssf = calculateNSSF(gross, rates);
        const shif = Math.max(gross * rates.shifRate, 300);
        const levy = gross * rates.housingLevyRate;
        const taxable = gross - nssf - shif - levy;
        const paye = calculatePAYE(taxable, rates);
        const net = gross - paye - nssf - shif - levy;
        return { gross, paye, nssf, shif, levy, net };
    }

    const a = calcBreakdown(grossA);
    const b = calcBreakdown(grossB);

    function diffText(valA, valB) {
        const d = valB - valA;
        const sign = d >= 0 ? '+' : '';
        return sign + formatKES(d);
    }

    function setText(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }

    // Update column headers
    const headA = document.getElementById('compHeadA');
    const headB = document.getElementById('compHeadB');
    if (headA) headA.textContent = labelA + ' (Monthly)';
    if (headB) headB.textContent = labelB + ' (Monthly)';

    setText('cGrossA', formatKES(a.gross));
    setText('cGrossB', formatKES(b.gross));
    setText('cGrossDiff', diffText(a.gross, b.gross));
    setText('cPayeA', formatKES(a.paye));
    setText('cPayeB', formatKES(b.paye));
    setText('cPayeDiff', diffText(a.paye, b.paye));
    setText('cNssfA', formatKES(a.nssf));
    setText('cNssfB', formatKES(b.nssf));
    setText('cNssfDiff', diffText(a.nssf, b.nssf));
    setText('cShifA', formatKES(a.shif));
    setText('cShifB', formatKES(b.shif));
    setText('cShifDiff', diffText(a.shif, b.shif));
    setText('cLevyA', formatKES(a.levy));
    setText('cLevyB', formatKES(b.levy));
    setText('cLevyDiff', diffText(a.levy, b.levy));
    setText('cNetA', formatKES(a.net));
    setText('cNetB', formatKES(b.net));
    setText('cNetDiff', diffText(a.net, b.net));

    // Color diff cell
    const netDiffEl = document.getElementById('cNetDiff');
    if (netDiffEl) {
        netDiffEl.style.color = (b.net >= a.net) ? '#006600' : '#CC0000';
        netDiffEl.style.fontWeight = 'bold';
    }

    document.getElementById('comparisonResults').style.display = 'block';

    // Bar chart comparing net pay
    const canvas = document.getElementById('comparisonChart');
    if (canvas && typeof Chart !== 'undefined') {
        if (chartInstances.comparisonChart) chartInstances.comparisonChart.destroy();
        chartInstances.comparisonChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: [labelA, labelB],
                datasets: [
                    { label: 'Net Pay', data: [a.net, b.net], backgroundColor: ['#006600', '#1a56a0'] },
                    { label: 'PAYE', data: [a.paye, b.paye], backgroundColor: ['#CC0000', '#e07b00'] },
                    { label: 'NSSF', data: [a.nssf, b.nssf], backgroundColor: ['#6a1fa0', '#007b7b'] }
                ]
            },
            options: {
                responsive: true,
                plugins: { legend: { position: 'bottom' } },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: v => 'KES ' + Number(v).toLocaleString()
                        }
                    }
                }
            }
        });
    }
}

// Payslip Generator Functions
function getCurrentDocumentPreparer() {
    const welcomeText = document.querySelector('.user-welcome-text')?.textContent || '';
    const cleanedWelcome = welcomeText.replace(/^Welcome,\s*/i, '').trim();
    if (cleanedWelcome) return cleanedWelcome;
    if (window.__SC_USER_EMAIL) return String(window.__SC_USER_EMAIL);
    return '';
}

// ── Saved-employee picker ──────────────────────────────────────────────────
// Lets the Payslip Generator read from Employee Management's saved records
// when available, while still allowing a fully manual entry when it isn't.

let payslipSavedEmployees = [];

function _payslipEmployeeFromRow(row) {
    return {
        id: row.id,
        name: row.employee_name,
        employeeId: row.employee_id,
        kraPin: row.kra_pin || '',
        department: row.department || '',
        position: row.position || '',
        salary: row.gross_salary || 0,
        allowances: row.allowances || 0,
        bankName: row.bank_name || '',
        bankBranch: row.bank_branch || '',
        accountNumber: row.account_number || ''
    };
}

async function loadPayslipEmployees() {
    const selectGroup = document.getElementById('payslipEmployeeSelectGroup');
    const select = document.getElementById('payslipEmployeeSelect');
    const hint = document.getElementById('payslipNoEmployeesHint');
    if (!select) return;

    if (typeof supabaseClient === 'undefined' || !supabaseClient ||
        typeof isSupabaseConfigured !== 'function' || !isSupabaseConfigured()) return;

    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) return;
        const { data, error } = await supabaseClient
            .from('employees')
            .select('*')
            .eq('employer_id', session.user.id)
            .order('created_at', { ascending: true });
        if (error || !data) return;

        payslipSavedEmployees = data.map(_payslipEmployeeFromRow);

        while (select.options.length > 1) select.remove(1);
        payslipSavedEmployees.forEach(emp => {
            const opt = document.createElement('option');
            opt.value = emp.id;
            opt.textContent = emp.name + (emp.employeeId ? ' (' + emp.employeeId + ')' : '');
            select.appendChild(opt);
        });

        if (payslipSavedEmployees.length > 0) {
            if (selectGroup) selectGroup.style.display = 'block';
            if (hint) hint.style.display = 'none';
        } else {
            if (selectGroup) selectGroup.style.display = 'none';
            if (hint) hint.style.display = 'block';
        }
    } catch (e) {
        // Employees table unavailable or query failed -- leave manual entry as the only path
    }
}

function applySelectedPayslipEmployee() {
    const select = document.getElementById('payslipEmployeeSelect');
    if (!select) return;
    const emp = payslipSavedEmployees.find(e => String(e.id) === String(select.value));
    if (!emp) return; // "Enter details manually" selected -- leave fields as-is

    document.getElementById('employeeName').value = emp.name || '';
    document.getElementById('employeeID').value = emp.employeeId || '';
    document.getElementById('kraPin').value = emp.kraPin || '';
    document.getElementById('payslipDepartment').value = emp.department || '';
    document.getElementById('grossPaySlip').value = (Number(emp.salary) || 0) + (Number(emp.allowances) || 0);
}

function generatePayslip() {
    const name = document.getElementById('employeeName').value;
    const id = document.getElementById('employeeID').value;
    const pin = document.getElementById('kraPin').value;
    const department = document.getElementById('payslipDepartment').value;
    const period = document.getElementById('payPeriod').value;
    const gross = parseFloat(document.getElementById('grossPaySlip').value) || 0;
    const otherDed = parseFloat(document.getElementById('loanDeductionValue')?.value) || 0;
    const saccoDeduction = parseFloat(document.getElementById('saccoDeductionInput').value) || 0;
    const pensionDeduction = parseFloat(document.getElementById('pensionDeductionInput').value) || 0;
    const insuranceDeduction = parseFloat(document.getElementById('insuranceDeductionInput').value) || 0;

    const pinRegex = /^[A-Z]{1}\d{9}[A-Z]{1}$/;
    if (pin && !pinRegex.test(pin)) {
        alert("Invalid KRA PIN format. Expected A12345678B");
        return;
    }

    localStorage.setItem('employeeData', JSON.stringify({ name, id, pin, period, gross, department }));

    // Render the shared A4 template (same one used by Employee Management)
    const mount = document.getElementById('payslipOutput');
    if (!mount.querySelector('#payslip-document')) {
        mount.insertAdjacentHTML('afterbegin', PayslipTemplate.markup());
    }

    const select = document.getElementById('payslipEmployeeSelect');
    const selectedEmp = select && payslipSavedEmployees.find(e => String(e.id) === String(select.value));

    const companyProfile = {
        name: document.getElementById('companyName').value,
        address: document.getElementById('companyAddress').value,
        kraPin: document.getElementById('companyKra').value,
        // Registration/NSSF/SHIF numbers and logo come from the saved organisation
        // profile when available (see getCachedEmployerProfile); there's no
        // separate manual input for them here to keep this form short.
        registrationNo: window.__SC_LAST_EMPLOYER_PROFILE?.registrationNo,
        nssfNo: window.__SC_LAST_EMPLOYER_PROFILE?.nssfNo,
        shifNo: window.__SC_LAST_EMPLOYER_PROFILE?.shifNo,
        logo_url: window.__SC_LAST_EMPLOYER_PROFILE?.logo_url,
    };
    const contacts = document.getElementById('companyContacts').value || '';
    const [emailPart, phonePart] = contacts.split('|').map(s => (s || '').trim());
    companyProfile.email = emailPart && emailPart.includes('@') ? emailPart.replace(/^Email:\s*/i, '') : '';
    companyProfile.phone = phonePart ? phonePart.replace(/^Tel:\s*/i, '') : (emailPart && !emailPart.includes('@') ? emailPart.replace(/^Tel:\s*/i, '') : '');
    PayslipTemplate.applyProfile(companyProfile);

    const payslipNo = 'PS-' + Date.now().toString().slice(-6);
    PayslipTemplate.fillEmployee({
        name, employeeId: id, kraPin: pin, department,
        bankName: selectedEmp?.bankName, bankBranch: selectedEmp?.bankBranch, accountNumber: selectedEmp?.accountNumber
    }, { period, payslipNo });

    PayslipTemplate.renderPreview({
        basic: gross, house: 0, transport: 0, otherAllow: 0,
        sacco: saccoDeduction, pension: pensionDeduction, insurance: insuranceDeduction,
        otherDed: otherDed, otherDedLabel: 'Loan Deduction',
        period, payslipNo
    });
    document.getElementById('ps-display-period').textContent = period || '—';

    const preparer = getCurrentDocumentPreparer();
    if (preparer) {
        const preparedCell = document.querySelector('.ps-signatures div:first-child p');
        if (preparedCell) preparedCell.textContent = 'Prepared By: ' + preparer;
    }

    document.getElementById('payslipOutput').style.display = 'block';
}

// Logo Upload Function
function handleLogoUpload() {
    const fileInput = document.getElementById('logoUpload');
    const file = fileInput.files[0];

    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const logoImg = document.getElementById('companyLogo');
            logoImg.src = e.target.result;
            logoImg.style.display = 'block';
            const psLogo = document.getElementById('ps-company-logo');
            if (psLogo) { psLogo.src = e.target.result; psLogo.style.display = 'block'; }
        };
        reader.readAsDataURL(file);
    }
}

// Print Function — opens a clean new window so the print preview works correctly
function printPayslip() {
    const payslipEl = document.getElementById('payslipOutput');
    const docEl = document.getElementById('payslip-document');
    if (!payslipEl || payslipEl.style.display === 'none' || !docEl) {
        alert('Please generate a payslip first.');
        return;
    }

    const name = document.getElementById('ps-emp-name')?.textContent || 'employee';

    // Print the exact same rendered node the user is looking at -- the same
    // template Employee Management uses -- instead of maintaining a second,
    // separately-styled print layout that can drift out of sync with it.
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Payslip – ${name}</title>
<style>
*{margin:0;padding:0;}
body{background:#fff;font-family:Arial,sans-serif;}
${PayslipTemplate.CSS}
</style>
</head>
<body>
${docEl.outerHTML}
<script>window.onload = function(){ window.print(); };<\/script>
</body>
</html>`;

    const preOpenedWindow = window.__SC_PREOPENED_PRINT_WINDOW;
    window.__SC_PREOPENED_PRINT_WINDOW = null;
    const pw = (preOpenedWindow && !preOpenedWindow.closed)
        ? preOpenedWindow
        : window.open('', '_blank', 'width=850,height=1000');
    if (!pw) {
        alert('Pop-ups are blocked. Please allow pop-ups for this site to print the payslip, then try again.');
        return;
    }
    pw.document.write(html);
    pw.document.close();
}


// Reset Function
function resetPayslip() {
    document.getElementById('employeeName').value = '';
    document.getElementById('employeeID').value = '';
    document.getElementById('kraPin').value = '';
    document.getElementById('payslipDepartment').value = '';
    document.getElementById('payPeriod').value = '';
    document.getElementById('grossPaySlip').value = '';
    document.getElementById('companyName').value = '';
    document.getElementById('companyAddress').value = '';
    document.getElementById('companyKra').value = '';
    document.getElementById('companyContacts').value = '';
    const loanIn = document.getElementById('loanDeductionValue');
    const saccoIn = document.getElementById('saccoDeductionInput');
    const pensionIn = document.getElementById('pensionDeductionInput');
    const insuranceIn = document.getElementById('insuranceDeductionInput');
    if (loanIn) loanIn.value = '';
    if (saccoIn) saccoIn.value = '';
    if (pensionIn) pensionIn.value = '';
    if (insuranceIn) insuranceIn.value = '';

    const employeeSelect = document.getElementById('payslipEmployeeSelect');
    if (employeeSelect) employeeSelect.value = '';

    const logoImg = document.getElementById('companyLogo');
    if (logoImg) {
        logoImg.src = '';
        logoImg.style.display = 'none';
    }
    const psLogo = document.getElementById('ps-company-logo');
    if (psLogo) { psLogo.src = ''; psLogo.style.display = 'none'; }

    document.getElementById('logoUpload').value = '';
    document.getElementById('payslipOutput').style.display = 'none';
}

// Helper Functions
function formatKES(amount) {
    return 'KES ' + amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
window.onload = async () => {
    // Check URL parameter for tab
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    if (tab === 'payslip') {
        openPayslipTab();
    } else if (tab === 'grossup') {
        openGrossUpTab();
    } else if (tab === 'comparison') {
        openComparisonTab();
    } else if (tab === 'percentile') {
        openPercentileTab();
    }
    
    const saved = JSON.parse(localStorage.getItem('employeeData') || 'null');
    if (saved) {
        if (document.getElementById('employeeName')) document.getElementById('employeeName').value = saved.name || '';
        if (document.getElementById('employeeID')) document.getElementById('employeeID').value = saved.id || '';
        if (document.getElementById('kraPin')) document.getElementById('kraPin').value = saved.pin || '';
        if (document.getElementById('payPeriod')) document.getElementById('payPeriod').value = saved.period || '';
        if (document.getElementById('grossPaySlip')) document.getElementById('grossPaySlip').value = saved.gross || '';
        if (document.getElementById('payslipDepartment')) document.getElementById('payslipDepartment').value = saved.department || '';
    }

    // Pre-fill employer / organization details from cached profile
    const savedProfile = await getCachedEmployerProfile();
    if (savedProfile) applyEmployerProfileToPayslip(savedProfile, true);

    // Load calculation from URL params (shared link)
    loadCalculationFromURL();
};

// Navigation dropdown, outside-click close, and mobile menu toggle are
// handled once, site-wide, by nav-toggle.js. This file used to carry its
// own duplicate copy of the exact same wiring; both attached a 'click'
// listener to the same .nav-dropdown-toggle elements, so a single click
// toggled the 'open' class on, then immediately back off again in the same
// event -- the dropdown could never actually stay open on any page that
// loaded both files (currently just calculator.html, since script.js is
// calculator-page-specific). Removed rather than fixed in place: there's
// no reason for this page to have its own copy of shared nav behaviour.

// Generate a shareable URL with calculation parameters
function generateShareLink(grossPay, allowances, benefits, year, helb, sacco, pension, insurance, childCare, commuter) {
    const shareSection = document.getElementById('shareSection');
    if (!shareSection) return;

    const params = new URLSearchParams();
    if (grossPay)  params.set('gross', grossPay);
    if (allowances) params.set('allowances', allowances);
    if (benefits)  params.set('benefits', benefits);
    if (year)      params.set('year', year);
    if (helb)      params.set('helb', helb);
    if (sacco)     params.set('sacco', sacco);
    if (pension)   params.set('pension', pension);
    if (insurance) params.set('insurance', insurance);
    if (childCare) params.set('childcare', childCare);
    if (commuter)  params.set('commuter', commuter);

    const url = window.location.origin + window.location.pathname + '?' + params.toString();
    const shareLinkInput = document.getElementById('shareLink');
    if (shareLinkInput) shareLinkInput.value = url;

    // Update WhatsApp share button
    const waBtn = document.getElementById('whatsappShareBtn');
    if (waBtn) {
        const netPayEl = document.getElementById('netPay');
        const netPayText = netPayEl ? netPayEl.textContent : '';
        const waText = encodeURIComponent('Check my Kenya salary breakdown: Net Pay ' + netPayText + '. Calculate yours at: ' + url);
        waBtn.href = 'https://wa.me/?text=' + waText;
    }

    // Update Twitter/X share button
    const twBtn = document.getElementById('twitterShareBtn');
    if (twBtn) {
        const netPayEl = document.getElementById('netPay');
        const netPayText = netPayEl ? netPayEl.textContent : '';
        const payeEl = document.getElementById('paye');
        const payeText = payeEl ? payeEl.textContent : '';
        const grossFmt = 'KES ' + Number(grossPay).toLocaleString('en-KE');
        const tweetText = encodeURIComponent(
            'My ' + grossFmt + ' salary becomes only ' + netPayText + ' after Kenya\'s deductions 😭 ' +
            'That\'s ' + payeText + ' in PAYE alone! Check yours: https://salarycalculator.co.ke #KenyaSalary'
        );
        twBtn.href = 'https://x.com/intent/post?text=' + tweetText;
    }

    shareSection.style.display = 'block';

    // Save calculation to Supabase for authenticated users (fire-and-forget)
    if (typeof supabaseClient !== 'undefined' && supabaseClient &&
        typeof isSupabaseConfigured === 'function' && isSupabaseConfigured()) {
        supabaseClient.auth.getSession().then(function(sessionRes) {
            const session = sessionRes && sessionRes.data && sessionRes.data.session;
            if (!session || !session.user) return;
            const netPayEl  = document.getElementById('netPay');
            const payeEl    = document.getElementById('paye');
            const nssfEl    = document.getElementById('nssf');
            const shifEl    = document.getElementById('shif');
            const ahlfEl    = document.getElementById('housingLevy');
            supabaseClient.from('saved_calculations').insert({
                user_id:     session.user.id,
                gross_salary: grossPay,
                net_salary:   netPayEl  ? parseFloat(netPayEl.textContent.replace(/[^0-9.]/g, ''))  || null : null,
                paye:         payeEl    ? parseFloat(payeEl.textContent.replace(/[^0-9.]/g, ''))    || null : null,
                nssf:         nssfEl    ? parseFloat(nssfEl.textContent.replace(/[^0-9.]/g, ''))    || null : null,
                shif:         shifEl    ? parseFloat(shifEl.textContent.replace(/[^0-9.]/g, ''))    || null : null,
                housing_levy: ahlfEl    ? parseFloat(ahlfEl.textContent.replace(/[^0-9.]/g, ''))   || null : null,
                tax_year:     year || null,
                share_url:    url,
            }).catch(function(e) {
                // Non-fatal — log and continue
                console.warn('Failed to save calculation:', e && e.message ? e.message : e);
            });
        }).catch(function() {});
    }
}

// Copy the share link to clipboard
function copyShareLink() {
    const shareLinkInput = document.getElementById('shareLink');
    if (!shareLinkInput) return;
    const text = shareLinkInput.value;
    const copied = document.getElementById('shareLinkCopied');

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            if (copied) {
                copied.style.display = 'block';
                setTimeout(() => { copied.style.display = 'none'; }, 2500);
            }
        }).catch(() => {
            alert('Could not copy automatically. Please copy the link manually.');
        });
    } else {
        // Fallback for older browsers
        shareLinkInput.select();
        shareLinkInput.setSelectionRange(0, 99999);
        try {
            document.execCommand('copy');
            if (copied) {
                copied.style.display = 'block';
                setTimeout(() => { copied.style.display = 'none'; }, 2500);
            }
        } catch (e) {
            alert('Could not copy automatically. Please copy the link manually.');
        }
    }
}

// Load calculation parameters from URL (for shared links)
function loadCalculationFromURL() {
    const params = new URLSearchParams(window.location.search);
    if (!params.get('gross')) return; // not a shared link

    function setVal(id, paramName) {
        const el = document.getElementById(id);
        if (el && params.get(paramName)) el.value = params.get(paramName);
    }

    setVal('grossPay', 'gross');
    setVal('allowances', 'allowances');
    setVal('benefits', 'benefits');
    setVal('helbRepayment', 'helb');
    setVal('saccoContribution', 'sacco');
    setVal('pensionTopUp', 'pension');
    setVal('insurancePremium', 'insurance');
    setVal('childCare', 'childcare');
    setVal('commuterAllowanceDeduction', 'commuter');

    const yearEl = document.getElementById('taxYear');
    if (yearEl && params.get('year')) yearEl.value = params.get('year');

    // Auto-calculate after loading params
    calculateSalary();
}

// ── Kenya Salary Percentile Calculator ──────────────────────────────────────
const KE_SALARY_PERCENTILES = [
    { salary: 5000,    percentile: 2  },
    { salary: 10000,   percentile: 8  },
    { salary: 15000,   percentile: 15 },
    { salary: 20000,   percentile: 25 },
    { salary: 25000,   percentile: 32 },
    { salary: 30000,   percentile: 40 },
    { salary: 40000,   percentile: 50 },
    { salary: 50000,   percentile: 58 },
    { salary: 60000,   percentile: 65 },
    { salary: 72000,   percentile: 70 },
    { salary: 80000,   percentile: 74 },
    { salary: 100000,  percentile: 80 },
    { salary: 120000,  percentile: 84 },
    { salary: 150000,  percentile: 88 },
    { salary: 200000,  percentile: 92 },
    { salary: 300000,  percentile: 96 },
    { salary: 500000,  percentile: 98 },
    { salary: 1000000, percentile: 99 },
];

function getPercentile(salary) {
    if (salary <= 0) return 0;
    const data = KE_SALARY_PERCENTILES;
    if (salary <= data[0].salary) return data[0].percentile * (salary / data[0].salary);
    if (salary >= data[data.length - 1].salary) return data[data.length - 1].percentile;
    for (let i = 1; i < data.length; i++) {
        if (salary <= data[i].salary) {
            const lower = data[i - 1];
            const upper = data[i];
            const t = (salary - lower.salary) / (upper.salary - lower.salary);
            return lower.percentile + t * (upper.percentile - lower.percentile);
        }
    }
    return 99;
}

function calcPercentile() {
    const salary = parseFloat(document.getElementById('percentileGross')?.value) || 0;
    const resultsDiv = document.getElementById('percentileResults');
    if (!resultsDiv) return;
    if (salary <= 0) { resultsDiv.style.display = 'none'; return; }

    const pct = Math.round(getPercentile(salary));
    const AVG = 72000;
    const diff = salary - AVG;
    const diffPct = ((diff / AVG) * 100).toFixed(1);
    const diffText = diff >= 0
        ? 'KES ' + Math.abs(diff).toLocaleString('en-KE') + ' (' + Math.abs(diffPct) + '%) above the average'
        : 'KES ' + Math.abs(diff).toLocaleString('en-KE') + ' (' + Math.abs(diffPct) + '%) below the average';

    document.getElementById('percentileValue').textContent = pct;
    document.getElementById('percentileBarLabel').textContent = pct + '%';
    document.getElementById('pctYourSalary').textContent = 'KES ' + salary.toLocaleString('en-KE');
    document.getElementById('pctDiffAvg').textContent = diffText;
    document.getElementById('pctPctAvg').textContent = (diff >= 0 ? '+' : '') + diffPct + '%';
    document.getElementById('pctPercentileRow').textContent = 'Top ' + (100 - pct) + '% (Percentile ' + pct + ')';
    document.getElementById('pctSharePct').textContent = pct;

    // Animate bar
    const fill = document.getElementById('percentileBarFill');
    if (fill) { fill.style.width = '0%'; setTimeout(() => { fill.style.width = pct + '%'; }, 50); }

    // X (formerly Twitter) share link
    const twBtn = document.getElementById('percentileShareBtn');
    if (twBtn) {
        const tweetText = encodeURIComponent(
            'I earn more than ' + pct + '% of Kenyans! 🇰🇪 Check where your salary ranks: https://salarycalculator.co.ke #KenyaSalary #KenyaJobs'
        );
        twBtn.href = 'https://x.com/intent/post?text=' + tweetText;
    }

    resultsDiv.style.display = 'block';
}
