import { createClient } from "@supabase/supabase-js";

const VERIFY_URL = "https://api.paystack.co/transaction/verify";

// Best-effort, non-blocking audit log for one-off donations made from
// /donate.html. Unlike api/paystack-verify.js, this endpoint never requires
// a signed-in user — donations are anonymous by design. The frontend
// (assets/js/donate.js) already shows the success screen from Paystack's own
// inline callback; this call exists purely so the amount is verified
// server-side (never trust a client-reported amount) and recorded for
// reconciliation. If this call fails or the endpoint is unreachable, the
// donor still sees their confirmation — see donate.js `logDonation()`.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed" });

  const reference = String(req.body?.reference || "").trim();
  if (!reference || !reference.startsWith("SC-DONATE-")) {
    return res.status(400).json({ success: false, message: "Invalid or missing reference" });
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const paystackKey = process.env.PAYSTACK_SECRET_KEY;
  if (!url || !serviceKey || !paystackKey) {
    // Missing server config shouldn't break the donor-facing flow.
    return res.status(200).json({ success: false, message: "Logging skipped (server not configured)" });
  }

  let transaction;
  try {
    const response = await fetch(`${VERIFY_URL}/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${paystackKey}` },
    });
    const result = await response.json();
    if (!response.ok || !result.status || result.data?.status !== "success") {
      return res.status(200).json({ success: false, message: "Transaction not verified as successful" });
    }
    transaction = result.data;
  } catch {
    return res.status(200).json({ success: false, message: "Could not reach Paystack to verify" });
  }

  const transactionId = Number(transaction.id);
  if (transaction.reference !== reference || transaction.currency !== "KES"
      || !Number.isSafeInteger(transaction.amount) || transaction.amount <= 0
      || !Number.isSafeInteger(transactionId) || transactionId <= 0) {
    return res.status(200).json({ success: false, message: "Transaction details look invalid" });
  }

  const donorEmail = transaction.customer?.email || null;
  const donorNameField = (transaction.metadata?.custom_fields || [])
    .find((entry) => entry.variable_name === "donor_name");

  const admin = createClient(url, serviceKey);
  const { error } = await admin.from("donations").upsert(
    {
      reference,
      paystack_transaction_id: transactionId,
      amount_kobo: transaction.amount,
      currency: transaction.currency,
      donor_name: donorNameField?.value || null,
      donor_email: donorEmail,
      status: "success",
    },
    { onConflict: "reference" }
  );

  if (error) return res.status(200).json({ success: false, message: "Could not log donation" });
  return res.status(200).json({ success: true, message: "Donation verified and logged" });
}
