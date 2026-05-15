import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY")!;
const SITE_URL = "https://salarycalculator.co.ke";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const { action, email, token, newPassword } = await req.json();

  // ── ACTION 1: Send reset email ──────────────────────────────────────────
  if (action === "send") {
    // Find user
    const { data: { users }, error: lookupErr } =
      await supabaseAdmin.auth.admin.listUsers();
    const user = users?.find((u) => u.email?.toLowerCase() === email?.toLowerCase());

    // Always return success (don't reveal if email exists)
    if (!user || lookupErr) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Generate token
    const resetToken = crypto.randomUUID().replace(/-/g, "") +
      crypto.randomUUID().replace(/-/g, "");

    await supabaseAdmin.from("password_resets").insert({
      user_id: user.id,
      token: resetToken,
    });

    // Send via Brevo
    const resetLink = `${SITE_URL}/reset-password.html?token=${resetToken}`;

    await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "Salary Calculator", email: "info@salarycalculator.co.ke" },
        to: [{ email: user.email }],
        subject: "Reset your password",
        htmlContent: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto">
            <h2 style="color:#1a1a2e">Password Reset</h2>
            <p>Click the button below to reset your password. This link expires in <strong>30 minutes</strong>.</p>
            <a href="${resetLink}"
               style="display:inline-block;background:#4f46e5;color:#fff;
                      padding:12px 24px;border-radius:6px;text-decoration:none;
                      font-weight:600;margin:16px 0">
              Reset Password
            </a>
            <p style="color:#666;font-size:13px">If you didn't request this, ignore this email.</p>
          </div>`,
      }),
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // ── ACTION 2: Confirm reset ─────────────────────────────────────────────
  if (action === "confirm") {
    if (!token || !newPassword || newPassword.length < 8) {
      return new Response(
        JSON.stringify({ error: "Invalid request" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // Validate token
    const { data: reset, error: tokenErr } = await supabaseAdmin
      .from("password_resets")
      .select("*")
      .eq("token", token)
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (tokenErr || !reset) {
      return new Response(
        JSON.stringify({ error: "Link has expired or already been used." }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // Update password
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
      reset.user_id,
      { password: newPassword }
    );

    if (updateErr) {
      return new Response(
        JSON.stringify({ error: "Failed to update password." }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // Mark token as used
    await supabaseAdmin
      .from("password_resets")
      .update({ used: true })
      .eq("id", reset.id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Unknown action" }), {
    status: 400,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
