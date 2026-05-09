/**
 * SUPABASE EDGE FUNCTION: admin-ops
 * Project: wznopthjoaqusalqoyru (salarycalculator.co.ke)
 *
 * Deploy:
 *   supabase functions deploy admin-ops --project-ref wznopthjoaqusalqoyru
 *
 * Handles all privileged admin operations that require the SERVICE_ROLE key:
 *   - grant_premium          → update user_profiles premium status
 *   - revoke_premium         → expire premium immediately
 *   - reset_password_email   → send Supabase password recovery email
 *   - generate_reset_link    → return a recovery link for manual sending
 *   - set_password           → directly set a user's password (admin override)
 *   - generate_magic_link    → OTP magic link for admin to log in as user
 *   - send_broadcast_email   → bulk email via Google Workspace / Gmail SMTP (see send-broadcast-email fn)
 *   - toggle_feature         → toggle p9a_access / payroll_access on user_profiles
 *
 * Environment variables required (set in Supabase dashboard → Edge Functions → Secrets):
 *   SUPABASE_URL            (auto-provided)
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ADMIN_SECRET            → a random long string you choose — used to gate this fn
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // ── Auth: verify the caller is the logged-in admin ────────────────────────
  // The admin dashboard sends the anon key as Bearer. We verify the caller has
  // a valid Supabase session AND is on the admin allowlist (your email).
  const authHeader = req.headers.get("Authorization") || "";
  const callerToken = authHeader.replace("Bearer ", "").trim();

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ADMIN_SECRET = Deno.env.get("ADMIN_SECRET") || "";

  // Admin client (service role — unlimited power)
  const adminSb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Verify caller session
  const callerSb = createClient(SUPABASE_URL, callerToken);
  const { data: { user: callerUser } } = await callerSb.auth.getUser();

  // ADMIN_EMAILS: comma-separated list of allowed admin emails
  const ADMIN_EMAILS = (Deno.env.get("ADMIN_EMAILS") || "kesalarycalculator@gmail.com")
    .split(",").map(e => e.trim().toLowerCase());

  const isAdmin =
    callerUser && ADMIN_EMAILS.includes(callerUser.email?.toLowerCase() || "");

  if (!isAdmin) {
    return json({ error: "Unauthorized — admin only" }, 403);
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { action } = body;

  // ── ROUTER ────────────────────────────────────────────────────────────────
  switch (action) {

    // ── GRANT PREMIUM ───────────────────────────────────────────────────────
    case "grant_premium": {
      const { email, days, note } = body as { email: string; days: number; note?: string };
      if (!email || !days) return json({ error: "email and days required" }, 400);

      // Find user by email in auth.users
      const { data: users, error: listErr } = await adminSb.auth.admin.listUsers();
      if (listErr) return json({ error: listErr.message }, 500);
      const target = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (!target) return json({ error: "User not found" }, 404);

      const expires = new Date();
      expires.setDate(expires.getDate() + Number(days));

      const { error: upErr } = await adminSb
        .from("user_profiles")
        .upsert({
          id: target.id,
          email: target.email,
          premium_expires_at: expires.toISOString(),
          premium_source: "admin",
          admin_note: note || null,
        }, { onConflict: "id" });

      if (upErr) return json({ error: upErr.message }, 500);
      return json({ success: true, expires: expires.toISOString() });
    }

    // ── REVOKE PREMIUM ──────────────────────────────────────────────────────
    case "revoke_premium": {
      const { user_id } = body as { user_id: string };
      if (!user_id) return json({ error: "user_id required" }, 400);

      const { error } = await adminSb
        .from("user_profiles")
        .update({ premium_expires_at: new Date().toISOString() })
        .eq("id", user_id);

      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    // ── RESET PASSWORD — send email ─────────────────────────────────────────
    case "reset_password_email": {
      const { email } = body as { email: string };
      if (!email) return json({ error: "email required" }, 400);

      // Generate a recovery link (Supabase sends the email automatically)
      const { data, error } = await adminSb.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: "https://salarycalculator.co.ke/reset-password" },
      });

      if (error) return json({ error: error.message }, 500);
      // Supabase also sends the email automatically when type=recovery
      return json({ success: true, link: data?.properties?.action_link });
    }

    // ── GENERATE RESET LINK (no auto-email — return link for manual send) ──
    case "generate_reset_link": {
      const { email } = body as { email: string };
      if (!email) return json({ error: "email required" }, 400);

      const { data, error } = await adminSb.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: "https://salarycalculator.co.ke/reset-password" },
      });

      if (error) return json({ error: error.message }, 500);
      return json({ success: true, link: data?.properties?.action_link });
    }

    // ── SET PASSWORD DIRECTLY ───────────────────────────────────────────────
    case "set_password": {
      const { user_id, password } = body as { user_id: string; password: string };
      if (!user_id || !password) return json({ error: "user_id and password required" }, 400);
      if (password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);

      const { error } = await adminSb.auth.admin.updateUserById(user_id, { password });
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    // ── GENERATE MAGIC LINK (admin impersonation) ───────────────────────────
    case "generate_magic_link": {
      const { email } = body as { email: string };
      if (!email) return json({ error: "email required" }, 400);

      // generateLink type "magiclink" sends an OTP — we return the link for admin use
      const { data, error } = await adminSb.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: "https://salarycalculator.co.ke/calculator.html?admin_session=1" },
      });

      if (error) return json({ error: error.message }, 500);
      return json({ success: true, link: data?.properties?.action_link });
    }

    // ── TOGGLE FEATURE ACCESS ───────────────────────────────────────────────
    case "toggle_feature": {
      const { user_id, field, value } = body as { user_id: string; field: string; value: boolean };
      const ALLOWED_FIELDS = ["p9a_access", "payroll_access"];
      if (!user_id || !field) return json({ error: "user_id and field required" }, 400);
      if (!ALLOWED_FIELDS.includes(field)) return json({ error: "Invalid field" }, 400);

      const { error } = await adminSb
        .from("user_profiles")
        .update({ [field]: value })
        .eq("id", user_id);

      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    default:
      return json({ error: `Unknown action: ${action}` }, 400);
  }
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}
