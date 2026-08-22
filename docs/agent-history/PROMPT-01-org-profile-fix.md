# COPILOT PROMPT — 01: Organisation Profile Page Refinement
## File: `organisation-profile.html` + `js/organisation-profile.js` (or inline script)
---

## CONTEXT
`organisation-profile.html` lets Organisation account holders fill in their company details once.
These details auto-populate every payslip generated via `employees.html`.
There are three bugs + one UX deficiency to fix. Implement all four in one pass.

---

## BUG #1 — CRITICAL: Supabase `.catch is not a function`

### Problem
The save function currently calls `.catch()` directly on the Supabase query builder:

```js
// ❌ BROKEN — PostgrestFilterBuilder is thenable but has no .catch()
supabaseClient.from('org_profiles')
  .update(profileData)
  .eq('user_id', userId)
  .catch(err => showError(err.message));
```

Supabase JS v2 query builders are **thenable but not full Promises** — they lack `.catch()`.

### Fix
Replace **every** Supabase `.update(...).eq(...).catch(...)` and `.insert(...).catch(...)`
pattern in this file with `async/await` + `try/catch`:

```js
// ✅ CORRECT pattern for ALL Supabase writes in this file
async function saveOrgProfile() {
  try {
    showSaving(); // show loading state on button

    const { data: existing } = await supabaseClient
      .from('org_profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    let error;
    if (existing) {
      ({ error } = await supabaseClient
        .from('org_profiles')
        .update(profileData)
        .eq('user_id', userId));
    } else {
      ({ error } = await supabaseClient
        .from('org_profiles')
        .insert({ ...profileData, user_id: userId }));
    }

    if (error) throw error;
    showSuccess('✅ Organisation profile saved successfully!');
  } catch (err) {
    console.error('Save failed:', err);
    showError('❌ Failed to save profile. Please try again.');
    // DO NOT show the raw Supabase error object to the user
  } finally {
    hideSaving(); // restore button state
  }
}
```

Apply this same `await`/`try-catch` pattern consistently to **every** async Supabase call
in this file (load, save, logo upload to Storage if applicable).

---

## BUG #2 — REMOVE M-Pesa Paybill Number field

Delete the M-Pesa Paybill Number field entirely from the Banking & Payment Details section.
Kenyan payslips do not reference Paybill numbers; this field adds noise and confusion.

```html
<!-- DELETE this entire field group: -->
<div class="form-group">
  <label for="mpesa_paybill">M-Pesa Paybill Number</label>
  <input type="text" id="mpesa_paybill" ...>
</div>
```

Also remove its corresponding: JS read (`mpesa_paybill`), save, and load logic.
Remove from any Supabase upsert payload object.

---

## FEATURE #3 — Add Dropdown Selectors for Industry, County, Bank Name

Replace the plain `<input type="text">` for **Industry**, **County**, and **Bank Name**
with `<select>` dropdowns. Keep the existing `id` attributes so the rest of the JS
that reads these values continues to work unchanged.

### 3A — Industry Dropdown
```html
<select id="industry" name="industry">
  <option value="">— Select Industry —</option>
  <option value="Agriculture & Farming">Agriculture & Farming</option>
  <option value="Banking & Finance">Banking & Finance</option>
  <option value="Construction & Real Estate">Construction & Real Estate</option>
  <option value="Education">Education</option>
  <option value="Energy & Utilities">Energy & Utilities</option>
  <option value="Healthcare & Pharmaceuticals">Healthcare & Pharmaceuticals</option>
  <option value="Hospitality & Tourism">Hospitality & Tourism</option>
  <option value="Information Technology">Information Technology</option>
  <option value="Insurance">Insurance</option>
  <option value="Legal & Professional Services">Legal & Professional Services</option>
  <option value="Logistics & Transport">Logistics & Transport</option>
  <option value="Manufacturing">Manufacturing</option>
  <option value="Media & Entertainment">Media & Entertainment</option>
  <option value="Mining & Natural Resources">Mining & Natural Resources</option>
  <option value="NGO & Non-Profit">NGO & Non-Profit</option>
  <option value="Retail & Wholesale Trade">Retail & Wholesale Trade</option>
  <option value="Telecommunications">Telecommunications</option>
  <option value="Government & Public Sector">Government & Public Sector</option>
  <option value="Security & Investigation">Security & Investigation</option>
  <option value="Other">Other</option>
</select>
```

### 3B — County Dropdown (all 47 Kenya counties, alphabetical)
```html
<select id="county" name="county">
  <option value="">— Select County —</option>
  <option value="Baringo">Baringo</option>
  <option value="Bomet">Bomet</option>
  <option value="Bungoma">Bungoma</option>
  <option value="Busia">Busia</option>
  <option value="Elgeyo-Marakwet">Elgeyo-Marakwet</option>
  <option value="Embu">Embu</option>
  <option value="Garissa">Garissa</option>
  <option value="Homa Bay">Homa Bay</option>
  <option value="Isiolo">Isiolo</option>
  <option value="Kajiado">Kajiado</option>
  <option value="Kakamega">Kakamega</option>
  <option value="Kericho">Kericho</option>
  <option value="Kiambu">Kiambu</option>
  <option value="Kilifi">Kilifi</option>
  <option value="Kirinyaga">Kirinyaga</option>
  <option value="Kisii">Kisii</option>
  <option value="Kisumu">Kisumu</option>
  <option value="Kitui">Kitui</option>
  <option value="Kwale">Kwale</option>
  <option value="Laikipia">Laikipia</option>
  <option value="Lamu">Lamu</option>
  <option value="Machakos">Machakos</option>
  <option value="Makueni">Makueni</option>
  <option value="Mandera">Mandera</option>
  <option value="Marsabit">Marsabit</option>
  <option value="Meru">Meru</option>
  <option value="Migori">Migori</option>
  <option value="Mombasa">Mombasa</option>
  <option value="Murang'a">Murang'a</option>
  <option value="Nairobi">Nairobi</option>
  <option value="Nakuru">Nakuru</option>
  <option value="Nandi">Nandi</option>
  <option value="Narok">Narok</option>
  <option value="Nyamira">Nyamira</option>
  <option value="Nyandarua">Nyandarua</option>
  <option value="Nyeri">Nyeri</option>
  <option value="Samburu">Samburu</option>
  <option value="Siaya">Siaya</option>
  <option value="Taita-Taveta">Taita-Taveta</option>
  <option value="Tana River">Tana River</option>
  <option value="Tharaka-Nithi">Tharaka-Nithi</option>
  <option value="Trans Nzoia">Trans Nzoia</option>
  <option value="Turkana">Turkana</option>
  <option value="Uasin Gishu">Uasin Gishu</option>
  <option value="Vihiga">Vihiga</option>
  <option value="Wajir">Wajir</option>
  <option value="West Pokot">West Pokot</option>
</select>
```

### 3C — Bank Name Dropdown (major Kenyan commercial banks)
```html
<select id="bank_name" name="bank_name">
  <option value="">— Select Bank —</option>
  <option value="Absa Bank Kenya">Absa Bank Kenya</option>
  <option value="African Banking Corporation (ABC Bank)">African Banking Corporation (ABC Bank)</option>
  <option value="Bank of Africa Kenya">Bank of Africa Kenya</option>
  <option value="Bank of Baroda Kenya">Bank of Baroda Kenya</option>
  <option value="Bank of India Kenya">Bank of India Kenya</option>
  <option value="CBA Bank (NCBA)">CBA Bank (NCBA)</option>
  <option value="Citibank Kenya">Citibank Kenya</option>
  <option value="Co-operative Bank of Kenya">Co-operative Bank of Kenya</option>
  <option value="Consolidated Bank Kenya">Consolidated Bank Kenya</option>
  <option value="Credit Bank">Credit Bank</option>
  <option value="Diamond Trust Bank (DTB)">Diamond Trust Bank (DTB)</option>
  <option value="Ecobank Kenya">Ecobank Kenya</option>
  <option value="Equity Bank Kenya">Equity Bank Kenya</option>
  <option value="Family Bank Kenya">Family Bank Kenya</option>
  <option value="First Community Bank">First Community Bank</option>
  <option value="Gulf African Bank">Gulf African Bank</option>
  <option value="HFC Bank (HF Group)">HFC Bank (HF Group)</option>
  <option value="I&amp;M Bank Kenya">I&amp;M Bank Kenya</option>
  <option value="Kingdom Bank">Kingdom Bank</option>
  <option value="KCB Bank Kenya">KCB Bank Kenya</option>
  <option value="M-Oriental Bank">M-Oriental Bank</option>
  <option value="Mayfair CIB Bank">Mayfair CIB Bank</option>
  <option value="Middle East Bank Kenya">Middle East Bank Kenya</option>
  <option value="National Bank of Kenya (NBK)">National Bank of Kenya (NBK)</option>
  <option value="NCBA Bank Kenya">NCBA Bank Kenya</option>
  <option value="Paramount Bank">Paramount Bank</option>
  <option value="Prime Bank Kenya">Prime Bank Kenya</option>
  <option value="Postbank (Kenya Post Office Savings Bank)">Postbank</option>
  <option value="SBM Bank Kenya">SBM Bank Kenya</option>
  <option value="Sidian Bank">Sidian Bank</option>
  <option value="Spire Bank">Spire Bank</option>
  <option value="Stanbic Bank Kenya">Stanbic Bank Kenya</option>
  <option value="Standard Chartered Bank Kenya">Standard Chartered Bank Kenya</option>
  <option value="UBA Kenya">UBA Kenya</option>
  <option value="Victoria Commercial Bank">Victoria Commercial Bank</option>
</select>
```

### 3D — Bank Branch (keep as text input, add helpful placeholder)
```html
<!-- Branch: free-text is correct since branches are too numerous to enumerate -->
<input type="text" id="bank_branch" name="bank_branch"
       placeholder="e.g. Westlands, Moi Avenue, Karen">
```

---

## FEATURE #4 — Profile Completeness Progress Bar

The page already has a `Profile completeness 0%` bar. Wire it up properly:

```js
function updateCompleteness() {
  const fields = [
    'company_name', 'kra_pin', 'nssf_number', 'nhif_number',
    'business_type', 'industry', 'county', 'physical_address',
    'contact_email', 'contact_phone', 'bank_name', 'bank_account_number', 'bank_branch'
  ];
  const filled = fields.filter(id => {
    const el = document.getElementById(id);
    return el && el.value && el.value.trim() !== '' && el.value !== '— Select —';
  }).length;
  const pct = Math.round((filled / fields.length) * 100);
  document.getElementById('completeness-bar').style.width = pct + '%';
  document.getElementById('completeness-label').textContent = `Profile completeness ${pct}%`;
}

// Call on every input/change event:
document.querySelectorAll('input, select, textarea').forEach(el => {
  el.addEventListener('input', updateCompleteness);
  el.addEventListener('change', updateCompleteness);
});
```

---

## LOAD LOGIC — Populate dropdowns on page load

When loading saved profile data from Supabase, use `.value = savedValue` for
`<select>` elements — the same as for text inputs. No special handling needed.

```js
async function loadOrgProfile() {
  try {
    const { data, error } = await supabaseClient
      .from('org_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return; // no profile yet — form stays blank

    // Populate all fields:
    document.getElementById('company_name').value = data.company_name || '';
    document.getElementById('kra_pin').value = data.kra_pin || '';
    document.getElementById('nssf_number').value = data.nssf_number || '';
    document.getElementById('nhif_number').value = data.nhif_number || '';
    document.getElementById('registration_number').value = data.registration_number || '';
    document.getElementById('business_type').value = data.business_type || '';
    document.getElementById('industry').value = data.industry || '';   // <select>
    document.getElementById('county').value = data.county || '';       // <select>
    document.getElementById('physical_address').value = data.physical_address || '';
    document.getElementById('contact_email').value = data.contact_email || '';
    document.getElementById('contact_phone').value = data.contact_phone || '';
    document.getElementById('website').value = data.website || '';
    document.getElementById('payroll_day').value = data.payroll_day || '';
    document.getElementById('bank_name').value = data.bank_name || ''; // <select>
    document.getElementById('bank_account_number').value = data.bank_account_number || '';
    document.getElementById('bank_branch').value = data.bank_branch || '';
    // NOTE: mpesa_paybill is REMOVED — do not load it

    updateCompleteness();
  } catch (err) {
    console.error('Load failed:', err);
  }
}
```

---

## SUMMARY OF CHANGES
| # | Change | File(s) |
|---|--------|---------|
| 1 | Fix Supabase `.catch` → `await`/`try-catch` everywhere | `organisation-profile.html` / JS |
| 2 | Remove M-Pesa Paybill field (HTML + JS) | `organisation-profile.html` / JS |
| 3 | Industry → `<select>` with 20 options | `organisation-profile.html` |
| 4 | County → `<select>` with all 47 counties | `organisation-profile.html` |
| 5 | Bank Name → `<select>` with 35 Kenyan banks | `organisation-profile.html` |
| 6 | Bank Branch → stays `<input text>`, add placeholder | `organisation-profile.html` |
| 7 | Wire up profile completeness % bar | `organisation-profile.html` / JS |
