// assets/js/salary-engine.js
// Reusable Kenya salary deductions engine
// window.SalaryEngine is exposed as a global

(function () {
    'use strict';

    const RATES_2026 = {
        personalRelief: 2400,
        nssfLower: 9000, nssfUpper: 108000, nssfRate: 0.06,
        shifRate: 0.0275,
        housingLevyRate: 0.015,
        insuranceReliefRate: 0.15,
        payeBands: [
            { limit: 24000,   rate: 0.10,  base: 0 },
            { limit: 32333,   rate: 0.25,  base: 2400 },
            { limit: 500000,  rate: 0.30,  base: 4483.25 },
            { limit: 800000,  rate: 0.325, base: 140983.25 },
            { limit: Infinity,rate: 0.35,  base: 238483.25 },
        ]
    };

    function calculateNSSF(gross) {
        // Reads from RATES_2026 rather than hardcoding the thresholds here
        // a second time -- this file previously had the NSSF Tier I/II
        // limits duplicated in three separate places (this function, the
        // RATES_2026 constant above which this function didn't actually
        // use, and the nssfTier1 line in calculateDeductions below), so
        // updating just the constant silently changed nothing about the
        // real calculation. Single source of truth now.
        const tier1 = Math.min(gross, RATES_2026.nssfLower) * RATES_2026.nssfRate;
        if (gross > RATES_2026.nssfLower) {
            const capped = Math.min(gross, RATES_2026.nssfUpper);
            return tier1 + ((capped - RATES_2026.nssfLower) * RATES_2026.nssfRate);
        }
        return tier1;
    }

    function calculatePAYE(taxable, extraRelief, personalRelief) {
        const bands = RATES_2026.payeBands;
        let paye = 0;
        for (let i = 0; i < bands.length; i++) {
            const lower = i === 0 ? 0 : bands[i - 1].limit;
            // Each band's base already includes the tax due from all prior bands.
            if (taxable > lower) paye = bands[i].base + (taxable - lower) * bands[i].rate;
            if (taxable <= bands[i].limit) break;
        }
        const totalRelief = (personalRelief || RATES_2026.personalRelief) + (extraRelief || 0);
        return Math.max(paye - totalRelief, 0);
    }

    /**
     * calculateDeductions(grossSalary, options)
     * options: { helb, pension, mortgageInterest, insurancePremium, lifeInsurance, pwdExempt }
     * Returns deduction breakdown object.
     */
    function calculateDeductions(grossSalary, options) {
        options = options || {};
        const gross = Math.max(parseFloat(grossSalary) || 0, 0);
        const helb    = Math.max(parseFloat(options.helb) || 0, 0);
        const pension = Math.min(Math.max(parseFloat(options.pension) || 0, 0), 30000);
        const mortgage= Math.min(Math.max(parseFloat(options.mortgageInterest) || 0, 0), 30000);
        const healthIns = Math.max(parseFloat(options.insurancePremium) || 0, 0);
        const lifeIns   = Math.max(parseFloat(options.lifeInsurance) || 0, 0);
        const pwdExempt = !!options.pwdExempt;

        const nssf      = calculateNSSF(gross);
        const nssfTier1 = Math.min(gross, RATES_2026.nssfLower) * RATES_2026.nssfRate;
        const nssfTier2 = nssf - nssfTier1;
        const shif      = gross * RATES_2026.shifRate;
        const housingLevy = gross * RATES_2026.housingLevyRate;

        const allowableDeductions = pension + mortgage;
        let taxablePay = Math.max(gross - nssf - shif - housingLevy - allowableDeductions, 0);

        // Insurance relief: 15% of combined premium, capped at KES 5,000/month
        const combinedInsurance = healthIns + lifeIns;
        const insuranceRelief = Math.min(combinedInsurance * RATES_2026.insuranceReliefRate, 5000);

        if (pwdExempt) taxablePay = Math.max(taxablePay - 150000, 0);

        const paye = calculatePAYE(taxablePay, insuranceRelief, RATES_2026.personalRelief);

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

    window.SalaryEngine = { calculateDeductions, reverseCalculate, RATES_2026 };
})();
