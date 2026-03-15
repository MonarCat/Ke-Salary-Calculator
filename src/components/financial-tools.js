/**
 * financial-tools.js – Salary-range-aware affiliate card section
 *
 * Cards are dynamically chosen based on the user's calculated net salary.
 * Listens for the custom "salaryCalculated" event fired by calculator-enhancements.js.
 * Cards animate in on scroll via IntersectionObserver.
 *
 * Usage: included by calculator-enhancements.js – no direct import needed.
 */

(function () {
    'use strict';

    // ── Card definitions ──────────────────────────────────────────────────────
    // Each card has a salary-range threshold (maxSalary means "show up to this gross").
    // Affiliate URLs are placeholders – replace with real partner links.

    const CARD_SETS = {
        loan: [
            {
                id: 'tala',
                title: 'Tala – Instant Mobile Loans',
                description: 'Get up to KES 30,000 in minutes. No paperwork required.',
                cta: 'Get a Loan →',
                url: 'https://tala.co.ke/', // replace with affiliate URL
                emoji: '💳',
                tag: 'Instant',
            },
            {
                id: 'branch',
                title: 'Branch – Low-Interest Loans',
                description: 'Flexible repayment terms. Borrow up to KES 70,000.',
                cta: 'Apply Now →',
                url: 'https://branch.co/', // replace with affiliate URL
                emoji: '🏦',
                tag: 'Low Interest',
            },
            {
                id: 'mshwari',
                title: 'M-Shwari – Save & Borrow',
                description: 'Lock savings and unlock credit directly on your M-Pesa.',
                cta: 'Learn More →',
                url: 'https://www.safaricom.co.ke/personal/m-pesa/do-more-with-m-pesa/m-shwari',
                emoji: '📱',
                tag: 'M-Pesa',
            },
        ],
        investment: [
            {
                id: 'cytonn',
                title: 'Cytonn – High-Yield Investments',
                description: 'Earn up to 18% p.a. on your savings. Regulated by the CMA.',
                cta: 'Invest Now →',
                url: 'https://cytonn.com/', // replace with affiliate URL
                emoji: '📈',
                tag: 'High Yield',
            },
            {
                id: 'sanlam',
                title: 'Sanlam Unit Trusts',
                description: 'Diversified portfolios starting from KES 1,000/month.',
                cta: 'Start Investing →',
                url: 'https://www.sanlam.co.ke/', // replace with affiliate URL
                emoji: '🏢',
                tag: 'Unit Trust',
            },
            {
                id: 'nse',
                title: 'NSE – Invest in Stocks',
                description: 'Buy shares of Kenyan companies directly on the NSE.',
                cta: 'Open Account →',
                url: 'https://www.nse.co.ke/', // replace with affiliate URL
                emoji: '📊',
                tag: 'Stocks',
            },
        ],
        insurance: [
            {
                id: 'jubilee',
                title: 'Jubilee Health Insurance',
                description: 'Affordable health cover for individuals and families.',
                cta: 'Get a Quote →',
                url: 'https://www.jubileeinsurance.com/', // replace with affiliate URL
                emoji: '🏥',
                tag: 'Health',
            },
            {
                id: 'britam',
                title: 'Britam Life Cover',
                description: 'Protect your family\'s future starting from KES 500/month.',
                cta: 'Get Covered →',
                url: 'https://www.britam.com/', // replace with affiliate URL
                emoji: '🛡️',
                tag: 'Life',
            },
        ],
    };

    // Thresholds: salary ≤ threshold → show this category
    const CATEGORY_THRESHOLDS = [
        { maxNet: 50000,   categories: ['loan', 'insurance'] },
        { maxNet: 150000,  categories: ['investment', 'insurance'] },
        { maxNet: Infinity, categories: ['investment', 'insurance'] },
    ];

    // ── Build UI ──────────────────────────────────────────────────────────────

    function getCategories(netSalary) {
        for (const tier of CATEGORY_THRESHOLDS) {
            if (netSalary <= tier.maxNet) return tier.categories;
        }
        return ['investment', 'insurance'];
    }

    function buildCard(card) {
        return `
        <a href="${card.url}" class="ke-ft-card" target="_blank" rel="noopener noreferrer sponsored"
           data-card-id="${card.id}">
            <span class="ke-ft-card__tag">${card.tag}</span>
            <span class="ke-ft-card__emoji">${card.emoji}</span>
            <h3 class="ke-ft-card__title">${card.title}</h3>
            <p class="ke-ft-card__desc">${card.description}</p>
            <span class="ke-ft-card__cta">${card.cta}</span>
        </a>`;
    }

    function render(container, netSalary) {
        const categories = getCategories(netSalary);
        const cards = categories.flatMap(cat => CARD_SETS[cat] || []);

        if (!cards.length) {
            container.style.display = 'none';
            return;
        }

        container.innerHTML = `
            <div class="ke-ft-header">
                <h2 class="ke-ft-heading">💡 Financial Tools for You</h2>
                <p class="ke-ft-subheading">Based on your salary range</p>
            </div>
            <div class="ke-ft-grid">
                ${cards.map(buildCard).join('')}
            </div>
            <p class="ke-ft-disclaimer">
                Partner links – we may earn a commission at no extra cost to you.
            </p>`;

        container.style.display = '';
        setupObserver(container);
    }

    // ── IntersectionObserver animation ────────────────────────────────────────

    function setupObserver(container) {
        if (!('IntersectionObserver' in window)) {
            // Fallback: show all immediately
            container.querySelectorAll('.ke-ft-card').forEach(el => {
                el.classList.add('ke-ft-card--visible');
            });
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('ke-ft-card--visible');
                        observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.15 }
        );

        container.querySelectorAll('.ke-ft-card').forEach(el => observer.observe(el));
    }

    // ── Event listener ────────────────────────────────────────────────────────

    function init() {
        const container = document.getElementById('ke-financial-tools');
        if (!container) return;

        window.addEventListener('salaryCalculated', (e) => {
            const netPay = e.detail && e.detail.netPay ? e.detail.netPay : 0;
            render(container, netPay);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
