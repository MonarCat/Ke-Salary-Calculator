// Tab functionality
function openTab(tabName) {
    const tabContents = document.getElementsByClassName('tab-content');
    for (let i = 0; i < tabContents.length; i++) {
        tabContents[i].style.display = 'none';
    }
    
    const tabButtons = document.getElementsByClassName('tab-button');
    for (let i = 0; i < tabButtons.length; i++) {
        tabButtons[i].classList.remove('active');
    }
    
    document.getElementById(tabName).style.display = 'block';
    
    // Find and activate the corresponding button
    for (let i = 0; i < tabButtons.length; i++) {
        if (tabButtons[i].getAttribute('data-tab') === tabName) {
            tabButtons[i].classList.add('active');
            break;
        }
    }
}

// Salary Calculator Functions
function calculateSalary() {
    const grossPay = parseFloat(document.getElementById('grossPay').value) || 0;
    const allowances = parseFloat(document.getElementById('allowances').value) || 0;
    const benefits = parseFloat(document.getElementById('benefits').value) || 0;

    const totalIncome = grossPay + allowances + benefits;

    const nssf = calculateNSSF(grossPay);
    const housingLevy = calculateHousingLevy(grossPay);
    const shif = calculateSHIF(grossPay);

    const deductionsBeforeTax = nssf + housingLevy + shif;
    const taxablePay = totalIncome - deductionsBeforeTax;

    const paye = calculatePAYE(taxablePay);

    const personalRelief = 2400;
    const netPay = totalIncome - (paye + deductionsBeforeTax);

    displayResults(
        totalIncome, paye, nssf, shif, housingLevy,
        personalRelief, netPay
    );

    document.getElementById('results').style.display = 'block';
}

function calculatePAYE(taxablePay) {
    let paye = 0;
    if (taxablePay <= 24000) {
        paye = taxablePay * 0.10;
    } else if (taxablePay <= 32333) {
        paye = 2400 + (taxablePay - 24000) * 0.25;
    } else if (taxablePay <= 500000) {
        paye = 4483.25 + (taxablePay - 32333) * 0.30;
    } else if (taxablePay <= 800000) {
        paye = 140983.25 + (taxablePay - 500000) * 0.325;
    } else {
        paye = 238483.25 + (taxablePay - 800000) * 0.35;
    }
    return Math.max(paye - 2400, 0);
}

function calculateNSSF(grossPay) {
    const lowerLimit = 8000;
    const upperLimit = 72000;
    const tier1 = Math.min(grossPay, lowerLimit) * 0.06;
    
    if (grossPay > lowerLimit) {
        const capped = Math.min(grossPay, upperLimit);
        return tier1 + ((capped - lowerLimit) * 0.06);
    }
    return tier1;
}

function calculateSHIF(grossPay) {
    return grossPay * 0.0275;
}

function calculateHousingLevy(grossPay) {
    return grossPay * 0.015;
}

function displayResults(taxablePay, paye, nssf, shif, housingLevy, personalRelief, netPay) {
    document.getElementById('displayGross').textContent = formatKES(taxablePay);
    document.getElementById('paye').textContent = formatKES(paye);
    document.getElementById('nssf').textContent = formatKES(nssf);
    document.getElementById('nhif').textContent = formatKES(shif);
    document.getElementById('housingLevy').textContent = formatKES(housingLevy);
    document.getElementById('personalRelief').textContent = formatKES(personalRelief);
    document.getElementById('netPay').textContent = formatKES(netPay);
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
    const pinRegex = /^[A-Z]{1}\d{9}[A-Z]{1}$/;
    if (!pinRegex.test(pin)) {
        alert ("Invalid KRA PIN format. Expected A12345678B");
        return;
    }
    

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
async function printPayslip() {
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

// Helper Functions
function formatKES(amount) {
    return 'KES ' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
window.onload = () => {
    // Check URL parameter for tab
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    if (tab === 'payslip') {
        openTab('payslip');
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
        });
    }
});
