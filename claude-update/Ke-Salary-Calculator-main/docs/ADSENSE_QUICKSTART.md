# Quick Start - Google AdSense Configuration

## TL;DR - Get Ads Running in 5 Steps

### Step 1: Get AdSense Account
- Go to https://www.google.com/adsense/
- Sign up with your Google account
- Submit your site for review
- Wait for approval (1-2 weeks typically)

### Step 2: Create Ad Units
Once approved, in your AdSense dashboard:
- Go to **Ads** → **By ad unit** → **+ New ad unit**
- Create 4 display ad units:
  1. **Header Banner** (Responsive or 728x90)
  2. **In-Content Ad** (Responsive)
  3. **Footer Banner** (Responsive or 728x90)
  4. **Mobile Ad** (Responsive or 320x50)

### Step 3: Get Your Codes
From each ad unit, you'll need:
- **Publisher ID**: Found in ad code as `ca-pub-6832553346534070`
- **Ad Unit ID**: Found in ad code as `data-ad-slot="YYYYYYYYYY"`

### Step 4: Update Configuration
Open `adsense-config.js` and replace:

```javascript
// Line 12: Replace with YOUR publisher ID
const ADSENSE_PUBLISHER_ID = 'ca-pub-1234567890123456';

// Lines 16-23: Replace with YOUR ad unit IDs
const AD_UNITS = {
    HEADER_BANNER: '1234567890',
    SIDEBAR_AD: '0987654321',
    IN_CONTENT_AD: '1122334455',
    FOOTER_AD: '5544332211',
    MOBILE_AD: '6677889900'
};
```

### Step 5: Deploy and Test
- Deploy your site to a live domain (ads won't show on localhost)
- Wait 10-30 minutes for ads to start appearing
- Check browser console for any errors
- Monitor AdSense dashboard for impressions

---

## Where Are Ads Placed?

### Landing Page (index.html)
- ✅ Header banner after navigation
- ✅ In-content ad between stats and features
- ✅ Footer ad before footer

### Calculator (calculator.html)
- ✅ Header banner after navigation
- ✅ In-content ad between calculator and info

### Other Pages
- ✅ Header banners on PAYE, Deductions, and Payslip pages

---

## Common Issues

### "Ads not showing"
- ✅ Verify you're on a live domain (not localhost)
- ✅ Check browser console for errors
- ✅ Disable ad blockers
- ✅ Wait 30+ minutes after deployment
- ✅ Verify Publisher ID and Ad Unit IDs are correct

### "Blank spaces where ads should be"
- ✅ Normal for first few hours after setup
- ✅ Google needs time to match ads to your content
- ✅ Ensure your site has enough content
- ✅ Check AdSense dashboard for policy violations

### "Policy violation email from Google"
- ✅ Review AdSense policies
- ✅ Ensure content is family-safe
- ✅ Remove any prohibited content
- ✅ Reply to Google with corrections made

---

## Alternative: Manual Ad Code Implementation

If you prefer to paste ad code directly instead of using the configuration file:

1. Get ad code from AdSense dashboard
2. Replace the ad container divs in HTML files with the actual ad code
3. Example:

```html
<!-- Replace this: -->
<div id="adsense-header-banner" class="adsense-container"></div>

<!-- With this (from your AdSense): -->
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXX"></script>
<ins class="adsbygoogle"
     style="display:block"
     data-ad-client="ca-pub-XXXXX"
     data-ad-slot="YYYYY"
     data-ad-format="auto"
     data-full-width-responsive="true"></ins>
<script>
     (adsbygoogle = window.adsbygoogle || []).push({});
</script>
```

4. Remove `<script src="adsense-config.js"></script>` from HTML files

---

## Testing Checklist

Before going live:
- [ ] AdSense account approved
- [ ] Created all ad units
- [ ] Updated Publisher ID in config
- [ ] Updated all Ad Unit IDs in config
- [ ] Tested on staging/live domain
- [ ] Checked browser console (no errors)
- [ ] Verified mobile responsiveness
- [ ] Confirmed ads don't break layout
- [ ] Read and understand AdSense policies

After going live:
- [ ] Monitor AdSense dashboard daily
- [ ] Check for policy violations
- [ ] Track revenue and impressions
- [ ] Optimize based on performance data
- [ ] Never click your own ads!

---

## Need More Help?

📖 **Detailed Guide**: See `ADSENSE_SETUP.md`  
🎯 **Live Example**: Open `adsense-example.html`  
🔧 **Troubleshooting**: Check console logs and AdSense dashboard  
📧 **Google Support**: Use AdSense Help Center

---

## Pro Tips

1. **Wait for Content**: More quality content = better ad matching = higher revenue
2. **Mobile First**: Most traffic is mobile, optimize for it
3. **User Experience**: Don't compromise UX for ad revenue
4. **Test Placements**: A/B test different ad positions
5. **Be Patient**: Revenue grows over time as Google learns your audience
6. **Stay Compliant**: Always follow AdSense policies
7. **Premium Users**: Ads are automatically hidden for premium/enterprise subscribers

---

## Premium User Ad Filtering

**✅ IMPLEMENTED**: Premium and Enterprise users will not see any ads on the site.

The system automatically:
- Checks user's subscription tier from the `user_profiles` table
- Hides all ad containers if user has `premium` or `enterprise` subscription
- Shows ads to free users and non-logged-in visitors
- Gracefully handles errors by defaulting to showing ads

**No additional configuration needed** - premium filtering works out of the box!

---

**Ready?** Open `adsense-config.js` and add your codes! 🚀
