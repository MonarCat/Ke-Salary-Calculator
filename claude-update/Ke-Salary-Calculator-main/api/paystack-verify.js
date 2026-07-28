import { createClient } from "@supabase/supabase-js";

const VERIFY_URL = "https://api.paystack.co/transaction/verify";
const PLAN_AMOUNTS = { monthly: 9900, yearly: 99900 };

function paymentPlan(data) {
  const field = (data.metadata?.custom_fields || []).find((entry) => entry.variable_name === "plan");
  return field?.value;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method Not Allowed" });
  const reference = String(req.query?.ref || req.body?.reference || "").trim();
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!reference || !token) return res.status(401).json({ success: false, message: "Authentication and reference are required" });

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const paystackKey = process.env.PAYSTACK_SECRET_KEY;
  if (!url || !serviceKey || !anonKey || !paystackKey) return res.status(500).json({ success: false, message: "Server misconfiguration" });

  const caller = createClient(url, anonKey);
  const { data: { user }, error: authError } = await caller.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ success: false, message: "Invalid session" });

  const admin = createClient(url, serviceKey);
  const { data: intent, error: intentError } = await admin.from("payment_intents")
    .select("user_id, amount_kobo, currency, plan, status, expires_at")
    .eq("reference", reference).maybeSingle();
  if (intentError || !intent || intent.user_id !== user.id) return res.status(403).json({ success: false, message: "Payment reference does not belong to this user" });
  if (intent.status === "processed") return res.status(409).json({ success: false, message: "Payment reference has already been processed" });
  if (new Date(intent.expires_at) <= new Date()) return res.status(400).json({ success: false, message: "Payment reference has expired" });

  let transaction;
  try {
    const response = await fetch(`${VERIFY_URL}/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${paystackKey}` } });
    const result = await response.json();
    if (!response.ok || !result.status || result.data?.status !== "success") throw new Error("not successful");
    transaction = result.data;
  } catch {
    return res.status(400).json({ success: false, message: "Transaction not successful" });
  }

  const plan = paymentPlan(transaction);
  const transactionId = Number(transaction.id);
  if (transaction.reference !== reference || transaction.amount !== intent.amount_kobo || transaction.currency !== intent.currency
      || plan !== intent.plan || PLAN_AMOUNTS[plan] !== intent.amount_kobo
      || !Number.isSafeInteger(transactionId) || transactionId <= 0) {
    return res.status(400).json({ success: false, message: "Transaction details do not match the payment intent" });
  }
  if (!transaction.customer?.email || transaction.customer.email.toLowerCase() !== user.email?.toLowerCase()) {
    return res.status(400).json({ success: false, message: "Transaction payer does not match the authenticated user" });
  }

  const { data: processed, error: processError } = await admin.rpc("process_verified_paystack_payment", {
    p_reference: reference,
    p_paystack_transaction_id: transactionId,
    p_amount_kobo: transaction.amount,
    p_currency: transaction.currency,
    p_plan: plan,
    p_metadata: transaction,
  });
  if (processError) return res.status(400).json({ success: false, message: "Payment could not be processed" });
  if (!processed) return res.status(409).json({ success: false, message: "Payment reference has already been processed" });
  return res.status(200).json({ success: true, message: "Premium activated" });
}
