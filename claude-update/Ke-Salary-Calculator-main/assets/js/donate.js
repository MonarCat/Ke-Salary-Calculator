/**
 * /assets/js/donate.js
 *
 * Reusable donation payment component for donate.html.
 * Payment provider: Paystack (same provider already used for Premium — see
 * assets/js/premium.js). Donations do NOT require sign-in: anyone can give.
 *
 * Expects (all optional):
 *   window.PAYSTACK_PUBLIC_KEY    — set by assets/js/supabase-config.js
 *   window.__PAYSTACK_PUBLIC_KEY  — fallback, set directly in a page <head>
 *   window.__DONATION_CONFIG      — { mpesa: {...}, bank: {...} } — see donate.html
 *
 * Markup contract (ids used by this script):
 *   #donate-form, #donate-amount-group [data-amount], #donate-custom-amount,
 *   #donate-name, #donate-email, #donate-submit, #donate-form-section,
 *   #donate-error, #donate-success, #donate-success-amount,
 *   #donate-success-ref, #donate-again-btn
 */
(function () {
  'use strict';

  var MIN_AMOUNT_KES = 10;
  var MAX_AMOUNT_KES = 1000000;

  var state = { amount: null };

  function formatKES(n) {
    if (window.FormatUtils && typeof window.FormatUtils.formatKES === 'function') {
      return window.FormatUtils.formatKES(n);
    }
    return 'KES ' + Math.round(n).toLocaleString('en-KE');
  }

  function getPublicKey() {
    return window.PAYSTACK_PUBLIC_KEY || window.__PAYSTACK_PUBLIC_KEY || '';
  }

  function loadPaystack() {
    return new Promise(function (resolve, reject) {
      if (window.PaystackPop) return resolve();
      var s = document.createElement('script');
      s.src = 'https://js.paystack.co/v1/inline.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function generateReference() {
    var rand = (window.crypto && window.crypto.randomUUID)
      ? window.crypto.randomUUID()
      : (Date.now().toString(36) + Math.random().toString(36).slice(2));
    return 'SC-DONATE-' + rand;
  }

  function setError(message) {
    var errorEl = document.getElementById('donate-error');
    if (!errorEl) return;
    if (message) {
      errorEl.textContent = message;
      errorEl.hidden = false;
    } else {
      errorEl.textContent = '';
      errorEl.hidden = true;
    }
  }

  function setLoading(isLoading) {
    var btn = document.getElementById('donate-submit');
    if (!btn) return;
    btn.disabled = isLoading;
    btn.classList.toggle('is-loading', isLoading);
    btn.dataset.originalText = btn.dataset.originalText || btn.innerHTML;
    btn.innerHTML = isLoading
      ? '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Processing…'
      : btn.dataset.originalText;
  }

  // ── Amount selection ────────────────────────────────────────────────────
  function selectPreset(btn) {
    var group = document.getElementById('donate-amount-group');
    if (!group) return;
    group.querySelectorAll('[data-amount]').forEach(function (b) {
      b.setAttribute('aria-pressed', 'false');
      b.classList.remove('selected');
    });
    btn.setAttribute('aria-pressed', 'true');
    btn.classList.add('selected');
    state.amount = parseInt(btn.getAttribute('data-amount'), 10);
    var customInput = document.getElementById('donate-custom-amount');
    if (customInput) customInput.value = '';
    setError('');
  }

  function selectCustom(value) {
    var group = document.getElementById('donate-amount-group');
    if (group) {
      group.querySelectorAll('[data-amount]').forEach(function (b) {
        b.setAttribute('aria-pressed', 'false');
        b.classList.remove('selected');
      });
    }
    var n = parseInt(value, 10);
    state.amount = Number.isFinite(n) ? n : null;
  }

  function validate(email) {
    if (!state.amount || !Number.isFinite(state.amount)) {
      return 'Please choose or enter an amount.';
    }
    if (state.amount < MIN_AMOUNT_KES) {
      return 'The minimum donation is ' + formatKES(MIN_AMOUNT_KES) + '.';
    }
    if (state.amount > MAX_AMOUNT_KES) {
      return 'Please enter an amount below ' + formatKES(MAX_AMOUNT_KES) + '.';
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return 'Please enter a valid email address for your receipt.';
    }
    return null;
  }

  // ── Checkout ────────────────────────────────────────────────────────────
  async function startCheckout(evt) {
    evt.preventDefault();
    setError('');

    var nameInput = document.getElementById('donate-name');
    var emailInput = document.getElementById('donate-email');
    var name = (nameInput && nameInput.value.trim()) || 'Anonymous supporter';
    var email = (emailInput && emailInput.value.trim()) || '';

    var validationError = validate(email);
    if (validationError) {
      setError(validationError);
      (emailInput && !email ? emailInput : document.getElementById('donate-custom-amount'))?.focus();
      return;
    }

    var publicKey = getPublicKey();
    if (!publicKey) {
      setError('Payment configuration is missing. Please try again later or contact support.');
      console.error('[Donate] No Paystack public key found (window.PAYSTACK_PUBLIC_KEY).');
      return;
    }

    setLoading(true);
    try {
      await loadPaystack();
    } catch (e) {
      setLoading(false);
      setError('Could not load the payment system. Please check your connection and try again.');
      return;
    }

    var reference = generateReference();
    var amountKobo = Math.round(state.amount * 100);

    var handler = window.PaystackPop.setup({
      key: publicKey,
      email: email,
      amount: amountKobo,
      currency: 'KES',
      ref: reference,
      label: 'SalaryCalculator.co.ke — Donation',
      metadata: {
        custom_fields: [
          { display_name: 'Donor name', variable_name: 'donor_name', value: name },
          { display_name: 'Product', variable_name: 'product', value: 'donation' }
        ]
      },
      callback: function (response) {
        setLoading(false);
        showSuccess(state.amount, response.reference || reference);
        logDonation(response.reference || reference, amountKobo, email, name);
      },
      onClose: function () {
        setLoading(false);
      }
    });

    handler.openIframe();
  }

  // Best-effort server-side log/verify — never blocks the success UI.
  // The endpoint is optional: if it 404s or the network fails, donors still
  // see their confirmation because Paystack itself already confirmed the charge.
  function logDonation(reference, amountKobo, email, name) {
    try {
      fetch('/api/paystack-donation-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: reference, amount_kobo: amountKobo, email: email, name: name })
      }).catch(function () { /* non-blocking */ });
    } catch (_) { /* non-blocking */ }
  }

  // ── Success UI ──────────────────────────────────────────────────────────
  function showSuccess(amount, reference) {
    var formSection = document.getElementById('donate-form-section');
    var successSection = document.getElementById('donate-success');
    if (formSection) formSection.hidden = true;
    if (successSection) {
      successSection.hidden = false;
      var amountEl = document.getElementById('donate-success-amount');
      var refEl = document.getElementById('donate-success-ref');
      if (amountEl) amountEl.textContent = formatKES(amount);
      if (refEl) refEl.textContent = reference;
      successSection.setAttribute('tabindex', '-1');
      successSection.focus();
      successSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function resetForm() {
    var formSection = document.getElementById('donate-form-section');
    var successSection = document.getElementById('donate-success');
    var form = document.getElementById('donate-form');
    if (form) form.reset();
    state.amount = null;
    var group = document.getElementById('donate-amount-group');
    if (group) group.querySelectorAll('[data-amount]').forEach(function (b) {
      b.setAttribute('aria-pressed', 'false');
      b.classList.remove('selected');
    });
    if (successSection) successSection.hidden = true;
    if (formSection) {
      formSection.hidden = false;
      formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // ── Optional payment-method cards (M-Pesa / bank) from config ───────────
  function renderPaymentMethodCards() {
    var cfg = window.__DONATION_CONFIG || {};
    var container = document.getElementById('donate-alt-methods');
    if (!container) return;

    var cards = [];

    if (cfg.mpesa && (cfg.mpesa.paybill || cfg.mpesa.till)) {
      var m = cfg.mpesa;
      cards.push(
        '<div class="donate-method-card">' +
          '<i class="fas fa-mobile-alt" aria-hidden="true"></i>' +
          '<h3>M-Pesa</h3>' +
          (m.paybill ? '<p><span>Paybill</span><strong>' + escapeHTML(m.paybill) + '</strong></p>' : '') +
          (m.account ? '<p><span>Account No.</span><strong>' + escapeHTML(m.account) + '</strong></p>' : '') +
          (m.till ? '<p><span>Till Number</span><strong>' + escapeHTML(m.till) + '</strong></p>' : '') +
        '</div>'
      );
    }

    if (cfg.bank && (cfg.bank.accountNumber || cfg.bank.bankName)) {
      var b = cfg.bank;
      cards.push(
        '<div class="donate-method-card">' +
          '<i class="fas fa-university" aria-hidden="true"></i>' +
          '<h3>Bank Transfer</h3>' +
          (b.bankName ? '<p><span>Bank</span><strong>' + escapeHTML(b.bankName) + '</strong></p>' : '') +
          (b.accountName ? '<p><span>Account Name</span><strong>' + escapeHTML(b.accountName) + '</strong></p>' : '') +
          (b.accountNumber ? '<p><span>Account No.</span><strong>' + escapeHTML(b.accountNumber) + '</strong></p>' : '') +
          (b.branch ? '<p><span>Branch</span><strong>' + escapeHTML(b.branch) + '</strong></p>' : '') +
        '</div>'
      );
    }

    if (cards.length) {
      container.innerHTML = cards.join('');
      container.hidden = false;
    } else {
      container.hidden = true;
    }
  }

  function escapeHTML(str) {
    var div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  // ── Wire-up ─────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    var form = document.getElementById('donate-form');
    if (!form) return; // Not on the donate page.

    renderPaymentMethodCards();

    var group = document.getElementById('donate-amount-group');
    if (group) {
      group.querySelectorAll('[data-amount]').forEach(function (btn) {
        btn.addEventListener('click', function () { selectPreset(btn); });
      });
    }

    var customInput = document.getElementById('donate-custom-amount');
    if (customInput) {
      customInput.addEventListener('input', function () {
        selectCustom(customInput.value);
      });
      customInput.addEventListener('focus', function () {
        if (group) group.querySelectorAll('[data-amount]').forEach(function (b) {
          b.setAttribute('aria-pressed', 'false');
          b.classList.remove('selected');
        });
      });
    }

    form.addEventListener('submit', startCheckout);

    var againBtn = document.getElementById('donate-again-btn');
    if (againBtn) againBtn.addEventListener('click', resetForm);
  });
})();
