import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY")!;
const SITE_URL = "https://salarycalculator.co.ke";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";
const HEADERS = {
  "api-key": BREVO_API_KEY,
  "Content-Type": "application/json",
};

async function sendEmail(payload: object) {
  const res = await fetch(BREVO_URL, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(payload),
  });
  if (!res.ok) console.error("Brevo error:", await res.text());
}

function parseExpiryTimestamp(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Date.parse(value);
  return NaN;
}

// ── Email Templates ────────────────────────────────────────────────────────

function welcomeEmail(name: string, email: string) {
  const firstName = name?.split(" ")[0] || "there";
  return {
    sender: { name: "Salary Calculator KE", email: "info@salarycalculator.co.ke" },
    to: [{ email, name }],
    subject: `Welcome, ${firstName} 👋 — Your payroll companion is ready`,
    htmlContent: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f6fa;font-family:'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:12px;overflow:hidden;
                    box-shadow:0 2px 12px rgba(0,0,0,0.06)">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 60%,#0f3460 100%);
                     padding:36px 40px;text-align:center">
            <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;
                       letter-spacing:-0.3px">
              💰 salarycalculator.co.ke
            </h1>
            <p style="color:#a0aec0;margin:6px 0 0;font-size:13px">
              Kenya's Payroll Intelligence Platform
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px">
            <p style="font-size:20px;font-weight:600;color:#1a1a2e;margin:0 0 8px">
              Welcome aboard, ${firstName}! 🎉
            </p>
            <p style="color:#4a5568;font-size:15px;line-height:1.7;margin:0 0 24px">
              Your account is all set. Here's what you can do right now:
            </p>

            <!-- Features -->
            <table width="100%" cellpadding="0" cellspacing="0">
              ${[
                ["📊", "Calculate net pay", "PAYE, NHIF, NSSF, Housing Levy — all computed accurately to KRA standards."],
                ["📄", "Generate payslips", "Professional payslips ready to share with employees."],
                ["📋", "Run P9A reports", "Annual tax reports for your team in seconds."],
              ].map(([icon, title, desc]) => `
              <tr>
                <td style="padding:12px 0;border-bottom:1px solid #edf2f7;vertical-align:top">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="font-size:20px;padding-right:14px;vertical-align:top">${icon}</td>
                      <td>
                        <p style="margin:0;font-weight:600;color:#1a1a2e;font-size:14px">${title}</p>
                        <p style="margin:4px 0 0;color:#718096;font-size:13px">${desc}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>`).join("")}
            </table>

            <!-- CTA -->
            <div style="text-align:center;margin:32px 0 0">
              <a href="${SITE_URL}"
                 style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);
                        color:#ffffff;padding:14px 36px;border-radius:8px;
                        text-decoration:none;font-weight:600;font-size:15px;
                        box-shadow:0 4px 12px rgba(79,70,229,0.35)">
                Open Salary Calculator →
              </a>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f7fafc;padding:20px 40px;text-align:center;
                     border-top:1px solid #edf2f7">
            <p style="margin:0;color:#a0aec0;font-size:12px">
              You're receiving this because you signed up at salarycalculator.co.ke<br>
              Questions? Reply to this email — we read everything.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  };
}

function premiumNudgeEmail(name: string, email: string) {
  const firstName = name?.split(" ")[0] || "there";
  return {
    sender: { name: "Salary Calculator KE", email: "info@salarycalculator.co.ke" },
    to: [{ email, name }],
    subject: `${firstName}, unlock clean payslips — no watermarks 🔓`,
    htmlContent: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f6fa;font-family:'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:12px;overflow:hidden;
                    box-shadow:0 2px 12px rgba(0,0,0,0.06)">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0f3460 0%,#533483 100%);
                     padding:36px 40px;text-align:center">
            <p style="color:#e2d9f3;margin:0 0 8px;font-size:13px;letter-spacing:1px;
                      text-transform:uppercase">You're on the Free Plan</p>
            <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700">
              ✨ Go Premium Today
            </h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px">
            <p style="color:#4a5568;font-size:15px;line-height:1.7;margin:0 0 28px">
              Hi ${firstName}, your free account is great for exploring — but when you're
              ready to send payslips to employees or file with KRA, you'll want these:
            </p>

            <!-- Compare table -->
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;
                          font-size:14px">
              <tr style="background:#f7fafc">
                <td style="padding:10px 16px;color:#718096;font-weight:600">Feature</td>
                <td style="padding:10px 16px;text-align:center;color:#718096;font-weight:600">Free</td>
                <td style="padding:10px 16px;text-align:center;color:#4f46e5;font-weight:600">Premium</td>
              </tr>
              ${[
                ["Payslip PDFs",           "SAMPLE watermark", "✅ Clean & professional"],
                ["P9A annual reports",      "❌",               "✅ Unlimited"],
                ["Multiple employees",      "1 employee",       "✅ Unlimited"],
                ["Priority support",        "❌",               "✅ Included"],
              ].map(([feat, free, pro], i) => `
              <tr style="background:${i % 2 === 0 ? "#ffffff" : "#fafafa"}">
                <td style="padding:10px 16px;color:#2d3748;border-top:1px solid #edf2f7">${feat}</td>
                <td style="padding:10px 16px;text-align:center;color:#a0aec0;
                           border-top:1px solid #edf2f7">${free}</td>
                <td style="padding:10px 16px;text-align:center;color:#276749;font-weight:600;
                           border-top:1px solid #edf2f7">${pro}</td>
              </tr>`).join("")}
            </table>

            <!-- Pricing -->
            <div style="text-align:center;margin:28px 0">
              <div style="display:inline-block;background:#faf5ff;border:2px solid #7c3aed;
                          border-radius:10px;padding:16px 32px">
                <p style="margin:0;color:#6b21a8;font-size:13px;font-weight:600">
                  PREMIUM PLAN
                </p>
                <p style="margin:4px 0 2px;font-size:28px;font-weight:800;color:#1a1a2e">
                  KES 99<span style="font-size:15px;font-weight:400;color:#718096">/month</span>
                </p>
                <p style="margin:0;color:#a0aec0;font-size:12px">
                  or KES 999/year — save 2 months
                </p>
              </div>
            </div>

            <!-- CTA -->
            <div style="text-align:center">
              <a href="${SITE_URL}/account.html#upgrade"
                 style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#4f46e5);
                        color:#ffffff;padding:14px 40px;border-radius:8px;
                        text-decoration:none;font-weight:700;font-size:15px;
                        box-shadow:0 4px 14px rgba(124,58,237,0.4)">
                Upgrade Now — KES 99/mo
              </a>
              <p style="margin:12px 0 0;color:#a0aec0;font-size:12px">
                Cancel anytime. No hidden fees.
              </p>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f7fafc;padding:20px 40px;text-align:center;
                     border-top:1px solid #edf2f7">
            <p style="margin:0;color:#a0aec0;font-size:12px">
              salarycalculator.co.ke · Nairobi, Kenya<br>
              <a href="${SITE_URL}/unsubscribe.html" style="color:#cbd5e0">Unsubscribe</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  };
}

// ── Main Handler ───────────────────────────────────────────────────────────

serve(async (req) => {
  try {
    // Webhook payload from Supabase Database Webhook
    const payload = await req.json();

    // Database webhook sends: { type, table, record, old_record }
    const record = payload?.record;
    if (!record) {
      return new Response("No record", { status: 400 });
    }

    const { email, full_name, plan, is_premium, premium_expires_at } = record;

    if (!email) {
      return new Response("No email on record", { status: 400 });
    }

    // Resolve name if not on user_profiles — fallback to email prefix
    const name = full_name || email.split("@")[0];

    // 1. Send welcome email immediately
    await sendEmail(welcomeEmail(name, email));

    // 2. Send premium nudge for free-plan users (slight delay feels less robotic)
    const normalizedPlan = typeof plan === "string" ? plan.trim().toLowerCase() : "";
    const premiumByPlan = normalizedPlan !== "" && normalizedPlan !== "free";
    // Webhook payloads can serialize DB values differently across environments.
    const premiumByFlag = is_premium === true
      || (is_premium !== null && is_premium !== undefined && String(is_premium).toLowerCase() === "true");
    const premiumExpiryTs = parseExpiryTimestamp(premium_expires_at);
    const premiumByExpiry = Number.isFinite(premiumExpiryTs) && premiumExpiryTs > Date.now();
    const isPremium = premiumByPlan || premiumByFlag || premiumByExpiry;
    if (!isPremium) {
      await new Promise((r) => setTimeout(r, 2500));
      await sendEmail(premiumNudgeEmail(name, email));
    }

    return new Response(JSON.stringify({ sent: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-welcome error:", err);
    return new Response("Internal error", { status: 500 });
  }
});
