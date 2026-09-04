// assets/js/salary-engine.js
// Reusable Kenya salary deductions engine
// window.SalaryEngine is exposed as a global
//
// Multi-year support added: script.js, employees.html, and index.html each
// used to carry their own independent copy of these rate tables and
// calculation functions. That duplication is exactly how the KES 3,800.10
// PAYE band-base bug (see commit 0779e03) had to be hotfixed in four
// separate places instead of one. This file is now the single source of
// truth for all three; the old per-page copies delegate here.

(function () {
    'use strict';

    // PAYE bands, personal relief, SHIF rate, and Housing Levy rate have not
    // changed year over year in this app's history -- only the NSSF
    // Tier I/II thresholds move (Phase 4 schedule). Rates are still kept as
    // separate year objects (rather than one shared band table + a map of
    // NSSF thresholds) so a future year with a genuine PAYE band change is a
    // same-shape addition, not a structural one.
    const RATES_2024 = {
        label: 'Rates 2024',
        personalRelief: 2400,
        nssfLower: 7000, nssfUpper: 36000, nssfRate: 0.06,
        shifRate: 0.0275,
        shifMinimum: 300,
        housingLevyRate: 0.015,
        insuranceReliefRate: 0.15,
        payeBands: [
            { limit: 24000,   rate: 0.10,  base: 0 },
            { limit: 32333,   rate: 0.25,  base: 2400 },
            { limit: 500000,  rate: 0.30,  base: 4483.25 },
            { limit: 800000,  rate: 0.325, base: 144783.35 },
            { limit: Infinity,rate: 0.35,  base: 242283.35 },
        ]
    };

    const RATES_2025 = {
        label: 'Rates updated Feb 2025',
        personalRelief: 2400,
        nssfLower: 8000, nssfUpper: 72000, nssfRate: 0.06,
        shifRate: 0.0275,
        shifMinimum: 300,
        housingLevyRate: 0.015,
        insuranceReliefRate: 0.15,
        payeBands: [
            { limit: 24000,   rate: 0.10,  base: 0 },
            { limit: 32333,   rate: 0.25,  base: 2400 },
            { limit: 500000,  rate: 0.30,  base: 4483.25 },
            { limit: 800000,  rate: 0.325, base: 144783.35 },
            { limit: Infinity,rate: 0.35,  base: 242283.35 },
        ]
    };

    const RATES_2026 = {
        label: 'Rates updated Feb 2026 — NSSF Phase 4',
        personalRelief: 2400,
        nssfLower: 9000, nssfUpper: 108000, nssfRate: 0.06,
        shifRate: 0.0275,
        shifMinimum: 300,
        housingLevyRate: 0.015,
        insuranceReliefRate: 0.15,
        payeBands: [
            { limit: 24000,   rate: 0.10,  base: 0 },
            { limit: 32333,   rate: 0.25,  base: 2400 },
            { limit: 500000,  rate: 0.30,  base: 4483.25 },
            { limit: 800000,  rate: 0.325, base: 144783.35 },
            { limit: Infinity,rate: 0.35,  base: 242283.35 },
        ]
    };

    const RATES_BY_YEAR = { '2024': RATES_2024, '2025': RATES_2025, '2026': RATES_2026 };
    const DEFAULT_YEAR = '2026';

    function getRates(year) {
        return RATES_BY_YEAR[year] || RATES_BY_YEAR[DEFAULT_YEAR];
    }

    function calculateNSSF(gross, rates) {
        rates = rates || RATES_2026;
        const tier1 = Math.min(gross, rates.nssfLower) * rates.nssfRate;
        if (gross > rates.nssfLower) {
            const capped = Math.min(gross, rates.nssfUpper);
            return tier1 + ((capped - rates.nssfLower) * rates.nssfRate);
        }
        return tier1;
    }

    function calculateSHIF(gross, rates) {
        rates = rates || RATES_2026;
        return Math.max(gross * rates.shifRate, rates.shifMinimum);
    }

    function calculateHousingLevy(gross, rates) {
        rates = rates || RATES_2026;
        return gross * rates.housingLevyRate;
    }

    function calculatePAYE(taxable, extraRelief, personalRelief, rates) {
        rates = rates || RATES_2026;
        const bands = rates.payeBands;
        let paye = 0;
        for (let i = 0; i < bands.length; i++) {
            const lower = i === 0 ? 0 : bands[i - 1].limit;
            // Each band's base already includes the tax due from all prior bands.
            if (taxable > lower) paye = bands[i].base + (taxable - lower) * bands[i].rate;
            if (taxable <= bands[i].limit) break;
        }
        const totalRelief = (personalRelief || rates.personalRelief) + (extraRelief || 0);
        return Math.max(paye - totalRelief, 0);
    }

    /**
     * calculateDeductions(grossSalary, options)
     * options: { year, helb, pension, mortgageInterest, insurancePremium, lifeInsurance, pwdExempt }
     * `year` defaults to '2026' -- unchanged behavior for existing callers
     * (calculator.html, p9a-generator.html, payroll-import.html, budget-planner.html,
     * reverse-salary-calculator.html, global-salary-calculator.html, payroll-history.html,
     * payroll-report.html, salary-after-tax.html) that don't pass one.
     * Returns deduction breakdown object.
     */
    function calculateDeductions(grossSalary, options) {
        options = options || {};
        const rates = getRates(options.year || DEFAULT_YEAR);
        const gross = Math.max(parseFloat(grossSalary) || 0, 0);
        const helb    = Math.max(parseFloat(options.helb) || 0, 0);
        const pension = Math.min(Math.max(parseFloat(options.pension) || 0, 0), 30000);
        const mortgage= Math.min(Math.max(parseFloat(options.mortgageInterest) || 0, 0), 30000);
        const healthIns = Math.max(parseFloat(options.insurancePremium) || 0, 0);
        const lifeIns   = Math.max(parseFloat(options.lifeInsurance) || 0, 0);
        const pwdExempt = !!options.pwdExempt;

        const nssf      = calculateNSSF(gross, rates);
        const nssfTier1 = Math.min(gross, rates.nssfLower) * rates.nssfRate;
        const nssfTier2 = nssf - nssfTier1;
        const shif      = calculateSHIF(gross, rates);
        const housingLevy = calculateHousingLevy(gross, rates);

        const allowableDeductions = pension + mortgage;
        let taxablePay = Math.max(gross - nssf - shif - housingLevy - allowableDeductions, 0);

        // Insurance relief: 15% of combined premium, capped at KES 5,000/month
        const combinedInsurance = healthIns + lifeIns;
        const insuranceRelief = Math.min(combinedInsurance * rates.insuranceReliefRate, 5000);

        if (pwdExempt) taxablePay = Math.max(taxablePay - 150000, 0);

        const paye = calculatePAYE(taxablePay, insuranceRelief, rates.personalRelief, rates);

        const totalStatutory = paye + nssf + shif + housingLevy;
        const totalDeductions = totalStatutory + helb;
        const netSalary = gross - totalDeductions;
        const effectiveRate = gross > 0 ? (totalDeductions / gross) * 100 : 0;

        return {
            gross, paye, nssf, nssfTier1, nssfTier2, shif, housingLevy,
            helb, pension, mortgage, taxablePay, insuranceRelief,
            totalStatutory, totalDeductions, netSalary, effectiveRate
        };
    }

    /**
     * reverseCalculate(targetNet, options)
     * Binary-search the gross that yields the desired net pay.
     */
    // Upper bound: 5× the target net is intentionally conservative.
    // Even near a ~45% effective deduction rate, gross is still only about 1.82× net,
    // so 5× leaves wide headroom without risking a missed solution.
    const REVERSE_CALC_UPPER_MULTIPLIER = 5;
    // 60 iterations gives sub-cent precision via binary search
    const REVERSE_CALC_MAX_ITERATIONS   = 60;

    function reverseCalculate(targetNet, options) {
        options = options || {};
        const target = Math.max(parseFloat(targetNet) || 0, 0);
        if (target <= 0) return null;
        let low = target, high = target * REVERSE_CALC_UPPER_MULTIPLIER;
        let result;
        for (let i = 0; i < REVERSE_CALC_MAX_ITERATIONS; i++) {
            const mid = (low + high) / 2;
            result = calculateDeductions(mid, options);
            if (Math.abs(result.netSalary - target) < 0.5) break;
            if (result.netSalary < target) low = mid;
            else high = mid;
        }
        return result;
    }

    window.SalaryEngine = {
        calculateDeductions, reverseCalculate,
        calculateNSSF, calculateSHIF, calculateHousingLevy, calculatePAYE,
        getRates,
        RATES_2024, RATES_2025, RATES_2026, RATES_BY_YEAR
    };
})();
