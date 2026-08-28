(function () {
  'use strict';

  var TAX_YEAR_LABEL = 'Updated for FY 2025/2026';

  var HEADER_HTML = [
    '<div class="site-header">',
    '  <div class="logo-container">',
    '    <a href="/">',
    '      <img src="/assets/images/Logo.png" alt="Kenya Salary Calculator Logo" width="260" height="130" loading="eager">',
    '    </a>',
    '  </div>',
    '  <button class="mobile-menu-toggle" aria-label="Toggle navigation menu">',
    '    <i class="fas fa-bars"></i>',
    '  </button>',
    '  <nav class="main-nav">',
    '    <a href="/">Home</a>',
    '    <div class="nav-dropdown">',
    '      <span class="nav-dropdown-toggle">Calculators <i class="fas fa-chevron-down"></i></span>',
    '      <div class="nav-dropdown-menu">',
    '        <a href="/calculator.html">Salary Calculator</a>',
    '        <a href="/paye-calculator-kenya.html">PAYE Calculator</a>',
    '        <a href="/reverse-salary-calculator.html">Reverse Calculator</a>',
    '        <a href="/salary-after-tax.html">Salary After Tax</a>',
    '        <a href="/global-salary-calculator.html">Global Calculator</a>',
    '        <a href="/salary-raise-calculator.html">Salary Raise Calculator</a>',
    '        <a href="/salary-comparison.html">Compare Salaries</a>',
    '        <a href="/calculator.html#percentile">Kenya Percentile</a>',
    '        <a href="/budget-planner.html">Budget Planner</a>',
    '      </div>',
    '    </div>',
    '    <div class="nav-dropdown">',
    '      <span class="nav-dropdown-toggle">Payroll <i class="fas fa-chevron-down"></i></span>',
    '      <div class="nav-dropdown-menu">',
    '        <a href="/payslip-generator-kenya.html">Payslip Generator</a>',
    '        <a href="/p9a-generator.html">P9A Generator</a>',
    '        <a href="/payroll-import.html">Payroll Import</a>',
    '        <a href="/payroll-history.html">Payroll History</a>',
    '        <a href="/payroll-report.html">Payroll Report</a>',
    '        <a href="/employees.html">Manage Employees</a>',
    '        <a href="/organisation-profile.html">Organisation Profile</a>',
    '      </div>',
    '    </div>',
    '    <div class="nav-dropdown">',
    '      <span class="nav-dropdown-toggle">Salaries <i class="fas fa-chevron-down"></i></span>',
    '      <div class="nav-dropdown-menu">',
    '        <a href="/salary-index.html">Salary Index Table</a>',
    '        <a href="/salary/software-engineer-kenya.html">Software Engineer</a>',
    '        <a href="/salary/nurse-kenya.html">Nurse</a>',
    '        <a href="/salary/teacher-kenya.html">Teacher</a>',
    '        <a href="/salary/accountant-kenya.html">Accountant</a>',
    '        <a href="/salary/doctor-kenya.html">Doctor</a>',
    '        <a href="/50000.html">KES 50,000 Salary</a>',
    '        <a href="/100000.html">KES 100,000 Salary</a>',
    '        <a href="/salary-guess-game.html">Guess the Salary</a>',
    '        <a href="/polls.html">Salary & Work Polls</a>',
    '      </div>',
    '    </div>',
    '    <div class="nav-dropdown">',
    '      <span class="nav-dropdown-toggle">Learn <i class="fas fa-chevron-down"></i></span>',
    '      <div class="nav-dropdown-menu">',
    '        <a href="/blog.html">Blog</a>',
    '        <a href="/faq.html">FAQ</a>',
    '        <a href="/salary-news.html">Salary News</a>',
    '        <a href="/statutory-deductions-kenya.html">Statutory Deductions Explained</a>',
    '        <a href="/how-paye-is-calculated-kenya-2026.html">How PAYE Is Calculated</a>',
    '        <a href="/understanding-your-kenyan-payslip.html">Understanding Your Payslip</a>',
    '        <a href="/kenya-affordable-housing-levy-explained.html">Housing Levy Explained</a>',
    '        <a href="/nssf-tier-i-vs-tier-ii-kenya.html">NSSF Tier I vs Tier II</a>',
    '        <a href="/shif-vs-nhif-kenya-2024.html">SHIF vs NHIF</a>',
    '        <a href="/what-is-shif-levy-kenya.html">What Is SHIF Levy</a>',
    '        <a href="/kenya-tax-abolition-below-30000.html">Tax Abolition Below KES 30,000</a>',
    '        <a href="/cost-of-living-nairobi-2025.html">Cost of Living in Nairobi</a>',
    '        <a href="/how-to-negotiate-salary-kenya-2025.html">How to Negotiate Salary</a>',
    '      </div>',
    '    </div>',
    '    <div class="nav-dropdown">',
    '      <span class="nav-dropdown-toggle">Support <i class="fas fa-chevron-down"></i></span>',
    '      <div class="nav-dropdown-menu">',
    '        <a href="/donate.html">Donate</a>',
    '        <a href="/contact-us.html">Contact Us</a>',
    '      </div>',
    '    </div>',
    '    <a href="/about-us.html">About Us</a>',
    '    <a href="/external-links.html">External Links</a>',
    '    <div id="auth-links" class="auth-links-container"></div>',
    '    <button class="dark-mode-toggle" id="darkModeToggle" aria-label="Toggle dark mode" title="Toggle dark mode">🌙 Dark</button>',
    '  </nav>',
    '  <div class="sc-ad-slot" data-ad-slot="banner" aria-live="polite"></div>',
    '  <div class="site-tax-year-badge" style="text-align:center;margin-top:8px;">',
    '    <span class="trust-badge" data-tax-year-label></span>',
    '  </div>',
    '</div>'
  ].join('');

  var FOOTER_HTML = [
    '<footer style="text-align: center; padding: 20px; margin-top: 30px; font-size: 12px; color: #666;">',
    '  <p style="margin-bottom: 10px;">',
    '    <a href="/privacy-policy.html" style="color: #006600; text-decoration: none; margin: 0 10px;">Privacy Policy</a> |',
    '    <a href="/terms-of-service.html" style="color: #006600; text-decoration: none; margin: 0 10px;">Terms of Service</a> |',
    '    <a href="/cookie-policy.html" style="color: #006600; text-decoration: none; margin: 0 10px;">Cookie Policy</a>',
    '  </p>',
    '  <p>© <script>document.write(new Date().getFullYear())</script> Salary Calculator, Thika Road, Nairobi</p>',
    '</footer>'
  ].join('');

  function normalizePath(pathname) {
    if (!pathname) return '/';
    var normalized = pathname.replace(/\/index\.html$/, '/');
    normalized = normalized.replace(/\/$/, '');
    return normalized || '/';
  }

  function updateTaxYearLabels(root) {
    root.querySelectorAll('[data-tax-year-label]').forEach(function (el) {
      el.textContent = TAX_YEAR_LABEL;
    });
  }

  function applyActiveNavState(root) {
    var currentPath = normalizePath(window.location.pathname);
    var activeLink = null;

    root.querySelectorAll('.main-nav a[href]').forEach(function (link) {
      var rawHref = link.getAttribute('href') || '';
      if (!rawHref || rawHref.charAt(0) === '#') return;

      var hrefPath = rawHref.split('#')[0].split('?')[0];
      if (!hrefPath) hrefPath = '/';
      var normalizedHref = normalizePath(hrefPath);

      if (normalizedHref === currentPath) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
        if (!activeLink) activeLink = link;
      }
    });

    if (activeLink) {
      var parentDropdown = activeLink.closest('.nav-dropdown');
      if (parentDropdown) {
        parentDropdown.classList.add('open');
        var toggle = parentDropdown.querySelector('.nav-dropdown-toggle');
        if (toggle) toggle.classList.add('active');
      }
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var headerMount = document.getElementById('site-header');
    if (headerMount) {
      headerMount.innerHTML = HEADER_HTML;
      updateTaxYearLabels(headerMount);
      applyActiveNavState(headerMount);
    }

    var footerMount = document.getElementById('site-footer');
    if (footerMount) {
      footerMount.innerHTML = FOOTER_HTML;
    }

    updateTaxYearLabels(document);
  });
})();
