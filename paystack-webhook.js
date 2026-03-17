/**
 * /api/paystack-webhook.js
 * Vercel Serverless Function — Paystack charge.success handler
 *
 * Verifies HMAC-SHA512 signature, then activates premium in Supabase.
 *
 * ENV vars required (set in Vercel dashboard → Settings → Environment Variables):
 *   PAYSTACK_SECRET_KEY       sk_live_...
 *   SUPABASE_URL              https://wklhcmaodxatavuoduhd.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY eyJ...
 */

import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

// MUST be here — disables Vercel body parser so we get the raw stream
// needed for HMAC signature verification. Without this the signature
// check always fails because re-serialising a parsed object changes byte order.
export const config = {
  api: { bodyParser: false },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data",  (chunk) => chunks.push(chunk));
    req.on("end",   () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function verifySignature(rawBody, signature, secretKey) {
  const hash = crypto
    .createHmac("sha512", secretKey)
    .update(rawBody)
    .digest("hex");
  return hash === signature;
}

function getPremiumExpiry(plan) {
  const d = new Date();
  plan === "yearly"
    ? d.setFullYear(d.getFullYear() + 1)
    : d.setMonth(d.getMonth() + 1);
  return d;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    console.error("[webhook] PAYSTACK_SECRET_KEY not set");
    return res.status(500).send("Server misconfiguration");
  }

  // 1. Read raw body
  let rawBody;
  try {
    rawBody = await readRawBody(req);
  } catch (err) {
    console.error("[webhook] Failed to read body:", err.message);
    return res.status(400).send("Bad request");
  }

  // 2. Verify signature
  const signature = req.headers["x-paystack-signature"] || "";
  if (!verifySignature(rawBody, signature, secretKey)) {
    console.warn("[webhook] Invalid signature — rejected");
    return res.status(400).send("Invalid signature");
  }

  // 3. Parse event
  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return res.status(400).send("Invalid JSON");
  }

  if (event?.event !== "charge.success") {
    return res.status(200).send("OK");
  }

  const data       = event.data || {};
  const payerEmail = data.customer?.email?.toLowerCase();
  const reference  = data.reference;
  const amountKobo = data.amount;
  const currency   = data.currency;
  const status     = data.status;
  const plan       = (data.metadata?.custom_fields || [])
    .find((f) => f.variable_name === "plan")?.value || "monthly";

  if (!payerEmail) {
    console.warn("[webhook] No customer email in event");
    return res.status(200).send("OK");
  }

  // 4. Supabase service client
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // 5. Look up user via auth.users (user_profiles has no email column)
  const { data: authRow } = await supabase
    .from("users")
    .select("id")
    .eq("email", payerEmail)
    .maybeSingle();

  let userId = authRow?.id || null;

  // Fallback via helper SQL function (added in migration 006)
  if (!userId) {
    const { data: rpcId } = await supabase
      .rpc("get_user_id_by_email", { p_email: payerEmail });
    userId = rpcId || null;
  }

  // 6. Record transaction (idempotent)
  await supabase
    .from("paystack_transactions")
    .upsert(
      { reference, payer_email: payerEmail, amount_kobo: amountKobo,
        currency, status, plan, user_id: userId },
      { onConflict: "reference", ignoreDuplicates: true }
    );

  if (!userId) {
    console.warn("[webhook] No user found for:", payerEmail, "— manual activation needed");
    return res.status(200).send("OK");
  }

  // 7. Activate premium
  const expiresAt = getPremiumExpiry(plan);
  const { error } = await supabase
    .from("user_profiles")
    .update({
      premium:            true,
      premium_expires_at: expiresAt.toISOString(),
      premium_source:     "paystack",
    })
    .eq("id", userId);

  if (error) {
    console.error("[webhook] DB update error:", error.message);
    return res.status(500).send("DB error");
  }

  console.log(`[webhook] Premium activated — ${payerEmail} (${plan}) until ${expiresAt.toISOString()}`);
  return res.status(200).send("OK");
}
