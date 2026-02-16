# Google AdSense Site Verification - Setup Instructions

This document explains the changes made to help Google AdSense verify your site and what you need to do next.

## Changes Made

### 1. Created `ads.txt` File
- **Location**: `/ads.txt` (root directory)
- **Purpose**: Declares authorized digital sellers for your site
- **What you need to do**: 
  - Open `ads.txt`
  - Replace `pub-XXXXXXXXXXXXXXXX` with your actual Google AdSense Publisher ID
  - Your Publisher ID looks like `ca-pub-1234567890123456` (found in your AdSense account)

### 2. Created `robots.txt` File
- **Location**: `/robots.txt` (root directory)
- **Purpose**: Allows Google AdSense crawlers to access your site
- **Status**: ✅ Ready to use (no changes needed)
- **Features**:
  - Allows all web crawlers
  - Specifically allows `Mediapartners-Google` (AdSense crawler)
  - Allows `AdsBot-Google` (AdSense verification bot)

### 3. Added Google AdSense Verification Meta Tag
- **Location**: All HTML files in the `<head>` section
- **Format**: `<meta name="google-adsense-account" content="ca-pub-6832553346534070">`
- **What you need to do**: 
  - In all HTML files, replace `ca-pub-6832553346534070` with your actual Publisher ID
  - Files updated:
    - index.html
    - calculator.html
    - auth.html
    - employees.html
    - paye-calculator-kenya.html
    - payslip-generator-kenya.html
    - statutory-deductions-kenya.html
    - profile.html
    - subscription.html
    - privacy-policy.html
    - cookie-policy.html
    - terms-of-service.html
    - adsense-example.html

### 4. Existing AdSense Configuration
- **File**: `adsense-config.js`
- **What you need to do**: 
  - Update `ADSENSE_PUBLISHER_ID` with your Publisher ID
  - Update all ad unit IDs in the `AD_UNITS` object with your actual ad unit IDs

## How to Complete the Setup

### Step 1: Get Your Google AdSense Publisher ID

1. Go to [Google AdSense](https://www.google.com/adsense/)
2. Sign in to your account
3. Go to **Account** → **Account information**
4. Copy your **Publisher ID** (format: `ca-pub-6832553346534070`)

### Step 2: Update Files with Your Publisher ID

Replace `ca-pub-6832553346534070` in these files:

1. **ads.txt** - Line 2:
   ```
   google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0
   ```
   Should become (example):
   ```
   google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0
   ```

2. **All HTML files** - In the `<head>` section:
   ```html
   <meta name="google-adsense-account" content="ca-pub-6832553346534070">
   ```
   Should become (example):
   ```html
   <meta name="google-adsense-account" content="ca-pub-1234567890123456">
   ```

3. **adsense-config.js** - Line 15:
   ```javascript
   const ADSENSE_PUBLISHER_ID = 'ca-pub-6832553346534070';
   ```
   Should become (example):
   ```javascript
   const ADSENSE_PUBLISHER_ID = 'ca-pub-1234567890123456';
   ```

### Step 3: Deploy Your Site

1. **Commit and push all changes** to your repository
2. **Deploy to your hosting platform** (GitHub Pages, Netlify, Vercel, etc.)
3. **Wait for deployment** to complete (usually 1-5 minutes)
4. **Verify files are accessible**:
   - Visit `https://yourdomain.com/ads.txt` - should show your Publisher ID
   - Visit `https://yourdomain.com/robots.txt` - should show crawler rules
   - View page source of your site - should see the meta tag in `<head>`

### Step 4: Submit for Verification in AdSense

1. Go to your [Google AdSense Dashboard](https://www.google.com/adsense/)
2. If you see a verification prompt, click on it
3. Google will crawl your site to verify:
   - The `ads.txt` file with your Publisher ID
   - The meta tag in your HTML pages
   - That robots.txt allows the crawler
4. Verification usually takes **a few hours to 24 hours**

### Step 5: Monitor Verification Status

1. Check your AdSense dashboard regularly
2. Look for email from Google AdSense about verification status
3. If verification fails, check:
   - All files are deployed and accessible
   - Publisher ID is correct in all files
   - No typos or extra spaces
   - Site is served over HTTPS

## Common Issues and Solutions

### Issue: "We couldn't verify your site"

**Solutions**:
- ✅ Ensure `ads.txt` is at the root of your domain (not in a subdirectory)
- ✅ Verify Publisher ID matches exactly in all files
- ✅ Wait 24-48 hours after deployment for Google to crawl your site
- ✅ Check that your site is live and accessible (not localhost)
- ✅ Ensure robots.txt isn't blocking Google's crawlers

### Issue: "ads.txt file not found"

**Solutions**:
- ✅ Verify the file is in the root directory of your site
- ✅ File must be named exactly `ads.txt` (lowercase)
- ✅ Test by visiting `https://yourdomain.com/ads.txt` in a browser
- ✅ Re-deploy your site if needed

### Issue: "Publisher ID mismatch"

**Solutions**:
- ✅ Double-check your Publisher ID from AdSense dashboard
- ✅ Ensure it's exactly the same in all files (including `ca-pub-` prefix)
- ✅ Remove any extra spaces or characters
- ✅ Make sure you didn't copy only the numbers without `ca-pub-`

## Verification Checklist

Before requesting verification from Google, ensure:

- [ ] Publisher ID is updated in `ads.txt`
- [ ] Publisher ID is updated in all HTML files (13 files)
- [ ] Publisher ID is updated in `adsense-config.js`
- [ ] All changes are committed and pushed to repository
- [ ] Site is deployed to production
- [ ] `https://yourdomain.com/ads.txt` is accessible
- [ ] `https://yourdomain.com/robots.txt` is accessible
- [ ] Meta tag is visible in page source
- [ ] Site is served over HTTPS
- [ ] No ad blockers interfering during testing

## After Verification

Once Google verifies your site:

1. **Create Ad Units** in your AdSense dashboard
2. **Update `adsense-config.js`** with your ad unit IDs
3. **Test ads** on your live site (ads won't show on localhost)
4. **Monitor performance** in AdSense dashboard
5. **Comply with policies** to maintain your AdSense account

## Quick Find & Replace

To speed up the process, you can use these commands:

### Using sed (Linux/Mac):
```bash
# Replace Publisher ID in all HTML files
find . -name "*.html" -type f -exec sed -i 's/ca-pub-6832553346534070/ca-pub-YOUR_ACTUAL_ID/g' {} +

# Replace in ads.txt
sed -i 's/pub-XXXXXXXXXXXXXXXX/pub-YOUR_ACTUAL_ID/g' ads.txt

# Replace in adsense-config.js
sed -i 's/ca-pub-6832553346534070/ca-pub-YOUR_ACTUAL_ID/g' adsense-config.js
```

### Using VS Code:
1. Press `Ctrl+Shift+H` (Windows/Linux) or `Cmd+Shift+H` (Mac)
2. Find: `ca-pub-6832553346534070`
3. Replace: `ca-pub-YOUR_ACTUAL_ID`
4. Click "Replace All"

## Need Help?

- **Google AdSense Help**: https://support.google.com/adsense/
- **AdSense Community**: https://support.google.com/adsense/community
- **Contact Support**: Through your AdSense dashboard

## Additional Resources

- See `ADSENSE_SETUP.md` for detailed AdSense implementation guide
- See `ADSENSE_QUICKSTART.md` for quick setup instructions
- See `DEPLOYMENT.md` for deployment instructions

---

**Important**: Never share your actual Publisher ID or Ad Unit IDs publicly in repositories. Consider using environment variables for production deployments.
