/**
 * /api/admin-ops.js
 *
 * Vercel Serverless Proxy — Admin Operations
 *
 * Forwards authenticated admin requests to the Supabase Edge Function
 * server-side, eliminating browser→Supabase CORS/preflight issues.
 *
 * The browser calls this same-origin endpoint (no preflight needed).
 * This proxy then calls the Supabase Edge Function server-to-server,
 * which is not subject to browser CORS restrictions.
 *
 * Request:
 *   POST /api/admin-ops
 *   Authorization: Bearer <user-session-token>
 *   Content-Type: application/json
 *   Body: { action: "...", ...params }
 *
 * Response mirrors the upstream Supabase Edge Function response.
 */

const SUPABASE_ADMIN_FN = "https://wznopthjoaqusalqoyru.supabase.co/functions/v1/admin-ops";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const authorization = req.headers["authorization"] || "";
  const apikey = req.headers["apikey"] || "";

  if (!authorization) {
    return res.status(401).json({ error: "Missing authorization header" });
  }

  let upstream;
  try {
    upstream = await fetch(SUPABASE_ADMIN_FN, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authorization,
        apikey: apikey,
      },
      body: JSON.stringify(req.body),
    });
  } catch (fetchErr) {
    console.error("[admin-ops proxy] upstream fetch error:", fetchErr);
    return res.status(502).json({ error: "Failed to reach admin service" });
  }

  const raw = await upstream.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch (parseErr) {
    console.error("[admin-ops proxy] non-JSON response from upstream:", parseErr, raw.slice(0, 300));
  }

  if (data !== undefined) {
    return res.status(upstream.status).json(data);
  }
  return res.status(upstream.status).send(raw);
}
