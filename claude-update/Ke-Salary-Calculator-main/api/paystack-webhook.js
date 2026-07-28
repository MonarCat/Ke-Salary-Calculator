import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const config = { api: { bodyParser: false } };
const MAX_BODY_BYTES = 1_000_000;

function validSignature(rawBody, signature, key) {
  const expected = Buffer.from(crypto.createHmac("sha512", key).update(rawBody).digest("hex"), "hex");
  const supplied = Buffer.from(String(signature), "hex");
  return expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);
}

function paymentPlan(data) {
  return (data.metadata?.custom_fields || []).find((entry) => entry.variable_name === "plan")?.value;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");
  let rawBody;
  try {
    rawBody = await new Promise((resolve, reject) => {
      let bytes = 0;
      const chunks = [];
      req.on("data", (chunk) => {
        bytes += chunk.length;
        if (bytes > MAX_BODY_BYTES) reject(new Error("Payload too large"));
        else chunks.push(chunk);
      });
      req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      req.on("error", reject);
    });
  } catch {
    return res.status(413).send("Payload too large");
  }

  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key || !validSignature(rawBody, req.headers["x-paystack-signature"], key)) return res.status(400).send("Invalid signature");
  let event;
  try { event = JSON.parse(rawBody); } catch { return res.status(400).send("Invalid JSON"); }
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return res.status(500).send("Server misconfiguration");
  const admin = createClient(url, serviceKey);

  // Keep the existing cancellation behavior, but only after the signature has
  // been validated against the raw request body above.
  if (event?.event === "subscription.disable") {
    const email = event.data?.customer?.email?.toLowerCase();
    if (email) {
      const { data: account } = await admin.schema("auth").from("users").select("id").eq("email", email).maybeSingle();
      if (account?.id) {
        await admin.from("user_profiles").update({ premium: false, premium_source: null, updated_at: new Date().toISOString() }).eq("id", account.id);
      }
    }
    return res.status(200).send("OK");
  }
  if (event?.event !== "charge.success") return res.status(200).send("OK");

  const transaction = event.data || {};
  const reference = String(transaction.reference || "");
  const plan = paymentPlan(transaction);
  const transactionId = Number(transaction.id);
  if (!reference || transaction.status !== "success" || !Number.isSafeInteger(transaction.amount) || transaction.currency !== "KES" || !plan
      || !Number.isSafeInteger(transactionId) || transactionId <= 0) {
    return res.status(400).send("Invalid payment event");
  }

  const { data: intent } = await admin.from("payment_intents")
    .select("user_id, amount_kobo, currency, plan, status, expires_at")
    .eq("reference", reference).maybeSingle();
  if (!intent) return res.status(200).send("Unknown reference");
  if (intent.status === "processed") return res.status(200).send("Already processed");
  if (new Date(intent.expires_at) <= new Date() || intent.amount_kobo !== transaction.amount
      || intent.currency !== transaction.currency || intent.plan !== plan) {
    return res.status(400).send("Payment does not match intent");
  }
  const { data: accountResult, error: accountError } = await admin.auth.admin.getUserById(intent.user_id);
  if (accountError || !accountResult.user?.email || accountResult.user.email.toLowerCase() !== transaction.customer?.email?.toLowerCase()) {
    return res.status(400).send("Payment payer does not match intent owner");
  }

  const { data: processed, error } = await admin.rpc("process_verified_paystack_payment", {
    p_reference: reference,
    p_paystack_transaction_id: transactionId,
    p_amount_kobo: transaction.amount,
    p_currency: transaction.currency,
    p_plan: plan,
    p_metadata: transaction,
  });
  if (error) return res.status(500).send("Processing failed");
  return res.status(200).send(processed ? "OK" : "Already processed");
}
