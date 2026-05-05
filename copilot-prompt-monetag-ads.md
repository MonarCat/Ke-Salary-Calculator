# Copilot Prompt — Monetag Ad Integration (salarycalculator.co.ke)

**Project:** Kenya Salary Calculator (`salarycalculator.co.ke`)  
**Repo:** `MonarCat/Ke-Salary-Calculator`  
**Stack:** Static HTML/CSS/JS on Vercel  
**Task:** Integrate Monetag Multitag/Immortal ad format site-wide at strategic, non-intrusive positions

---

## What Monetag Requires

### Step 1 — JS file in root
A file called `tag.min.js` has already been uploaded to the root folder of the website. No action needed here.

### Step 2 — Script tag in every HTML page
Add the following script immediately after the opening `<head>` tag in **every `.html` file** across the site:

```html
<head>
<script src="https://quge5.com/88/tag.min.js" data-zone="219979" async data-cfasync="false"></script>
<!-- rest of head content -->
```

This one tag activates Monetag's Immortal/Multitag format globally. It handles ad selection and delivery automatically.

---

## Pages to Update

Add the script tag to **all** of the following HTML files (and any others in the repo):

- `index.html`
- `calculator.html`
- `paye-calculator-kenya.html`
- `statutory-deductions-kenya.html`
- `payslip-generator-kenya.html`
- `salary-after-tax.html`
- `global-salary-calculator.html`
- `salary-raise-calculator.html`
- `salary-comparison.html`
- `salary-index.html`
- `salary-guess-game.html`
- `employees.html`
- `auth.html`
- `about-us.html`
- `blog.html`
- `salary-news.html`
- `contact-us.html`
- `external-links.html`
- `privacy-policy.html`
- `terms-of-service.html`
- `cookie-policy.html`
- `reset-password.html`
- Any salary breakdown pages (`30000.html`, `50000.html`, `100000.html`, etc.)
- Any job salary pages under `/salary/`

---

## Strategic Placement Rules

Monetag's Immortal tag auto-manages its display formats. However, to protect usability on key functional pages, apply the following rules:

### 🔴 Pages where ads must NOT interrupt workflow

On these pages, add the script tag (required) but add a `<meta>` hint and ensure no ad container sits inside or adjacent to interactive form elements:

- `calculator.html` — The salary input, result breakdown, and payslip preview areas must remain clear. No ad containers near the calculation form.
- `payslip-generator-kenya.html` — No ads within the payslip preview or inside the generation form.
- `auth.html` — No ads inside the sign-in or sign-up form cards. Monetag tag still goes in `<head>`.
- `employees.html` — No ads inside the employee table or management panel.
- `reset-password.html` — No ads at all on this page (security-sensitive). Still add the script tag but add `data-zone` as a no-display hint — or simply omit the script on this page alone.

### 🟡 Pages ideal for strong ad presence

These are content/browse pages where users are reading — ads fit naturally:

- `index.html` — After the Quick Salary Check section, before the "Your Salary Toolkit" section. Also after the Poll section.
- `blog.html` / `salary-news.html` — Between article cards or after the first article in a list.
- `salary-index.html` — Between the salary table and the job salary explorer section.
- `about-us.html`, `external-links.html` — Any position in the page body.
- Salary breakdown pages (`30000.html`, `50000.html`, etc.) — After the main breakdown table, before the FAQ or footer.
- Job salary pages (`/salary/*.html`) — After the salary breakdown, before related jobs section.
- `salary-guess-game.html` — Between game rounds (after result reveal, before next round starts).
- `salary-comparison.html`, `salary-raise-calculator.html` — Below the results section.

### 🟢 Safe ad container positions (HTML snippet)

Where you want to define an explicit ad slot (optional — Monetag auto-places, but you can also hint positions):

```html
<!-- Monetag Ad Slot -->
<div class="ad-container" style="text-align:center; margin: 24px 0; min-height: 90px;" aria-label="Advertisement">
</div>
```

Use this container sparingly — once per page section maximum. Do not place between form labels and inputs, inside modal dialogs, or overlapping the mobile bottom navigation bar.

---

## Usability Protection Rules (Non-Negotiable)

1. **No ads inside modals** — Any modal/dialog (payslip preview, employee detail, etc.) must not contain ad slots.
2. **No ads that shift layout during calculation** — If the page renders a result dynamically, ensure no ad container sits directly above or below it in a way that causes layout shift when the ad loads.
3. **Mobile nav clearance** — The site has a bottom mobile nav bar. Ensure no sticky/fixed ad format covers it. If Monetag renders a sticky bottom banner, add CSS to push it above the nav:
   ```css
   /* Prevent Monetag sticky banner from covering mobile nav */
   @media (max-width: 768px) {
     [id*="monetag"], [class*="monetag"], iframe[src*="quge5.com"] {
       bottom: 60px !important; /* adjust to match nav bar height */
     }
   }
   ```
4. **Premium users — suppress ads** — If a user is logged in and `premium = true` on their profile, suppress Monetag display using:
   ```js
   // After auth session check, if user is premium:
   if (userProfile?.premium === true) {
     // Prevent Monetag from rendering (set before script loads or disable zone)
     window.__monetag_disabled = true;
   }
   ```
   Note: Full ad suppression for premium users may require wrapping the script tag conditionally — load the Monetag script only if the user is NOT premium:
   ```html
   <!-- In each page's init JS, after session check: -->
   <script>
     (async () => {
       // Wait for Supabase session
       const { data: { session } } = await supabase.auth.getSession();
       if (session) {
         const { data: profile } = await supabase
           .from('user_profiles')
           .select('premium')
           .eq('id', session.user.id)
           .single();
         if (profile?.premium) return; // Premium user — skip ad load
       }
       // Load Monetag for non-premium users
       const s = document.createElement('script');
       s.src = 'https://quge5.com/88/tag.min.js';
       s.setAttribute('data-zone', '219979');
       s.async = true;
       s.setAttribute('data-cfasync', 'false');
       document.head.appendChild(s);
     })();
   </script>
   ```
   This approach also means you can remove the static `<head>` script tag and replace it with this dynamic loader on pages that have Supabase session access. On purely static/no-auth pages (`about-us.html`, `external-links.html`, etc.) the static tag is fine.

---

## Summary Checklist for Copilot

- [ ] Add Monetag script tag after `<head>` in all HTML files
- [ ] On functional pages (calculator, payslip, auth, employees): static script tag in head only — no ad containers in the form areas
- [ ] On content pages: add one `div.ad-container` at strategic positions per page (see above)
- [ ] Add mobile nav clearance CSS globally (in main stylesheet or `<style>` in each page)
- [ ] Replace static script tag with dynamic loader on pages that already have Supabase session JS — skip loading for `premium = true` users
- [ ] Do NOT add the script at all on `reset-password.html`

---

*Monetag zone ID: `219979` | Script host: `quge5.com/88/tag.min.js`*
