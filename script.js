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
    event.currentTarget.classList.add('active');
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
    const period = document.getElementById('payPeriod').value;
    const gross = parseFloat(document.getElementById('grossPaySlip').value) || 0;
    const company = document.getElementById('companyName').value || "Organization Name";
    const companyAddress = document.getElementById('companyAddress').value || "";
    const companyContacts = document.getElementById('companyContacts').value || "";
    const department = document.getElementById('department').value || "";
    const payslipNumber = document.getElementById('payslipNumber').value || "";
    const loanDeduction = parseFloat(document.getElementById('loanDeduction').value) || 0;

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
    // Store original body class
    const originalBodyClass = document.body.className;
    
    // Add print class to body
    document.body.classList.add('printing');
    
    // Create print-specific styles
    const style = document.createElement('style');
    style.id = 'print-styles';
    style.innerHTML = `
        @page { size: A5 portrait; margin: 5mm; }
        body.printing * { visibility: hidden; }
        body.printing .payslip-container,
        body.printing .payslip-container * { 
            visibility: visible; 
        }
        body.printing .payslip-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 148mm !important;
            min-height: 210mm;
            margin: 0 !important;
            padding: 5mm !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
        }
        .no-print { display: none !important; }
    `;
    document.head.appendChild(style);
    
    // Print and clean up
    setTimeout(() => {
        window.print();
        
        // Restore original state
        document.body.classList.remove('printing');
        document.getElementById('print-styles')?.remove();
        
        // Small delay to ensure print completes
        setTimeout(() => {
            // Additional cleanup if needed
        }, 500);
    }, 100);
}

// Reset Function
function resetPayslip() {
    // Clear all input fields
    document.getElementById('employeeName').value = '';
    document.getElementById('employeeID').value = '';
    document.getElementById('payPeriod').value = '';
    document.getElementById('grossPaySlip').value = '';
    document.getElementById('companyName').value = '';
    document.getElementById('companyAddress').value = '';
    document.getElementById('companyContacts').value = '';
    document.getElementById('department').value = '';
    document.getElementById('payslipNumber').value = '';
    document.getElementById('loanDeduction').value = '';
    
    // Clear signature fields
    const signatureFields = document.querySelectorAll('.signature-field');
    signatureFields.forEach(field => field.value = '');
    
    // Reset logo
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
    
    // Hide the payslip output
    document.getElementById('payslipOutput').style.display = 'none';
    
    // Reset the payslip header title
    const header = document.querySelector('.payslip-header h2');
    if (header) header.textContent = 'PAYSLIP';
    
    // Clear summary sections
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