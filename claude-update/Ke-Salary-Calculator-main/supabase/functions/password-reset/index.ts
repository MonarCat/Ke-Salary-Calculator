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

// Shared silent-success response — never reveal whether an email is registered
const silentSuccess = () =>
  new Response(JSON.stringify({ success: true }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });

serve(async (req) => {
  // ── Preflight ─────────────────────────────────────────────────────────────
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    // ── Parse body ───────────────────────────────────────────────────────────
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const { action, email, token, newPassword } = body as {
      action?: string;
      email?: string;
      token?: string;
      newPassword?: string;
    };

    // ── ACTION 1: Send reset email ──────────────────────────────────────────
    if (action === "send") {
      if (!email || typeof email !== "string") return silentSuccess();

      // FIX Bug 1: query user_profiles by email to avoid listUsers() pagination cap.
      // listUsers() defaults to perPage=50 — users beyond the first page would never
      // receive a reset link. user_profiles is queryable without pagination.
      const { data: profile, error: profileErr } = await supabaseAdmin
        .from("user_profiles")
        .select("id, email")
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();

      if (profileErr || !profile) return silentSuccess();

      // Verify the user still exists in auth.users
      const { data: { user }, error: userErr } =
        await supabaseAdmin.auth.admin.getUserById(profile.id);

      if (userErr || !user) return silentSuccess();

      // Generate a 64-char cryptographically random token
      const resetToken =
        crypto.randomUUID().replace(/-/g, "") +
        crypto.randomUUID().replace(/-/g, "");

      // FIX Bug 2: check insert result before sending the email.
      // If the insert fails the token is phantom — the email must not be sent.
      const { error: insertErr } = await supabaseAdmin
        .from("password_resets")
        .insert({ user_id: user.id, token: resetToken });

      if (insertErr) {
        console.error("password_resets insert failed:", insertErr.message);
        // Return silent success so we don't leak that the email exists,
        // but the user simply won't receive a link (logged for diagnosis).
        return silentSuccess();
      }

      // Send via Brevo
      const resetLink = `${SITE_URL}/reset-password.html?token=${resetToken}`;

      const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": BREVO_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: { name: "Salary Calculator KE", email: "info@salarycalculator.co.ke" },
          to: [{ email: user.email }],
          subject: "Reset your password — salarycalculator.co.ke",
          htmlContent: `
            <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:480px;margin:auto">
              <div style="background:linear-gradient(135deg,#1a1a2e,#0f3460);
                          padding:28px 32px;border-radius:12px 12px 0 0;text-align:center">
                <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700">
                  💰 salarycalculator.co.ke
                </h1>
              </div>
              <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;
                          box-shadow:0 2px 12px rgba(0,0,0,0.08)">
                <h2 style="color:#1a1a2e;margin:0 0 12px">Password Reset</h2>
                <p style="color:#4a5568;font-size:15px;line-height:1.7">
                  Click the button below to reset your password.
                  This link expires in <strong>30 minutes</strong>.
                </p>
                <div style="text-align:center;margin:28px 0">
                  <a href="${resetLink}"
                     style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);
                            color:#fff;padding:14px 32px;border-radius:8px;
                            text-decoration:none;font-weight:600;font-size:15px">
                    Reset Password
                  </a>
                </div>
                <p style="color:#a0aec0;font-size:12px;text-align:center;margin:0">
                  If you didn't request this, you can safely ignore this email.
                </p>
              </div>
            </div>`,
        }),
      });

      if (!brevoRes.ok) {
        console.error("Brevo send failed:", await brevoRes.text());
      }

      return silentSuccess();
    }

    // ── ACTION 2: Confirm reset ─────────────────────────────────────────────
    if (action === "confirm") {
      if (!token || !newPassword || newPassword.length < 8) {
        return new Response(
          JSON.stringify({ error: "Invalid request. Password must be at least 8 characters." }),
          { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
        );
      }

      // Validate token — must be unused and not yet expired
      const { data: reset, error: tokenErr } = await supabaseAdmin
        .from("password_resets")
        .select("id, user_id")
        .eq("token", token)
        .eq("used", false)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (tokenErr || !reset) {
        return new Response(
          JSON.stringify({ error: "This link has expired or already been used. Please request a new one." }),
          { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
        );
      }

      // Update password via admin client
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
        reset.user_id,
        { password: newPassword }
      );

      if (updateErr) {
        console.error("updateUserById failed:", updateErr.message);
        return new Response(
          JSON.stringify({ error: "Failed to update password. Please try again." }),
          { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
        );
      }

      // Mark token as used so it cannot be replayed
      await supabaseAdmin
        .from("password_resets")
        .update({ used: true })
        .eq("id", reset.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // ── Unknown action ──────────────────────────────────────────────────────
    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  // FIX Bug 3: catch any unhandled throw so the browser never sees a CORS-less 500
  } catch (err) {
    console.error("password-reset unhandled error:", err);
    return new Response(JSON.stringify({ error: "An unexpected error occurred." }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
