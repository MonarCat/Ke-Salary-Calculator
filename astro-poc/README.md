# Astro proof-of-concept (Phase 0)

Isolated evaluation of Astro as the framework for the Salary Calculator 2.0
redesign (see `/PROMPT-05-site-hygiene-nav-seo-overhaul.md` and the 2.0 UI/UX
spec). This directory is intentionally **not wired into the root
`vercel.json`** and is not linked from any production page.

## What this proves

- `src/styles/tokens.css` — Section 28 design tokens, framework-agnostic.
- `src/layouts/BaseLayout.astro` + `Header.astro` / `Footer.astro` — a single
  shared shell to replace the header/footer markup duplicated across ~76
  static HTML pages.
- `src/components/Accordion.astro` — a reusable, zero-client-JS component
  (native `<details>`/`<summary>`) as an example of the `ui/` component tier
  in Section 21.
- `src/pages/faq.astro` — the existing `faq.html` content (Q&A pulled from
  its live FAQPage JSON-LD) rebuilt through the shared layout, to confirm the
  migration pattern end to end on a page with no billing or calculation
  logic.

## What this does NOT do

- Does not touch the calculator, payslip, P9A, or any billing-adjacent code
  (`premium.js`, `account-billing.js`, `plan-features.js`, Paystack handlers).
- Does not change `vercel.json`, `buildCommand`, or `outputDirectory` for the
  main site. The root site continues to deploy exactly as before.
- Not indexed (`robots: noindex, nofollow`) and not linked from production
  navigation.
- Does not decide the font-loading strategy (Inter currently falls back to
  `system-ui`) — that's deferred to the CSP/HSTS session.

## Running locally

```bash
cd astro-poc
npm install
npm run dev      # http://localhost:4321
npm run build    # outputs to astro-poc/dist, not the repo root
```

## Next step if this looks right

Point a **separate** Vercel project at this subdirectory (root directory =
`astro-poc`, build command = `npm run build`, output = `dist`) to get a real
preview URL without touching the existing `salarycalculator.co.ke` Vercel
project at all. Once that preview is verified (Lighthouse/SEO parity), we
can plan Phase 1 migration of a real low-traffic content page into the main
deploy.
