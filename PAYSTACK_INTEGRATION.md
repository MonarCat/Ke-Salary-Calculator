# Paystack Integration Guide

This guide explains how to set up Paystack payment integration for the Kenya Salary Calculator subscription system.

## Prerequisites

1. A Paystack account ([sign up at paystack.com](https://paystack.com))
2. Verified business details with Paystack
3. Access to your Paystack dashboard

## Setup Steps

### 1. Get Your Paystack API Keys

1. Log in to your Paystack dashboard at [dashboard.paystack.com](https://dashboard.paystack.com)
2. Navigate to **Settings** > **API Keys & Webhooks**
3. Copy your **Public Key** and **Secret Key**
   - Use **Test Keys** for development
   - Use **Live Keys** for production

### 2. Update subscription.html

Open `subscription.html` and replace the Paystack public key:

```javascript
// Line 370 in subscription.html
const PAYSTACK_PUBLIC_KEY = 'pk_test_your_actual_key_here'; // Replace with your test key
```

For production:
```javascript
const PAYSTACK_PUBLIC_KEY = 'pk_live_your_actual_key_here'; // Use live key in production
```

### 3. Set Up Webhook Endpoint

Paystack uses webhooks to notify your server about payment events. You'll need to create a backend endpoint to handle these webhooks.

#### Recommended: Create a serverless function

**Using Netlify Functions** (if deploying on Netlify):

Create `netlify/functions/paystack-webhook.js`:

```javascript
const crypto = require('crypto');

exports.handler = async (event, context) => {
  // Verify webhook signature
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(event.body))
    .digest('hex');

  if (hash !== event.headers['x-paystack-signature']) {
    return {
      statusCode: 401,
      body: JSON.stringify({ message: 'Invalid signature' })
    };
  }

  const body = JSON.parse(event.body);
  const eventType = body.event;

  // Handle different event types
  switch(eventType) {
    case 'charge.success':
      await handleSuccessfulPayment(body.data);
      break;
    case 'subscription.create':
      await handleSubscriptionCreated(body.data);
      break;
    case 'subscription.disable':
      await handleSubscriptionCancelled(body.data);
      break;
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Webhook received' })
  };
};

async function handleSuccessfulPayment(data) {
  // 1. Verify the payment with Paystack API
  // 2. Update user subscription in Supabase
  // 3. Send confirmation email
  
  const { reference, metadata, amount } = data;
  const userId = metadata.custom_fields.find(f => f.variable_name === 'user_id').value;
  const plan = metadata.custom_fields.find(f => f.variable_name === 'subscription_plan').value;
  
  // Update Supabase
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  
  await supabase
    .from('user_profiles')
    .update({
      subscription_tier: plan,
      subscription_status: 'active',
      subscription_start_date: new Date(),
      subscription_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    })
    .eq('id', userId);
    
  // Record transaction
  await supabase
    .from('subscription_transactions')
    .insert({
      user_id: userId,
      transaction_reference: reference,
      amount: amount / 100, // Convert from kobo to KES
      currency: 'KES',
      payment_status: 'success',
      subscription_tier: plan,
      paystack_reference: reference
    });
}
```

**Using Vercel Functions** (if deploying on Vercel):

Create `api/paystack-webhook.js` with similar code.

### 4. Configure Webhook URL in Paystack

1. Go to **Settings** > **API Keys & Webhooks** in your Paystack dashboard
2. Add your webhook URL:
   - For Netlify: `https://your-site.netlify.app/.netlify/functions/paystack-webhook`
   - For Vercel: `https://your-site.vercel.app/api/paystack-webhook`
3. Save the webhook URL

### 5. Environment Variables

Set up these environment variables in your deployment platform:

```bash
PAYSTACK_SECRET_KEY=sk_test_your_secret_key_here
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
```

**For Netlify:**
- Go to **Site settings** > **Build & deploy** > **Environment variables**

**For Vercel:**
- Go to **Project Settings** > **Environment Variables**

## Testing

### Test Mode

Use Paystack's test cards to test the integration:

- **Successful payment:** `4084084084084081`
- **Failed payment:** `5060666666666666666`
- Any CVV and future expiry date

### Verification Flow

1. User clicks "Subscribe to Premium"
2. Paystack payment modal opens
3. User enters payment details
4. Payment is processed
5. Webhook is called with payment confirmation
6. Backend updates user subscription
7. User is redirected to profile page with active subscription

## Production Checklist

Before going live:

- [ ] Switch to live Paystack keys
- [ ] Update webhook URL to production URL
- [ ] Test with real small amount (KES 1)
- [ ] Verify webhook is receiving events
- [ ] Test subscription activation
- [ ] Test subscription cancellation
- [ ] Set up email notifications
- [ ] Implement payment verification on backend
- [ ] Add error handling and logging
- [ ] Set up monitoring for failed payments

## Recurring Subscriptions

For automatic monthly renewals, you can use Paystack Subscriptions:

```javascript
// Instead of one-time payment, create a subscription
const handler = PaystackPop.setup({
  key: PAYSTACK_PUBLIC_KEY,
  email: email,
  amount: amountInKobo,
  plan: 'PLN_xxxxx', // Your Paystack plan code
  // ... other options
});
```

### Create Plans in Paystack:

1. Go to **Plans** in Paystack dashboard
2. Create plans for Premium (KES 499) and Enterprise (KES 999)
3. Set interval to "Monthly"
4. Get the plan codes (e.g., PLN_xxxxx)
5. Use these plan codes instead of one-time amounts

## Security Best Practices

1. **Always verify webhooks:** Check the `x-paystack-signature` header
2. **Never expose secret keys:** Keep them in environment variables
3. **Verify payments server-side:** Don't trust client-side success callbacks
4. **Use HTTPS:** Ensure your webhook endpoint uses HTTPS
5. **Handle errors gracefully:** Implement retry logic for failed webhook processing
6. **Log all transactions:** Keep audit trails for compliance

## Support

- **Paystack Documentation:** [paystack.com/docs](https://paystack.com/docs)
- **Paystack Support:** support@paystack.com
- **Integration Issues:** Check the Paystack dashboard for error logs

## Currency Support

Paystack supports multiple currencies including:
- KES (Kenyan Shillings) - Used in this application
- NGN (Nigerian Naira)
- GHS (Ghanaian Cedi)
- ZAR (South African Rand)
- USD (US Dollars)

The integration is set up for KES by default. Amounts are specified in kobo (smallest currency unit):
- 1 KES = 100 kobo
- KES 499 = 49900 kobo

## Additional Features to Implement

### 1. Subscription Management
- View active subscription details
- Cancel subscription
- Upgrade/downgrade plans
- View payment history

### 2. Email Notifications
- Payment successful
- Subscription activated
- Subscription expiring soon
- Subscription cancelled
- Payment failed

### 3. Admin Dashboard
- View all subscriptions
- Manage user subscriptions manually
- View payment analytics
- Export transaction reports

## Troubleshooting

### Common Issues

**Issue:** Webhook not receiving events
- **Solution:** Check webhook URL is correct and accessible
- Verify webhook is active in Paystack dashboard
- Check server logs for incoming requests

**Issue:** Payment successful but subscription not activated
- **Solution:** Check webhook is processing correctly
- Verify Supabase permissions
- Check transaction logs

**Issue:** "Invalid public key" error
- **Solution:** Verify you're using the correct public key
- Check if using test key in development, live key in production

## Next Steps

After setting up Paystack:

1. Implement download tracking in the payslip generator
2. Add employee count limits for free users
3. Implement bulk email sending for premium users
4. Create admin dashboard for managing subscriptions
5. Add analytics for subscription metrics
