// Tax rates by year
function debounce(fn, delay) {
    let t;
    return function() { clearTimeout(t); t = setTimeout(fn, delay); };
}
const calculateSalaryDebounced = debounce(calculateSalary, 300);
const TAX_RATES = {
    '2026': {
        label: 'Rates updated Feb 2025',
        personalRelief: 2400,
        nssfLower: 8000, nssfUpper: 72000, nssfRate: 0.06,
        shifRate: 0.0275,
        housingLevyRate: 0.015,
        payeBands: [
            { limit: 24000, rate: 0.10, base: 0 },
            { limit: 32333, rate: 0.25, base: 2400 },
            { limit: 500000, rate: 0.30, base: 4483.25 },
            { limit: 800000, rate: 0.325, base: 140983.25 },
            { limit: Infinity, rate: 0.35, base: 238483.25 },
        ],
        payePrev: [24000, 32333, 500000, 800000]
    },
    '2025': {
        label: 'Rates updated Feb 2025',
        personalRelief: 2400,
        nssfLower: 8000, nssfUpper: 72000, nssfRate: 0.06,
        shifRate: 0.0275,
        housingLevyRate: 0.015,
        payeBands: [
            { limit: 24000, rate: 0.10, base: 0 },
            { limit: 32333, rate: 0.25, base: 2400 },
            { limit: 500000, rate: 0.30, base: 4483.25 },
            { limit: 800000, rate: 0.325, base: 140983.25 },
            { limit: Infinity, rate: 0.35, base: 238483.25 },
        ],
        payePrev: [24000, 32333, 500000, 800000]
    },
    '2024': {
        label: 'Rates 2024',
        personalRelief: 2400,
        nssfLower: 7000, nssfUpper: 36000, nssfRate: 0.06,
        shifRate: 0.0275,
        housingLevyRate: 0.015,
        payeBands: [
            { limit: 24000, rate: 0.10, base: 0 },
            { limit: 32333, rate: 0.25, base: 2400 },
            { limit: 500000, rate: 0.30, base: 4483.25 },
            { limit: 800000, rate: 0.325, base: 140983.25 },
            { limit: Infinity, rate: 0.35, base: 238483.25 },
        ],
        payePrev: [24000, 32333, 500000, 800000]
    }
};

function getSelectedYear(selectId) {
    const el = document.getElementById(selectId);
    return el ? el.value : '2026';
}

function getRates(year) {
    return TAX_RATES[year] || TAX_RATES['2026'];
}

// Tab functionality
function openTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => { el.style.display = 'none'; });
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));

    document.getElementById(tabName).style.display = 'block';

    const activeBtn = document.querySelector(`.tab-button[data-tab="${tabName}"]`);
    if (activeBtn) activeBtn.classList.add('active');
}

// Open the Payslip Generator tab with an auth check.
// Unauthenticated users see a sign-in prompt instead of the form.
async function openPayslipTab() {
    openTab('payslip');

    const formContent = document.getElementById('payslip-form-content');
    const authPrompt  = document.getElementById('payslip-auth-prompt');
    if (!formContent || !authPrompt) return;

    let isAuthenticated = false;
    if (typeof supabaseClient !== 'undefined' && supabaseClient &&
        typeof isSupabaseConfigured === 'function' && isSupabaseConfigured()) {
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            isAuthenticated = !!session;
        } catch (e) {
            isAuthenticated = false;
        }
    }

    if (isAuthenticated) {
        formContent.style.display = 'block';
        authPrompt.style.display  = 'none';
    } else {
        formContent.style.display = 'none';
        authPrompt.style.display  = 'block';
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
    const shif = totalIncome * rates.shifRate;

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
    const empShif = totalIncome * rates.shifRate;
    const empLevy = totalIncome * rates.housingLevyRate;
    const totalCostToCompany = totalIncome + empNssf + empShif + empLevy;

    const empSection = document.getElementById('employerCostSection');
    if (empSection && grossPay > 0) {
        empSection.style.display = 'block';
        document.getElementById('empGross').textContent = formatKES(totalIncome);
        document.getElementById('empGrossAnnual').textContent = formatKES(totalIncome * 12);
        document.getElementById('empNssf').textContent = formatKES(empNssf);
        document.getElementById('empNssfAnnual').textContent = formatKES(empNssf * 12);
        document.getElementById('empShif').textContent = formatKES(empShif);
        document.getElementById('empShifAnnual').textContent = formatKES(empShif * 12);
        document.getElementById('empLevy').textContent = formatKES(empLevy);
        document.getElementById('empLevyAnnual').textContent = formatKES(empLevy * 12);
        document.getElementById('empTotal').textContent = formatKES(totalCostToCompany);
        document.getElementById('empTotalAnnual').textContent = formatKES(totalCostToCompany * 12);
    }

    // Share / save link
    generateShareLink(grossPay, allowances, benefits, year, helb, sacco, pension, insurance, childCare, commuter);
}

function calculatePAYE(taxablePay, rates) {
    if (!rates) rates = getRates('2026');
    const bands = rates.payeBands;
    let paye = 0;
    for (let i = 0; i < bands.length; i++) {
        const lower = i === 0 ? 0 : bands[i - 1].limit;
        if (taxablePay > lower) {
            paye = bands[i].base + (taxablePay - lower) * bands[i].rate;
        }
        if (taxablePay <= bands[i].limit) break;
    }
    return Math.max(paye - rates.personalRelief, 0);
}

function calculateNSSF(grossPay, rates) {
    if (!rates) rates = getRates('2026');
    const lowerLimit = rates.nssfLower;
    const upperLimit = rates.nssfUpper;
    const tier1 = Math.min(grossPay, lowerLimit) * rates.nssfRate;
    if (grossPay > lowerLimit) {
        const capped = Math.min(grossPay, upperLimit);
        return tier1 + ((capped - lowerLimit) * rates.nssfRate);
    }
    return tier1;
}

function calculateSHIF(grossPay, rates) {
    if (!rates) rates = getRates('2026');
    return grossPay * rates.shifRate;
}

function calculateHousingLevy(grossPay, rates) {
    if (!rates) rates = getRates('2026');
    return grossPay * rates.housingLevyRate;
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
        const shif = mid * rates.shifRate;
        const levy = mid * rates.housingLevyRate;
        const taxable = mid - nssf - shif - levy;
        const paye = calculatePAYE(taxable, rates);
        const net = mid - paye - nssf - shif - levy;
        if (Math.abs(net - desiredNet) < 0.01) break;
        if (net < desiredNet) lo = mid; else hi = mid;
    }

    const gross = (lo + hi) / 2;
    const nssf = calculateNSSF(gross, rates);
    const shif = gross * rates.shifRate;
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
        const shif = gross * rates.shifRate;
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
function generatePayslip() {
    const name = document.getElementById('employeeName').value;
    const id = document.getElementById('employeeID').value;
    const pin = document.getElementById('kraPin').value;
    const period = document.getElementById('payPeriod').value;
    const gross = parseFloat(document.getElementById('grossPaySlip').value) || 0;
    const company = document.getElementById('companyName').value || "Organization Name";
    const companyAddress = document.getElementById('companyAddress').value || "";
    const companyKra = document.getElementById('companyKra').value || "";
    const companyContacts = document.getElementById('companyContacts').value || "";
    const department = document.getElementById('department').value || "";
    const payslipNumber = document.getElementById('payslipNumber').value || "";
    const loanDeduction = parseFloat(document.getElementById('loanDeduction').value) || 0;

    localStorage.setItem('employeeData', JSON.stringify({
    name, id, pin, period, gross, department, payslipNumber
}));

    const pinRegex = /^[A-Z]{1}\d{9}[A-Z]{1}$/;
    if (pin && !pinRegex.test(pin)) {
        alert("Invalid KRA PIN format. Expected A12345678B");
        return;
    }

    const nssf = calculateNSSF(gross);
    const shif = calculateSHIF(gross);
    const ahl = calculateHousingLevy(gross);
    const taxable = gross - nssf - shif - ahl;
    const paye = calculatePAYE(taxable);
    const totalDeductions = nssf + shif + ahl + paye + loanDeduction;
    const net = gross - totalDeductions;

    // Update display
    document.getElementById('slipName').textContent = name;
    document.getElementById('slipID').textContent = id;
    document.getElementById('slipPin').textContent = pin;
    document.getElementById('slipPeriod').textContent = period;
    document.getElementById('slipGross').textContent = formatKES(gross);
    document.getElementById('slipNSSF').textContent = formatKES(nssf);
    document.getElementById('slipSHIF').textContent = formatKES(shif);
    document.getElementById('slipAHL').textContent = formatKES(ahl);
    document.getElementById('slipPAYE').textContent = formatKES(paye);
    document.getElementById('slipNet').textContent = formatKES(net);
    document.getElementById('slipGrossSummary').textContent = formatKES(gross);
    document.getElementById('slipDeductionsSummary').textContent = formatKES(totalDeductions);

    // Update company header
    const header = document.querySelector('.payslip-header h2');
    if (header) {
        header.textContent = company ? `${company.toUpperCase()} - PAYSLIP` : "PAYSLIP";
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
            document.querySelector('.logo-placeholder button').style.display = 'none';
        };
        reader.readAsDataURL(file);
    }
}

// Print Function
function printPayslip() {
    const originalBodyClass = document.body.className;
    document.body.classList.add('printing');

    const style = document.createElement('style');
    style.id = 'print-styles';
    style.innerHTML = `
        .no-print { display: none !important; }
        body.printing * { visibility: hidden; }
        body.printing .payslip-container,
        body.printing .payslip-container * {
            visibility: visible;
        }
        body.printing .payslip-container {
            position: absolute;
            left: 0;
            top: 0;
            margin: auto;
            width: 100%;
            background: white;
            box-shadow: none;
            border: none;
            padding: 20px;
        }
    `;
    document.head.appendChild(style);

    setTimeout(() => {
        window.print();
        document.body.classList.remove('printing');
        document.getElementById('print-styles')?.remove();
    }, 100);
}


// Reset Function
function resetPayslip() {
    document.getElementById('employeeName').value = '';
    document.getElementById('employeeID').value = '';
    document.getElementById('kraPin').value = '';
    document.getElementById('payPeriod').value = '';
    document.getElementById('grossPaySlip').value = '';
    document.getElementById('companyName').value = '';
    document.getElementById('companyAddress').value = '';
    document.getElementById('companyKra').value = '';
    document.getElementById('companyContacts').value = '';
    document.getElementById('department').value = '';
    document.getElementById('payslipNumber').value = '';
    document.getElementById('loanDeduction').value = '';

    const signatureFields = document.querySelectorAll('.signature-field');
    signatureFields.forEach(field => field.value = '');

    const logoImg = document.getElementById('companyLogo');
    if (logoImg) {
        logoImg.src = '';
        logoImg.style.display = 'none';
    }

    const uploadBtn = document.querySelector('.logo-placeholder button');
    if (uploadBtn) {
        uploadBtn.style.display = 'block';
    }

    document.getElementById('logoUpload').value = '';
    document.getElementById('payslipOutput').style.display = 'none';

    const header = document.querySelector('.payslip-header h2');
    if (header) header.textContent = 'PAYSLIP';

    document.getElementById('slipGrossSummary').textContent = '';
    document.getElementById('slipDeductionsSummary').textContent = '';
}

// Update Deductions Function
function updateDeductions() {
    const loanDeduction = parseFloat(document.getElementById('loanDeduction').value) || 0;
    const gross = parseFloat(document.getElementById('grossPaySlip').value) || 0;
    
    const nssf = calculateNSSF(gross);
    const shif = calculateSHIF(gross);
    const ahl = calculateHousingLevy(gross);
    const taxable = gross - nssf - shif - ahl;
    const paye = calculatePAYE(taxable);
    
    const totalDeductions = nssf + shif + ahl + paye + loanDeduction;
    const net = gross - totalDeductions;
    
    document.getElementById('slipNet').textContent = formatKES(net);
    document.getElementById('slipDeductionsSummary').textContent = formatKES(totalDeductions);
}

// Donation Toggle Function
function toggleDonateInfo() {
    const donateInfo = document.getElementById('donateInfo');
    const donateInfoCalc = document.getElementById('donateInfoCalc');
    
    if (donateInfo) {
        donateInfo.style.display = donateInfo.style.display === 'none' ? 'block' : 'none';
    }
    if (donateInfoCalc) {
        donateInfoCalc.style.display = donateInfoCalc.style.display === 'none' ? 'block' : 'none';
    }
}

function copyPhoneNumber(btn, number) {
    function selectFallback() {
        var span = btn.previousElementSibling;
        if (span) {
            var range = document.createRange();
            range.selectNodeContents(span);
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(number).then(function() {
            var original = btn.innerHTML;
            btn.innerHTML = '✓';
            btn.classList.add('copied');
            setTimeout(function() { btn.innerHTML = original; btn.classList.remove('copied'); }, 2000);
        }).catch(selectFallback);
    } else {
        selectFallback();
    }
}

function selectDonateMethod(section, method) {
    const prefix = section === 'calc' ? 'donateCalc' : 'donateMain';
    const paypalDiv = document.getElementById(prefix + '-paypal');
    const mobileDiv = document.getElementById(prefix + '-mobile');
    const container = paypalDiv ? paypalDiv.closest('.donate-info') : null;
    if (!paypalDiv || !mobileDiv) return;
    if (method === 'paypal') {
        paypalDiv.style.display = '';
        mobileDiv.style.display = 'none';
    } else {
        paypalDiv.style.display = 'none';
        mobileDiv.style.display = '';
    }
    if (container) {
        container.querySelectorAll('.donate-method-tab').forEach(function(btn) {
            btn.classList.toggle('active', btn.dataset.method === method);
        });
    }
}

// Helper Functions
function formatKES(amount) {
    return 'KES ' + amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
window.onload = () => {
    // Check URL parameter for tab
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    if (tab === 'payslip') {
        openPayslipTab();
    }
    
    const saved = JSON.parse(localStorage.getItem('employeeData'));
    if (saved) {
        document.getElementById('employeeName').value = saved.name;
        document.getElementById('employeeID').value = saved.id;
        document.getElementById('kraPin').value = saved.pin;
        document.getElementById('payPeriod').value = saved.period;
        document.getElementById('grossPaySlip').value = saved.gross;
        document.getElementById('department').value = saved.department;
        document.getElementById('payslipNumber').value = saved.payslipNumber;
    }

    // Load calculation from URL params (shared link)
    loadCalculationFromURL();
};

// Navigation dropdown functionality
document.addEventListener('DOMContentLoaded', function() {
    // Handle dropdown toggles
    const dropdownToggles = document.querySelectorAll('.nav-dropdown-toggle');
    dropdownToggles.forEach(toggle => {
        toggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const dropdown = this.closest('.nav-dropdown');
            
            // Close other dropdowns
            document.querySelectorAll('.nav-dropdown').forEach(d => {
                if (d !== dropdown) {
                    d.classList.remove('open');
                }
            });
            
            // Toggle current dropdown
            dropdown.classList.toggle('open');
        });
    });
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.nav-dropdown')) {
            document.querySelectorAll('.nav-dropdown').forEach(d => {
                d.classList.remove('open');
            });
        }
    });
    
    // Mobile menu toggle
    const mobileToggle = document.querySelector('.mobile-menu-toggle');
    if (mobileToggle) {
        mobileToggle.addEventListener('click', function() {
            const nav = document.querySelector('.main-nav');
            nav.classList.toggle('mobile-open');
            // Toggle icon between hamburger and close
            const icon = mobileToggle.querySelector('i');
            if (icon) {
                icon.classList.toggle('fa-bars');
                icon.classList.toggle('fa-times');
            }
        });
    }
});

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
        twBtn.href = 'https://twitter.com/intent/tweet?text=' + tweetText;
    }

    shareSection.style.display = 'block';
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

    // Twitter share link
    const twBtn = document.getElementById('percentileShareBtn');
    if (twBtn) {
        const tweetText = encodeURIComponent(
            'I earn more than ' + pct + '% of Kenyans! 🇰🇪 Check where your salary ranks: https://salarycalculator.co.ke #KenyaSalary #KenyaJobs'
        );
        twBtn.href = 'https://twitter.com/intent/tweet?text=' + tweetText;
    }

    resultsDiv.style.display = 'block';
}
