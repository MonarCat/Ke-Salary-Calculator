# salarycalculator.co.ke — Site Hygiene, Navigation & SEO Overhaul
## Copilot Implementation Package — Follow README-implementation.md conventions

---

## 🔒 PROTECTED FILES — DO NOT MODIFY IN ANY SESSION BELOW UNLESS THE SESSION EXPLICITLY SAYS SO

These files implement authenticated payment processing (Paystack) and must not be
touched, renamed, reformatted, or refactored "in passing" while doing nav/UI/SEO work.
If a change genuinely requires editing one of these, stop and open a dedicated,
separately-reviewed session for it — never bundle it with hygiene/UI work.

```
api/paystack-intent.js
api/paystack-verify.js
api/paystack-webhook.js
api/paystack-donation-verify.js
assets/js/premium.js
assets/js/account-billing.js
assets/js/donate.js
assets/js/plan-features.js
supabase/migrations/**            (any file already merged to main)
vercel.json  → the "rewrites" array specifically (headers array may be extended, see Session 4)
```

Rule for every session in this package: after any change, confirm these files are
byte-identical to `main` via `git diff --stat` before opening a PR. If any of them
appear in the diff and the session didn't call for it, revert that hunk.

---

## PRE-FLIGHT — Run before Session 1, blocks all premium-related work

This is a database/ops check, not a code change. Do this first because
`PREMIUM_ROOT_CAUSE_REPORT.md` documents a real prior incident where premium
purchases silently failed for days because migrations existed in git but were never
applied to the production Supabase project.

1. Connect to the **production** Supabase project (not local/staging) via SQL Editor
   or CLI and confirm these exist:
   ```sql
   select to_regclass('public.payment_intents');
   select to_regclass('public.payments');
   select to_regclass('public.donations');
   select proname from pg_proc where proname = 'process_verified_paystack_payment';
   ```
2. If any return `null`/empty, apply `supabase/migrations/024_secure_paystack_payment_processing.sql`
   then `025_donations.sql` then `026_ad_rotation.sql`, **in that exact order**, and
   re-run the probes above.
3. Run one real Paystack test-mode transaction end-to-end (intent → Paystack Inline →
   verify → webhook → `user_profiles.premium = true`) and confirm it before starting
   Session 1. Do not proceed on hygiene/UI work with an unverified billing path — if
   it's currently broken, fixing it is priority zero, above everything in this file.

Do not skip this step even if the site "looks fine" — the last incident was invisible
in the UI until a user reported a charged card with no premium access.

---

## Session 1 — Repo hygiene (no functional risk, do first)

**Goal:** remove dead weight and duplication that makes every future change
(human or agent) more error-prone.

1. Delete `claude-update/Ke-Salary-Calculator-main/` entirely — it is a full 18MB
   duplicate of the live site (duplicate HTML, `/src`, `/database`, `/supabase`).
   Confirm with `diff -rq . claude-update/Ke-Salary-Calculator-main --exclude=.git`
   that nothing in the duplicate is *newer* or *different* from the real tree before
   deleting; if it is, that content needs manual review, not silent deletion.
2. Delete `Ke-Salary-Calculator-donation-update.zip` from the repo (13MB binary, no
   reason to be version-controlled).
3. Create `/docs/agent-history/` and move these root-level files into it:
   ```
   COPILOT_EASTER_PREMIUM_V1.md
   COPILOT_FIX_PREMIUM_STATUS_V1.md
   COPILOT_PAYSLIP_SAVE_P9A_FIX.md
   COPILOT_PLATFORM_EXPANSION_V1.md
   MERGE_REPORT.md
   PREMIUM_ROOT_CAUSE_REPORT.md
   PROMPT-01-org-profile-fix.md
   PROMPT-02-payslip-standard.md
   PROMPT-03-nav-and-plans.md
   PROMPT-04-p9a-refinement.md
   PROMPT_replace-hcaptcha-with-turnstile.md
   SC-ADMIN-COPILOT-PROMPT.md
   SC-ADMIN-OVERHAUL-COPILOT.md
   "Sc email center super prompt.md"
   copilot-prompt-adsense-integration.md
   copilot-prompt-monetag-ads.md
   copilot-prompt-salarycalc-fixes.md
   ```
   Keep `README.md` and `README-implementation.md` at root. Add a one-line index at
   the top of `/docs/agent-history/README.md` listing what each file was for.
4. Add `.gitattributes` or a pre-commit hook (simple `git diff --cached --stat`
   size check is enough) to block any future file over 2MB from being committed
   without `git lfs` — this is what let the zip and the duplicate directory happen.

**Test:** site builds/deploys identically (this session touches zero files that are
served or referenced by any page — verify with `grep -r "claude-update" . --include=*.html --include=*.js` returning nothing).

---

## Session 2 — Shared navigation partial (fixes the root cause of nav drift)

**Problem:** all 76 HTML pages hand-duplicate `<header>`/`<nav>`/`<footer>` markup.
68 of them independently contain "Payslip Generator" in nav — meaning any nav edit
today requires manually touching ~68 files, which is exactly why homepage and
calculator.html nav had already diverged (Premium links present on one, absent on
the other).

**Approach (pick the lower-risk option since there's no build step currently):**
Runtime-injected partial via a single new script, not a build-time templating
system — avoids introducing a build pipeline into a project that currently has none.

1. Create `assets/js/nav-partial.js` that:
   - Defines the canonical header/nav HTML and footer HTML as template strings
     (one definition, matching the fullest/most current version — homepage's nav
     plus calculator.html's Premium items: Payroll Import, P9A Generator).
   - Injects into `<div id="site-header"></div>` / `<div id="site-footer"></div>`
     placeholders on `DOMContentLoaded`, **before** `nav-toggle.js`'s dark-mode and
     dropdown logic runs (load order matters — script tag order in each page must
     put `nav-partial.js` before `nav-toggle.js`).
   - Marks the current page's nav link with an `aria-current="page"` / active class
     based on `location.pathname`.
2. Across all 76 HTML files, replace the literal `<header>...</header>` and
   `<footer>...</footer>` blocks with the two placeholder divs, and add the
   `<script src="/assets/js/nav-partial.js">` tag immediately before the existing
   `nav-toggle.js` tag. Do this with a scripted find/replace, not by hand, and diff
   every file afterward — do not touch any `<script>` tag related to Supabase, auth,
   premium, or Paystack while doing this pass.
3. One dated tax-year badge: fix the "FY 2025/2026" vs "Last updated: February 2025"
   vs "2025" inconsistency by having `nav-partial.js` render a single
   `TAX_YEAR_LABEL` constant (defined once) into the header, and remove hardcoded
   date strings from individual page `<head>`/hero copy where they duplicate it.

**Test after this session (regression-critical):**
- Load `calculator.html`, click "Sign In to Use the Payslip Generator" → confirm it
  still routes to `auth.html?redirect=...` correctly (nav injection must not shift
  or break any `<a>` outside the header/footer).
- Load `account.html` and `profile.html` (billing-adjacent pages) and confirm the
  Paystack/premium widgets still render — these pages must be visually diffed
  before/after, not just nav-checked, since account-billing.js reads DOM elements
  that must not move.
- Run Lighthouse or manual check: no console errors from script load-order changes.

---

## Session 3 — SEO: orphan pages + robots.txt cleanup

No JS logic touched — pure content/linking changes.

1. In `salary-index.html`, add links to all 28 salary-figure pages (`25000.html`
   through `300000.html`); currently only 10 are linked. Group into a responsive
   grid/table sorted ascending.
2. Add `BreadcrumbList` JSON-LD to `/salary/*.html` and the numeric salary pages.
3. Add `FAQPage` JSON-LD to `faq.html` (content already exists as Q&A pairs on that
   page — wrap the existing content in schema, don't rewrite the copy).
4. Add `WebApplication` JSON-LD to `calculator.html`.
5. Clean `robots.txt`: remove the stale "update with actual URL when available"
   comment since `Sitemap:` is already correctly set below it.
6. Audit `calculator.html` vs `paye-calculator-kenya.html` vs `salary-after-tax.html`
   vs `statutory-deductions-kenya.html` for duplicate body copy; where duplicate,
   keep `calculator.html` as canonical (it's the fullest tool) and rewrite the
   others' intro copy to be genuinely differentiated (different angle: PAYE-only
   deep-dive, after-tax comparison framing, deductions reference respectively)
   rather than `rel=canonical`-ing them away, since they currently rank for
   different long-tail terms.

**Test:** `python -m http.server` locally, validate all new JSON-LD blocks with
Google's Rich Results Test, confirm no page lost its existing internal links.

---

## Session 4 — Security headers (CSP/HSTS), staging-gated

This is the one session in this package with real blast-radius risk to the Paystack
checkout flow if done carelessly — a misconfigured CSP silently blocks the Paystack
Inline script or its popup/iframe, which fails checkout with no visible error to a
casual tester.

1. In `vercel.json`, extend the existing `headers` array (do not touch `rewrites`)
   to add on the `/(.*)\\.html` block:
   ```json
   { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" }
   ```
2. Add a `Content-Security-Policy` header, but build the allowlist from an actual
   inventory of every external origin currently loaded — grep every `<script src=`,
   `<link href=`, `fetch(`, and inline `<iframe>` src across the HTML/JS for:
   Paystack (`js.paystack.co`, `checkout.paystack.com` and any api subdomain used by
   Inline JS), Supabase project URL, Google AdSense/AdsBank domains already declared
   in `ads.txt`, the chatbot widget's origin, and any CDN (`cdnjs.cloudflare.com` if
   `html2pdf.js` or similar is loaded from there per `README-implementation.md`).
   Do not write this allowlist from memory — enumerate it from the codebase.
3. Deploy to a **Vercel preview/staging deployment first**, never directly to
   production. Paystack test-mode transaction must complete successfully on staging
   with the new CSP active before promoting to production.
4. If the CSP breaks anything, prefer loosening the specific directive (e.g. adding
   a missing `frame-src`) over removing CSP — do not ship a broken CSP as
   `Content-Security-Policy-Report-Only` and call it done; report-only mode doesn't
   protect anything.

**Test:** full purchase flow (intent → Inline widget opens → test card → verify →
webhook → premium unlocked) on the staging deployment, plus check browser console
for any CSP violation warnings on every major page template (home, calculator,
account, admin).

---

## Session 5 — Calculator UI polish (empty states, CTA de-duplication)

No billing code touched; scoped to result-table rendering and homepage CTA copy.

1. On `calculator.html` and homepage's Quick Salary Check, replace blank-dash result
   cells with a neutral placeholder state ("Enter your gross salary to see your
   breakdown") shown before first calculation, and a lightweight loading state
   during calculation (even if calculation is instant client-side, a 150–300ms
   perceived-loading skeleton reads as more trustworthy for a financial result than
   an instant table snap).
2. Vary the repeated "Sign In / Sign Up Free" CTA copy by context (e.g. "Unlock the
   payslip generator" near the payslip tab, "Compare two offers" near the comparison
   tab) instead of five identical buttons — copy-only change, same href/handler.
3. Fix dead `href="#"` share links (poll share buttons, "Share via WhatsApp/X" on
   calculator results) — wire to `navigator.share()` with a `mailto:`/URL-scheme
   fallback, or remove the buttons if not being implemented this session. Do not
   ship non-functional buttons.

**Test:** manual click-through of every CTA and share button on homepage and
calculator.html; confirm none of the DOM elements touched are IDs/classes that
`assets/js/premium.js` or `assets/js/account-billing.js` query (grep those two files
for any selector matching elements you're editing before editing).

---

## Global rules for every session (matches existing repo convention)

- Supabase calls: always `await` + `try/catch`, never bare `.catch()` — per
  `README-implementation.md`'s existing pattern.
- Any new premium-gated UI element must check access via the existing
  `PLAN_FEATURES`/`canAccess()` pattern in `assets/js/plan-features.js` — do not
  invent a second gating mechanism.
- KES formatting: reuse the existing `en-KE` `toLocaleString` helper, don't
  reintroduce a second formatter.
- After every session, run `git diff --stat` against the protected-files list at
  the top of this document before opening a PR. Any unintended touch to a protected
  file is a blocker, not a note in the PR description.
- One session = one PR = one focused test pass. Do not combine Session 4 (CSP) with
  any other session in the same PR — it's the only one that needs staging
  verification against real payment flow before merge.
