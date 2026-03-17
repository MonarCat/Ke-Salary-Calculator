/**
 * /api/paystack-verify.js
 * Vercel Serverless Function — instant post-payment premium activation
 *
 * Called by the frontend immediately after Paystack popup closes.
 * The webhook is the authoritative path; this provides instant UX feedback.
 *
 * POST /api/paystack-verify?ref=SC-YEARLY-1234567890
 *
 * ENV vars required:
 *   PAYSTACK_SECRET_KEY
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  const reference = req.query?.ref || req.body?.reference;
  if (!reference) {
    return res.status(400).json({ success: false, message: "Missing reference" });
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return res.status(500).json({ success: false, message: "Server misconfiguration" });
  }

  // 1. Verify transaction with Paystack API
  let txData;
  try {
    const r = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${secretKey}` } }
    );
    const json = await r.json();
    if (!json.status || json.data?.status !== "success") {
      return res.status(400).json({ success: false, message: "Transaction not successful" });
    }
    txData = json.data;
  } catch (err) {
    console.error("[verify] Paystack API error:", err.message);
    return res.status(502).json({ success: false, message: "Could not verify with Paystack" });
  }

  // 2. Extract details
  const payerEmail = txData.customer?.email?.toLowerCase();
  const plan = (txData.metadata?.custom_fields || [])
    .find((f) => f.variable_name === "plan")?.value || "monthly";

  if (!payerEmail) {
    return res.status(400).json({ success: false, message: "No email in transaction" });
  }

  // 3. Look up user
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: authRow } = await supabase
    .from("users")
    .select("id")
    .eq("email", payerEmail)
    .maybeSingle();

  if (!authRow) {
    // Paid but not registered yet — webhook will handle on sign-up
    return res.status(200).json({ success: true, message: "Activation pending sign-up" });
  }

  // 4. Calculate expiry
  const expiresAt = new Date();
  plan === "yearly"
    ? expiresAt.setFullYear(expiresAt.getFullYear() + 1)
    : expiresAt.setMonth(expiresAt.getMonth() + 1);

  // 5. Upsert transaction record
  await supabase
    .from("paystack_transactions")
    .upsert(
      { reference, payer_email: payerEmail, amount_kobo: txData.amount,
        currency: txData.currency, status: txData.status, plan, user_id: authRow.id },
      { onConflict: "reference", ignoreDuplicates: true }
    );

  // 6. Activate premium
  const { error } = await supabase
    .from("user_profiles")
    .update({
      premium:            true,
      premium_expires_at: expiresAt.toISOString(),
      premium_source:     "paystack",
    })
    .eq("id", authRow.id);

  if (error) {
    console.error("[verify] DB error:", error.message);
    return res.status(500).json({ success: false, message: "DB error" });
  }

  console.log(`[verify] Premium activated — ${payerEmail} (${plan})`);
  return res.status(200).json({ success: true, message: "Premium activated" });
}
