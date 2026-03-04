# PayPal Donation Button Setup

## Overview
The "Support This Project" section in the calculator has been updated to use a PayPal donation button instead of manual payment numbers. This provides a more automated and professional donation experience for users.

## Configuration Required

### Step 1: Create a PayPal Donation Button
1. Log in to your PayPal account
2. Go to PayPal.Me or create a donation button at https://www.paypal.com/donate/buttons
3. Follow the wizard to create a donation button
4. Copy the hosted button ID from the generated link

### Step 2: Update the Calculator
Replace `YOUR_BUTTON_ID` in `calculator.html` with your actual PayPal button ID:

**File: `calculator.html`**

Find both occurrences (lines ~169 and ~350):
```html
<a href="https://www.paypal.com/donate/?hosted_button_id=YOUR_BUTTON_ID" target="_blank" class="paypal-donate-btn">
```

Replace with:
```html
<a href="https://www.paypal.com/donate/?hosted_button_id=YOUR_ACTUAL_BUTTON_ID" target="_blank" class="paypal-donate-btn">
```

### Alternative: Use PayPal.Me Link
If you prefer to use PayPal.Me instead:

Replace:
```html
<a href="https://www.paypal.com/donate/?hosted_button_id=YOUR_BUTTON_ID" target="_blank" class="paypal-donate-btn">
```

With:
```html
<a href="https://www.paypal.me/yourusername" target="_blank" class="paypal-donate-btn">
```

## Testing
1. Click the "Support This Project" button on the calculator page
2. Verify the PayPal button appears
3. Click the PayPal button and ensure it redirects to your PayPal donation page

## Features
- Automated donation process
- Professional PayPal branding
- Single-click donation experience
- Opens in a new tab to keep users on the calculator page
- Responsive design that works on all devices

## Styling
The PayPal button uses the following CSS classes defined in `styles.css`:
- `.paypal-donate-btn` - Main button styling with PayPal blue color (#0070ba)
- `.donate-note` - Styling for the thank you message
- `.donate-info` - Container for the donation section

## Files Modified
- `calculator.html` - Updated donation sections (2 locations)
- `styles.css` - Added PayPal button styling

## Benefits Over Previous Implementation
- **Automated**: Users click a button instead of manually copying payment numbers
- **Professional**: Uses PayPal's trusted brand and secure payment system
- **International**: PayPal works globally, not just in Kenya
- **Tracking**: PayPal provides donation tracking and receipts automatically
- **Multiple Payment Methods**: Donors can use credit cards, debit cards, or PayPal balance

## Support
For issues with PayPal setup, contact PayPal support at https://www.paypal.com/support
