/**
 * /assets/js/financial-tools.js
 *
 * Salary-range-aware affiliate card section.
 * Cards are dynamically selected based on the user's calculated gross salary.
 * Inserts a container element after the specified anchor element.
 *
 * Usage:
 *   import { initFinancialCards } from './financial-tools.js';
 *   initFinancialCards({ afterElementId: 'salary-breakdown-table' });
 *
 * Cards animate in on scroll via IntersectionObserver.
 * Affiliate URLs are placeholders — replace with real partner links.
 */

// ── Card definitions ──────────────────────────────────────────────────────────

const CARD_SETS = {
  loan: [
    {
      id: "tala",
      title: "Tala – Instant Mobile Loans",
      description: "Get up to KES 30,000 in minutes. No paperwork required.",
      cta: "Get a Loan →",
      url: "https://tala.co.ke/",
      emoji: "💳",
      tag: "Instant",
    },
    {
      id: "branch",
      title: "Branch – Low-Interest Loans",
      description: "Flexible repayment terms. Borrow up to KES 70,000.",
      cta: "Apply Now →",
      url: "https://branch.co/",
      emoji: "🏦",
      tag: "Low Interest",
    },
    {
      id: "mshwari",
      title: "M-Shwari – Save & Borrow",
      description: "Lock savings and unlock credit directly on your M-Pesa.",
      cta: "Learn More →",
      url: "https://www.safaricom.co.ke/personal/m-pesa/do-more-with-m-pesa/m-shwari",
      emoji: "📱",
      tag: "M-Pesa",
    },
  ],
  investment: [
    {
      id: "cytonn",
      title: "Cytonn – High-Yield Investments",
      description: "Earn up to 18% p.a. on your savings. Regulated by the CMA.",
      cta: "Invest Now →",
      url: "https://cytonn.com/",
      emoji: "📈",
      tag: "High Yield",
    },
    {
      id: "sanlam",
      title: "Sanlam Unit Trusts",
      description: "Diversified portfolios starting from KES 1,000/month.",
      cta: "Start Investing →",
      url: "https://www.sanlam.co.ke/",
      emoji: "🏢",
      tag: "Unit Trust",
    },
    {
      id: "nse",
      title: "NSE – Invest in Stocks",
      description: "Buy shares of Kenyan companies directly on the NSE.",
      cta: "Open Account →",
      url: "https://www.nse.co.ke/",
      emoji: "📊",
      tag: "Stocks",
    },
  ],
  insurance: [
    {
      id: "jubilee",
      title: "Jubilee Health Insurance",
      description: "Affordable health cover for individuals and families.",
      cta: "Get a Quote →",
      url: "https://www.jubileeinsurance.com/",
      emoji: "🏥",
      tag: "Health",
    },
    {
      id: "britam",
      title: "Britam Life Cover",
      description: "Protect your family's future starting from KES 500/month.",
      cta: "Get Covered →",
      url: "https://www.britam.com/",
      emoji: "🛡️",
      tag: "Life",
    },
  ],
};

// Salary-based category selection
const CATEGORY_THRESHOLDS = [
  { maxNet: 50000,    categories: ["loan", "insurance"] },
  { maxNet: 150000,   categories: ["investment", "insurance"] },
  { maxNet: Infinity, categories: ["investment", "insurance"] },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function _getCategories(netSalary) {
  for (const tier of CATEGORY_THRESHOLDS) {
    if (netSalary <= tier.maxNet) return tier.categories;
  }
  return ["investment", "insurance"];
}

function _buildCard(card) {
  return `
    <a href="${card.url}" class="sc-ft-card" target="_blank" rel="noopener noreferrer sponsored"
       data-card-id="${card.id}">
      <span class="sc-ft-card__tag">${card.tag}</span>
      <span class="sc-ft-card__emoji">${card.emoji}</span>
      <h3 class="sc-ft-card__title">${card.title}</h3>
      <p class="sc-ft-card__desc">${card.description}</p>
      <span class="sc-ft-card__cta">${card.cta}</span>
    </a>`;
}

function _render(container, netSalary) {
  const categories = _getCategories(netSalary);
  const cards = categories.flatMap((cat) => CARD_SETS[cat] || []);

  if (!cards.length) {
    container.style.display = "none";
    return;
  }

  container.innerHTML = `
    <div class="sc-ft-header">
      <h2 class="sc-ft-heading">💡 Financial Tools for You</h2>
      <p class="sc-ft-subheading">Based on your salary range</p>
    </div>
    <div class="sc-ft-grid">
      ${cards.map(_buildCard).join("")}
    </div>
    <p class="sc-ft-disclaimer">
      Partner links – we may earn a commission at no extra cost to you.
    </p>`;

  container.style.display = "";
  _setupObserver(container);
}

function _setupObserver(container) {
  if (!("IntersectionObserver" in window)) {
    container.querySelectorAll(".sc-ft-card").forEach((el) =>
      el.classList.add("sc-ft-card--visible")
    );
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("sc-ft-card--visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  container.querySelectorAll(".sc-ft-card").forEach((el) => observer.observe(el));
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Initialise the financial tools card section.
 *
 * @param {{ afterElementId?: string }} opts
 *   afterElementId — ID of the element after which to insert the cards container.
 *                    If omitted, looks for an existing #sc-financial-tools element.
 */
export function initFinancialCards({ afterElementId } = {}) {
  let container = document.getElementById("sc-financial-tools");

  if (!container) {
    container = document.createElement("div");
    container.id = "sc-financial-tools";
    container.style.display = "none";

    if (afterElementId) {
      const anchor = document.getElementById(afterElementId);
      if (anchor && anchor.parentNode) {
        anchor.parentNode.insertBefore(container, anchor.nextSibling);
      } else {
        document.body.appendChild(container);
      }
    }
  }

  document.addEventListener("salaryCalculated", (e) => {
    const net = e.detail?.net ?? 0;
    _render(container, net);
  });
}
