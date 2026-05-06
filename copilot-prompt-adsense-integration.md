# Copilot Prompt — Google AdSense Integration & Policy Compliance
# salarycalculator.co.ke

**Repo:** `MonarCat/Ke-Salary-Calculator`  
**Stack:** Static HTML/CSS/JS on Vercel  
**AdSense Publisher ID:** `pub-6832553346534070`  
**Date:** May 2026

> Monetag has been fully removed from the site. This prompt handles AdSense integration from scratch with full policy compliance.

---

## STEP 1 — Create `ads.txt` (MANDATORY — Do First)

The ads.txt file must be placed at the root of the domain and formatted correctly for the publisher ID to be verified.

Create file: `/ads.txt` in the project root (served at `https://salarycalculator.co.ke/ads.txt`)

```
# Authorized Digital Sellers — salarycalculator.co.ke
google.com, pub-6832553346534070, DIRECT, f08c47fec0942fa0
```

Only include the pub- prefix and the 16-digit numeric code in the declaration — delete any product-specific prefix. The hash `f08c47fec0942fa0` is Google's official certification authority ID — do not change it.

Verify it works: visit `https://salarycalculator.co.ke/ads.txt` in browser — you should see the two lines above.

---

## STEP 2 — Add AdSense Script to All HTML Pages

Add the following script to the `<head>` of **every `.html` file** in the repo. It must be present on all monetized pages for AdSense to serve ads and for Google's crawler to verify the site:

```html
<head>
  <!-- Google AdSense -->
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6832553346534070"
       crossorigin="anonymous"></script>
  <!-- rest of head -->
```

### Pages to update:
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
- `about-us.html`
- `blog.html`
- `salary-news.html`
- `contact-us.html`
- `external-links.html`
- `privacy-policy.html`
- `terms-of-service.html`
- `cookie-policy.html`
- All salary breakdown pages (`30000.html`, `50000.html`, `100000.html` etc.)
- All job salary pages under `/salary/`

### Pages where AdSense script must NOT be added:
- `reset-password.html` — security-sensitive, no ads
- `auth.html` — AdSense code may not be placed on any non-content-based page, and login/signup pages don't qualify as content pages

---

## STEP 3 — Premium Users: Suppress Ads

Users with `premium = true` in their Supabase profile should see zero ads. This is a selling point of premium. On all pages that already have the Supabase session check JS, replace the static `<script>` AdSense tag with a dynamic loader:

```html
<!-- Remove the static AdSense <script> tag on these pages -->
<!-- Add this instead, AFTER the supabase client is initialised: -->
<script>
  (async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('premium')
        .eq('id', session.user.id)
        .single();
      if (profile?.premium === true) return; // Ad-free for premium users
    }
    // Load AdSense for free users
    const s = document.createElement('script');
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6832553346534070';
    s.async = true;
    s.crossOrigin = 'anonymous';
    document.head.appendChild(s);
  })();
</script>
```

Use the dynamic loader on: `calculator.html`, `payslip-generator-kenya.html`, `employees.html`, `salary-guess-game.html`, `salary-comparison.html`, and any other page that already initialises the Supabase client.

Use the static `<script>` tag on purely public/no-auth pages: `index.html`, `about-us.html`, blog pages, salary breakdown pages, etc.

---

## STEP 4 — Ad Unit Placement (Strategic, Policy-Compliant)

### Ad Unit HTML Snippet

```html
<!-- Google AdSense Ad Unit -->
<ins class="adsbygoogle"
     style="display:block"
     data-ad-client="ca-pub-6832553346534070"
     data-ad-slot="AUTO"
     data-ad-format="auto"
     data-full-width-responsive="true"></ins>
<script>
  (adsbygoogle = window.adsbygoogle || []).push({});
</script>
```

> **Note:** Replace `data-ad-slot="AUTO"` with the actual slot ID from your AdSense dashboard once you create ad units there (Ads → By ad unit → Create new ad unit).

### Where to place ad units — by page:

**`index.html` (Homepage)**
- After the Quick Salary Check result section, before the "Your Salary Toolkit" section
- After the Poll section, before the footer
- Max: 2 units

**`blog.html` / `salary-news.html`**
- After the first article card in the list
- After every 3rd article card
- Max: 3 units

**`salary-index.html`**
- After the main salary table, before the job search section
- Max: 1 unit

**`about-us.html` / `external-links.html` / `contact-us.html`**
- One unit anywhere in the page body
- Max: 1 unit each

**`privacy-policy.html` / `terms-of-service.html` / `cookie-policy.html`**
- One unit below the page title, above the content body
- Max: 1 unit each

**Salary breakdown pages (`30000.html`, `50000.html` etc.)**
- After the main PAYE breakdown table
- Before the FAQ / related salaries section
- Max: 2 units

**Job salary pages (`/salary/*.html`)**
- After the salary breakdown section
- Before the related jobs list
- Max: 1-2 units

**`salary-guess-game.html`**
- After the result is revealed, before the "Play Again" button area
- Must not appear during active gameplay — only at the result/pause stage
- Max: 1 unit

**`salary-comparison.html` / `salary-raise-calculator.html`**
- Below the results section only — never inside or above the form
- Max: 1 unit each

### Where ads are strictly FORBIDDEN (policy + UX):
- Inside any modal or dialog box
- Inside or overlapping the calculator/payslip input form
- Between a form label and its input field
- Inside the payslip preview / print view
- Overlapping the mobile bottom navigation bar
- `auth.html`, `reset-password.html` — no ad units at all

---

## STEP 5 — Policy Compliance Fixes

### 5A — Ad Labels (Required by Policy)

Ads may be labelled "Sponsored Links" or "Advertisements" but not "Favorite Sites" or "Today's Top Offers".

Above every ad unit container, add a label:
```html
<p class="ad-label">Advertisement</p>
<ins class="adsbygoogle" ...></ins>
```

Style the label:
```css
.ad-label {
  font-size: 11px;
  color: #888;
  text-align: center;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
```

### 5B — No Clickbait / No Prompting Clicks

Publishers may not encourage users to click the Google ads using phrases such as "click the ads", "support us", "visit these links" or other similar language, and may not direct user attention to ads using arrows or other graphical gimmicks.

Audit the entire site for any such language and remove it. This includes footer text like "Support us by visiting our sponsors" or similar.

### 5C — Mobile Nav Clearance

AdSense sometimes serves sticky bottom banner ads. Ensure they never cover the mobile bottom navigation:

```css
/* In main stylesheet */
@media (max-width: 768px) {
  ins.adsbygoogle[data-ad-format="auto"] {
    margin-bottom: env(safe-area-inset-bottom, 0);
  }
}
```

Additionally, the site must not have pop-ups or pop-unders. Sites may not change user preferences, redirect users to unwanted websites, initiate downloads, include malware or contain pop-ups or pop-unders that interfere with site navigation. Audit and remove any such behaviour.

### 5D — Update Privacy Policy (REQUIRED by AdSense)

AdSense publishers must have and abide by a privacy policy that discloses that third parties may be placing and reading cookies on your users' browsers, or using web beacons to collect information as a result of ad serving on your website.

In `privacy-policy.html`, find the Advertising / Third Party section (or add one) and include the following:

```
Third-Party Advertising
We use Google AdSense to display advertisements on this site. Google AdSense uses cookies 
and web beacons to serve ads based on a user's prior visits to this and other websites. 
Google's use of advertising cookies enables it and its partners to serve ads to users 
based on their visit to our site and/or other sites on the internet. 

Users may opt out of personalised advertising by visiting Google's Ad Settings at 
https://adssettings.google.com or by visiting www.aboutads.info.

For more information on how Google uses data when you use our site, visit:
https://policies.google.com/technologies/partner-sites
```

### 5E — Cookie Consent Banner

AdSense sets cookies including the DoubleClick cookie. The site needs a cookie consent notice, especially for users from GDPR regions (EU visitors are common even on Kenyan sites). Add a lightweight cookie consent banner to `index.html` and all major pages:

```html
<!-- Cookie Consent Banner -->
<div id="cookie-consent" style="display:none; position:fixed; bottom:0; left:0; right:0; 
     background:#1a1a2e; color:#fff; padding:14px 20px; z-index:9999; 
     display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
  <p style="margin:0; font-size:13px;">
    We use cookies including from Google AdSense to improve your experience and serve relevant ads. 
    <a href="/privacy-policy.html" style="color:#4CAF50;">Learn more</a>
  </p>
  <button id="cookie-accept" style="background:#4CAF50; color:#fff; border:none; 
          padding:8px 18px; border-radius:4px; cursor:pointer; font-size:13px;">
    Accept
  </button>
</div>

<script>
  // Show banner if not yet accepted
  if (!localStorage.getItem('cookiesAccepted')) {
    document.getElementById('cookie-consent').style.display = 'flex';
  }
  document.getElementById('cookie-accept')?.addEventListener('click', () => {
    localStorage.setItem('cookiesAccepted', 'true');
    document.getElementById('cookie-consent').style.display = 'none';
  });
</script>
```

### 5F — `ads.txt` Vercel Configuration

Ensure Vercel serves `ads.txt` as `text/plain`. In `vercel.json`, add:

```json
{
  "headers": [
    {
      "source": "/ads.txt",
      "headers": [
        { "key": "Content-Type", "value": "text/plain" },
        { "key": "Cache-Control", "value": "public, max-age=86400" }
      ]
    }
  ]
}
```

---

## STEP 6 — Content Audit Checklist

Before AdSense can fully approve the site, ensure all pages pass these checks:

- [ ] All pages have a clear navigation menu (Home, About, Contact minimum)
- [ ] No broken links (`404` errors) anywhere on the site
- [ ] Site loads over HTTPS — verify `https://salarycalculator.co.ke` has valid SSL
- [ ] Privacy Policy page is linked in the footer of every page
- [ ] Terms of Service page is linked in the footer of every page
- [ ] Contact page is accessible and has a working contact method
- [ ] No placeholder/lorem ipsum content on any page
- [ ] Blog/news pages have real, original content (not scraped/copied)
- [ ] All salary breakdown pages have meaningful explanatory text beyond just numbers
- [ ] No pages exist with only a form and no surrounding content
- [ ] `sitemap.xml` exists at root and submitted to Google Search Console
- [ ] `robots.txt` exists and does not block Googlebot

If `sitemap.xml` or `robots.txt` are missing, create them:

**`robots.txt`:**
```
User-agent: *
Allow: /
Sitemap: https://salarycalculator.co.ke/sitemap.xml
```

---

## STEP 7 — After Deployment: Verify in AdSense Dashboard

After pushing all changes to Vercel:

1. Go to **AdSense → Sites** and confirm `salarycalculator.co.ke` status changes from "Getting ready" to "Ready"
2. Check **ads.txt status** is shown as "Authorized" (not "Not found")
3. Create actual ad units in **Ads → By ad unit → Create new ad unit → Display ads** — copy the slot IDs and replace `data-ad-slot="AUTO"` placeholders in the code
4. Use **AdSense Auto Ads** as an alternative — enable it in **Ads → Overview → Auto ads** for Google to automatically find the best placements
5. Monitor **Policy Centre** tab for any violations flagged by Google's crawler

---

## Summary of Files to Create/Modify

| File | Action |
|------|--------|
| `/ads.txt` | **CREATE** — with Google pub ID |
| `vercel.json` | **UPDATE** — add Content-Type header for ads.txt |
| `robots.txt` | **CREATE if missing** |
| `sitemap.xml` | **CREATE if missing** |
| All `.html` pages (except auth/reset) | **UPDATE** — add AdSense `<script>` in `<head>` |
| Pages with Supabase session | **UPDATE** — use dynamic ad loader to skip premium users |
| Strategic content pages | **UPDATE** — add `<ins class="adsbygoogle">` ad unit slots |
| `privacy-policy.html` | **UPDATE** — add Google AdSense / cookie disclosure section |
| All pages | **UPDATE** — add cookie consent banner (can be a shared include/snippet) |
| All pages with ad units | **UPDATE** — add "Advertisement" label above each unit |

---

*Publisher ID: `pub-6832553346534070` | AdSense script host: `pagead2.googlesyndication.com`*
*Do NOT click your own ads. Do NOT ask users to click ads. Both are immediate ban reasons.*
