import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const PLANS = { monthly: 9900, yearly: 99900 };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const plan = req.body?.plan;
  if (!token || !Object.hasOwn(PLANS, plan)) return res.status(400).json({ error: "Invalid payment request" });
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !serviceKey || !anonKey) return res.status(500).json({ error: "Server misconfiguration" });
  const caller = createClient(url, anonKey);
  const { data: { user }, error } = await caller.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: "Unauthenticated" });
  const reference = `SC-${plan.toUpperCase()}-${crypto.randomUUID()}`;
  const admin = createClient(url, serviceKey);
  const { error: insertError } = await admin.from("payment_intents").insert({
    user_id: user.id, reference, amount_kobo: PLANS[plan], currency: "KES", plan,
  });
  if (insertError) return res.status(500).json({ error: "Could not create payment intent" });
  return res.status(201).json({ reference, amount_kobo: PLANS[plan], currency: "KES", plan });
}
