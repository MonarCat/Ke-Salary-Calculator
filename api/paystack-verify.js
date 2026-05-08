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

const PLAN_DURATION_DAYS = {
  monthly: 30,
  yearly: 365,
};

function getPremiumExpiry(plan, currentExpiry) {
  const durationDays = PLAN_DURATION_DAYS[plan] ?? PLAN_DURATION_DAYS.monthly;
  const now = new Date();
  const existingExpiry = currentExpiry ? new Date(currentExpiry) : null;
  const baseDate = existingExpiry && existingExpiry > now ? existingExpiry : now;
  const result = new Date(baseDate);
  result.setDate(result.getDate() + durationDays);
  return result;
}

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
  const supabaseUrl = process.env.SUPABASE_URL
    || process.env.VITE_SUPABASE_URL
    || process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ success: false, message: "Server misconfiguration" });
  }

  const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);

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

  const { data: currentProfile } = await supabase
    .from("user_profiles")
    .select("premium_expires_at")
    .eq("id", authRow.id)
    .maybeSingle();

  const activatedAt = new Date();
  const expiresAt = getPremiumExpiry(plan, currentProfile?.premium_expires_at || null);

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
    .upsert({
      id:                   authRow.id,
      premium:              true,
      premium_expires_at:   expiresAt.toISOString(),
      premium_source:       "paystack",
      premium_activated_at: activatedAt.toISOString(),
      paystack_reference:   reference,
      updated_at:           activatedAt.toISOString(),
    }, { onConflict: "id" });

  if (error) {
    console.error("[Paystack Verify] DB update error:", error);
    return res.status(500).json({ success: false, message: "DB error" });
  }

  return res.status(200).json({ success: true, message: "Premium activated" });
}
