/**
 * /api/paystack-webhook.js
 *
 * Vercel Serverless Function — Paystack Webhook Handler
 *
 * Listens for Paystack's "charge.success" event and activates
 * premium on the matching user_profiles row in Supabase.
 *
 * Compatible with:
 *   Vercel   → place at /api/paystack-webhook.js
 *   Cloudflare Pages → copy to /functions/api/paystack-webhook.js
 *                      (see CF variant at the bottom of this file)
 *
 * ── How Paystack webhooks work ────────────────────────────────────────────────
 *  1. User completes payment in the Paystack popup.
 *  2. Paystack POSTs a JSON event to this endpoint.
 *  3. We verify the request using HMAC-SHA512 of the raw body
 *     signed with your Paystack SECRET key.
 *  4. On a verified "charge.success" event, we activate premium.
 *
 * ── Environment variables required ───────────────────────────────────────────
 *  SUPABASE_URL              — your Supabase project URL
 *  SUPABASE_SERVICE_ROLE_KEY — service role key (NOT anon key)
 *  PAYSTACK_SECRET_KEY       — your Paystack secret key (sk_live_... or sk_test_...)
 *
 * ── Paystack Dashboard setup ─────────────────────────────────────────────────
 *  1. Log in → Settings → API Keys & Webhooks
 *  2. Set Webhook URL to: https://salarycalculator.co.ke/api/paystack-webhook
 *  3. Enable event: charge.success
 *  4. Copy your Secret Key → add to your Vercel env vars as PAYSTACK_SECRET_KEY
 */

import crypto     from "crypto";
import { createClient } from "@supabase/supabase-js";

// Disable Vercel body parser — we MUST read the raw stream for HMAC verification.
export const config = { api: { bodyParser: false } };

// ── Plan / product identifiers ────────────────────────────────────────────────
// These match the metadata.custom_fields sent from premium.js openPaystackCheckout()
const PLAN_MONTHLY = "monthly";
const PLAN_YEARLY  = "yearly";

// Duration in days per plan
const PLAN_DURATION_DAYS = {
  [PLAN_MONTHLY]: 30,
  [PLAN_YEARLY]:  365,
};

/**
 * Calculate new premium expiry, extending from the user's existing expiry
 * when their current premium is still active (early renewal).
 *
 * @param {string} plan               — "monthly" | "yearly"
 * @param {string|null} currentExpiry — ISO timestamp of existing premium_expires_at
 * @returns {Date}
 */
function getPremiumExpiry(plan, currentExpiry) {
  const durationDays = PLAN_DURATION_DAYS[plan] ?? 30;
  const now = new Date();
  const existingExpiry = currentExpiry ? new Date(currentExpiry) : null;
  // Extend from current expiry if it's still in the future; otherwise extend from now
  const baseDate = existingExpiry && existingExpiry > now ? existingExpiry : now;
  const result = new Date(baseDate);
  result.setDate(result.getDate() + durationDays);
  return result;
}

/**
 * Verify the Paystack webhook signature.
 * @param {string} rawBody
 * @param {string} signature  — value of x-paystack-signature header
 * @param {string} secretKey  — PAYSTACK_SECRET_KEY env var
 * @returns {boolean}
 */
function verifySignature(rawBody, signature, secretKey) {
  const hash = crypto
    .createHmac("sha512", secretKey)
    .update(rawBody)
    .digest("hex");
  return hash === signature;
}

/**
 * Vercel handler.
 * @param {import('@vercel/node').VercelRequest}  req
 * @param {import('@vercel/node').VercelResponse} res
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  // ── 1. Read raw body stream for HMAC signature verification ──────────────
  // bodyParser is disabled above — read the raw stream directly.
  const rawBody = await new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data",  (chunk) => chunks.push(chunk));
    req.on("end",   () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });

  // ── 2. Verify signature ───────────────────────────────────────────────────
  const signature  = req.headers["x-paystack-signature"] || "";
  const secretKey  = process.env.PAYSTACK_SECRET_KEY || "";

  if (!secretKey) {
    console.error("[Paystack Webhook] PAYSTACK_SECRET_KEY env var not set.");
    return res.status(500).send("Server misconfiguration");
  }

  if (!verifySignature(rawBody, signature, secretKey)) {
    console.warn("[Paystack Webhook] Invalid signature — rejected.");
    return res.status(400).send("Invalid signature");
  }

  // ── 3. Parse event ────────────────────────────────────────────────────────
  let event;
  try {
    event = typeof req.body === "object" ? req.body : JSON.parse(rawBody);
  } catch {
    return res.status(400).send("Invalid JSON");
  }

  const eventType = event?.event;

  // Only process relevant events
  if (eventType !== "charge.success" && eventType !== "subscription.disable") {
    return res.status(200).send("OK");
  }

  // ── 4. Initialise Supabase service client ─────────────────────────────────
  const supabaseUrl = process.env.SUPABASE_URL
    || process.env.VITE_SUPABASE_URL
    || process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[Paystack Webhook] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
    return res.status(500).send("Server misconfiguration");
  }

  const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // ── Handle subscription.disable (cancellation / non-renewal) ─────────────
  if (eventType === "subscription.disable") {
    const disableEmail = event.data?.customer?.email?.toLowerCase();
    if (disableEmail) {
      const { data: disableAuth } = await supabase
        .schema("auth")
        .from("users")
        .select("id")
        .eq("email", disableEmail)
        .maybeSingle();

      if (disableAuth?.id) {
        await supabase
          .from("user_profiles")
          .update({
            premium:        false,
            premium_source: null,
            updated_at:     new Date().toISOString(),
          })
          .eq("id", disableAuth.id);
        console.log(`[Paystack Webhook] Premium revoked for ${disableEmail} (subscription.disable).`);
      }
    }
    return res.status(200).send("OK");
  }

  const data         = event.data || {};
  const payerEmail   = data.customer?.email?.toLowerCase();
  const reference    = data.reference;
  const amountKobo   = data.amount;          // in kobo (×100)
  const currency     = data.currency;        // "KES"
  const status       = data.status;          // "success"

  // Extract plan from metadata custom_fields
  const customFields = data.metadata?.custom_fields || [];
  const planField    = customFields.find((f) => f.variable_name === "plan");
  const plan         = planField?.value || PLAN_MONTHLY;

  if (!payerEmail) {
    console.warn("[Paystack Webhook] No customer email in event.");
    return res.status(200).send("OK");
  }

  // ── 5. Look up user via auth.users (service-role) then record transaction ─
  // IMPORTANT: user_profiles has no email column; always look up via auth.users.
  const { data: authRow } = await supabase
    .schema("auth")
    .from("users")
    .select("id")
    .eq("email", payerEmail)
    .maybeSingle();

  const userId = authRow?.id || null;

  // Upsert to prevent double-activation on duplicate webhook delivery
  const { error: txnErr } = await supabase
    .from("paystack_transactions")
    .upsert(
      {
        reference,
        payer_email: payerEmail,
        amount_kobo: amountKobo,
        currency,
        status,
        plan,
        user_id: userId,
      },
      { onConflict: "reference", ignoreDuplicates: true }
    );

  if (txnErr) {
    console.error("[Paystack Webhook] Transaction upsert error:", txnErr);
    // Non-fatal — continue
  }

  // ── 6. Activate premium ───────────────────────────────────────────────────
  if (!userId) {
    console.error(
      `[Paystack Webhook] No auth user found for ${payerEmail} — pending manual activation.`
    );
    return res.status(200).send("OK");
  }

  // Fetch current profile to check existing expiry (for early-renewal extension)
  const { data: currentProfile } = await supabase
    .from("user_profiles")
    .select("premium_expires_at")
    .eq("id", userId)
    .maybeSingle();

  const now       = new Date();
  const expiresAt = getPremiumExpiry(plan, currentProfile?.premium_expires_at || null);

  const { error: updateErr } = await supabase
    .from("user_profiles")
    .update({
      premium:              true,
      premium_expires_at:   expiresAt.toISOString(),
      premium_source:       "paystack",
      premium_activated_at: now.toISOString(),
      paystack_reference:   reference,
      updated_at:           now.toISOString(),
    })
    .eq("id", userId);

  if (updateErr) {
    console.error("[Paystack Webhook] Premium activation error:", updateErr);
    return res.status(500).send("DB error");
  }

  console.log(`✅ Premium extended for ${payerEmail} until ${expiresAt.toISOString()}`);

  return res.status(200).send("OK");
}

// ═════════════════════════════════════════════════════════════════════════════
// CLOUDFLARE PAGES FUNCTIONS VARIANT
// Copy to /functions/api/paystack-webhook.js and use this export instead:
// ═════════════════════════════════════════════════════════════════════════════
/*
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const rawBody  = await request.text();
  const signature = request.headers.get("x-paystack-signature") || "";
  const secretKey = env.PAYSTACK_SECRET_KEY || "";

  const hash = crypto.createHmac("sha512", secretKey).update(rawBody).digest("hex");
  if (hash !== signature) return new Response("Invalid signature", { status: 400 });

  const event = JSON.parse(rawBody);
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  if (event?.event === "subscription.disable") {
    const disableEmail = event.data?.customer?.email?.toLowerCase();
    if (disableEmail) {
      const { data: authRow } = await supabase
        .schema("auth").from("users").select("id").eq("email", disableEmail).maybeSingle();
      if (authRow?.id) {
        await supabase.from("user_profiles")
          .update({ premium: false, premium_source: null, updated_at: new Date().toISOString() })
          .eq("id", authRow.id);
      }
    }
    return new Response("OK");
  }

  if (event?.event !== "charge.success") return new Response("OK");

  const data       = event.data || {};
  const payerEmail = data.customer?.email?.toLowerCase();
  const reference  = data.reference;
  const plan       = (data.metadata?.custom_fields || []).find(f => f.variable_name === "plan")?.value || "monthly";

  // Look up via auth.users — user_profiles has no email column
  const { data: authRow } = await supabase
    .schema("auth").from("users").select("id").eq("email", payerEmail).maybeSingle();
  if (!authRow) return new Response("OK");

  await supabase.from("paystack_transactions").upsert(
    { reference, payer_email: payerEmail, amount_kobo: data.amount, currency: data.currency, status: data.status, plan, user_id: authRow.id },
    { onConflict: "reference", ignoreDuplicates: true }
  );

  // Fetch current expiry to support early-renewal extension
  const { data: profile } = await supabase
    .from("user_profiles").select("premium_expires_at").eq("id", authRow.id).maybeSingle();

  const now           = new Date();
  const durationDays  = plan === "yearly" ? 365 : 30;
  const currentExpiry = profile?.premium_expires_at ? new Date(profile.premium_expires_at) : null;
  const baseDate      = currentExpiry && currentExpiry > now ? currentExpiry : now;
  const expiresAt     = new Date(baseDate);
  expiresAt.setDate(expiresAt.getDate() + durationDays);

  await supabase.from("user_profiles")
    .update({ premium: true, premium_expires_at: expiresAt.toISOString(), premium_source: "paystack", premium_activated_at: now.toISOString(), paystack_reference: reference, updated_at: now.toISOString() })
    .eq("id", authRow.id);

  return new Response("OK");
}
*/
