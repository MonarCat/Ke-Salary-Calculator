/**
 * PayPal IPN Webhook – Netlify Serverless Function
 *
 * Receives PayPal IPN (Instant Payment Notification), verifies the payload
 * with PayPal's servers, deduplicates transactions, and calls the
 * grant_premium() RPC in Supabase to activate the paying user.
 *
 * Required environment variables (set in Netlify dashboard):
 *   SUPABASE_URL          – e.g. https://xyzxyz.supabase.co
 *   SUPABASE_SERVICE_KEY  – Service-role key (never expose client-side)
 *   PAYPAL_MODE           – "sandbox" or "live"
 */

const PAYPAL_VERIFY_URL = {
    live:    'https://ipnpb.paypal.com/cgi-bin/webscr',
    sandbox: 'https://ipnpb.sandbox.paypal.com/cgi-bin/webscr',
};

export default async function handler(req) {
    // PayPal sends IPN as an HTTP POST with an application/x-www-form-urlencoded body
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    const rawBody = await req.text();

    // ── Step 1: Echo back to PayPal for verification ──────────────────────────
    const mode = process.env.PAYPAL_MODE === 'sandbox' ? 'sandbox' : 'live';
    const verifyUrl = PAYPAL_VERIFY_URL[mode];

    const verifyResponse = await fetch(verifyUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent':   'KeSalaryCalculator-IPN-Verifier/1.0',
        },
        body: 'cmd=_notify-validate&' + rawBody,
    });

    const verification = await verifyResponse.text();

    if (verification !== 'VERIFIED') {
        console.error('PayPal IPN verification failed:', verification);
        return new Response('IPN verification failed', { status: 400 });
    }

    // ── Step 2: Parse the verified payload ────────────────────────────────────
    const params = new URLSearchParams(rawBody);
    const txnId      = params.get('txn_id');
    const txnType    = params.get('txn_type');
    const paymentStatus = params.get('payment_status');
    const payerEmail = params.get('payer_email');
    const gross      = parseFloat(params.get('mc_gross') || '0');
    const currency   = params.get('mc_currency') || 'USD';
    const custom     = params.get('custom') || '';   // caller can pass user_id here
    const itemName   = params.get('item_name') || '';

    // We only process completed payments (not refunds, reversals, etc.)
    if (paymentStatus !== 'Completed') {
        return new Response('Not a completed payment – ignored', { status: 200 });
    }

    // ── Step 3: Connect to Supabase ───────────────────────────────────────────
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
        return new Response('Server misconfiguration', { status: 500 });
    }

    const supabaseHeaders = {
        'apikey':        supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type':  'application/json',
        'Prefer':        'return=representation',
    };

    // ── Step 4: Deduplicate – record the transaction (unique txn_id) ──────────
    const insertRes = await fetch(`${supabaseUrl}/rest/v1/paypal_transactions`, {
        method: 'POST',
        headers: {
            ...supabaseHeaders,
            // Fail if a row with this txn_id already exists (prevent double-grant)
            'Prefer': 'return=minimal,resolution=ignore-duplicates',
        },
        body: JSON.stringify({
            txn_id:         txnId,
            txn_type:       txnType,
            payment_status: paymentStatus,
            payer_email:    payerEmail,
            gross_amount:   gross,
            currency:       currency,
            custom_field:   custom,
            item_name:      itemName,
            raw_ipn:        rawBody,
        }),
    });

    if (!insertRes.ok && insertRes.status !== 409) {
        const errText = await insertRes.text();
        console.error('Failed to insert paypal_transaction:', errText);
        return new Response('DB error', { status: 500 });
    }

    // 409 means duplicate – already processed; acknowledge and exit cleanly
    if (insertRes.status === 409) {
        return new Response('Duplicate IPN – already processed', { status: 200 });
    }

    // ── Step 5: Grant premium via the Supabase RPC ───────────────────────────
    // Determine which user to upgrade:
    //   (a) custom field contains the Supabase user_id (UUID), OR
    //   (b) look up by payer_email in user_profiles
    let userId = null;

    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRe.test(custom)) {
        userId = custom;
    } else {
        // Fall back to email lookup
        const lookupRes = await fetch(
            `${supabaseUrl}/rest/v1/user_profiles?select=id&email=eq.${encodeURIComponent(payerEmail)}&limit=1`,
            { headers: supabaseHeaders }
        );
        if (lookupRes.ok) {
            const rows = await lookupRes.json();
            if (rows && rows.length > 0) userId = rows[0].id;
        }
    }

    if (!userId) {
        // Unknown user – log and acknowledge (no grant, but don't fail PayPal)
        console.warn('PayPal IPN: could not map payer_email to a user_id:', payerEmail);
        return new Response('OK – user not found, premium not granted', { status: 200 });
    }

    // Determine premium duration based on gross amount (KES / USD)
    // 30 days per tier – extend as needed
    const ANNUAL_TIER_THRESHOLD_USD = 10;
    const ANNUAL_DURATION_DAYS      = 365;
    const MONTHLY_DURATION_DAYS     = 30;
    const durationDays = gross >= ANNUAL_TIER_THRESHOLD_USD
        ? ANNUAL_DURATION_DAYS
        : MONTHLY_DURATION_DAYS;

    const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/grant_premium`, {
        method: 'POST',
        headers: supabaseHeaders,
        body: JSON.stringify({
            p_user_id:      userId,
            p_source:       'paypal',
            p_duration_days: durationDays,
            p_txn_id:       txnId,
        }),
    });

    if (!rpcRes.ok) {
        const errText = await rpcRes.text();
        console.error('grant_premium RPC failed:', errText);
        return new Response('grant_premium failed', { status: 500 });
    }

    return new Response('IPN processed successfully', { status: 200 });
}
