/**
 * /api/paystack-verify.js
 *
 * Vercel Serverless Function — Paystack Transaction Verification
 *
 * Called by the frontend immediately after a successful Paystack popup
 * payment to activate premium without waiting for the webhook.
 *
 * The webhook (/api/paystack-webhook.js) also activates premium server-side
 * and is the authoritative activation path. This endpoint provides instant
 * feedback to the user.
 *
 * Request:
 *   POST /api/paystack-verify?ref=SC-YEARLY-1234567890
 *
 * Response:
 *   200 { success: true,  message: "Premium activated" }
 *   400 { success: false, message: "..." }
 *
 * Environment variables required:
 *   SUPABASE_URL              — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — service role key
 *   PAYSTACK_SECRET_KEY       — Paystack secret key
 */

import { createClient } from "@supabase/supabase-js";

const PAYSTACK_VERIFY_URL = "https://api.paystack.co/transaction/verify";

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

  // ── 1. Verify transaction with Paystack API ───────────────────────────────
  let txData;
  try {
    const paystackRes = await fetch(`${PAYSTACK_VERIFY_URL}/${encodeURIComponent(reference)}`, {
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
    });
    const json = await paystackRes.json();
    if (!json.status || json.data?.status !== "success") {
      return res.status(400).json({ success: false, message: "Transaction not successful" });
    }
    txData = json.data;
  } catch (err) {
    console.error("[Paystack Verify] API error:", err);
    return res.status(502).json({ success: false, message: "Could not verify with Paystack" });
  }

  // ── 2. Extract details ────────────────────────────────────────────────────
  const payerEmail  = txData.customer?.email?.toLowerCase();
  const customFields = txData.metadata?.custom_fields || [];
  const planField   = customFields.find((f) => f.variable_name === "plan");
  const plan        = planField?.value || "monthly";

  if (!payerEmail) {
    return res.status(400).json({ success: false, message: "No email in transaction" });
  }

  // ── 3. Activate premium in Supabase ──────────────────────────────────────
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Look up via auth.users — user_profiles has no email column.
  const { data: authRow } = await supabase
    .schema("auth")
    .from("users")
    .select("id")
    .eq("email", payerEmail)
    .maybeSingle();

  if (!authRow) {
    // User not registered with this email — webhook will handle it when they sign up
    return res.status(200).json({ success: true, message: "Activation pending sign-up" });
  }

  const expiresAt = new Date();
  if (plan === "yearly") {
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  } else {
    expiresAt.setMonth(expiresAt.getMonth() + 1);
  }

  // Upsert transaction record
  await supabase
    .from("paystack_transactions")
    .upsert(
      {
        reference,
        payer_email: payerEmail,
        amount_kobo: txData.amount,
        currency:    txData.currency,
        status:      txData.status,
        plan,
        user_id:     authRow.id,
      },
      { onConflict: "reference", ignoreDuplicates: true }
    );

  // Activate premium
  const { error } = await supabase
    .from("user_profiles")
    .update({
      premium:            true,
      premium_expires_at: expiresAt.toISOString(),
      premium_source:     "paystack",
    })
    .eq("id", authRow.id);

  if (error) {
    console.error("[Paystack Verify] DB update error:", error);
    return res.status(500).json({ success: false, message: "DB error" });
  }

  return res.status(200).json({ success: true, message: "Premium activated" });
}
