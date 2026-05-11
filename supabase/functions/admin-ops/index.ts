import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEFAULT_ORIGIN = "https://salarycalculator.co.ke";
const ALLOWED_ORIGINS = new Set([
  DEFAULT_ORIGIN,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
]);

const CORS_HEADERS = {
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
};

const withCors = (req: Request) => {
  const origin = req.headers.get("Origin") ?? "";
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : DEFAULT_ORIGIN;
  return { ...CORS_HEADERS, "Access-Control-Allow-Origin": allowOrigin, "Vary": "Origin" };
};

const ok = (req: Request, d: unknown) =>
  new Response(JSON.stringify(d), { headers: withCors(req) });
const err = (req: Request, msg: string, s = 400) =>
  new Response(JSON.stringify({ error: msg }), { status: s, headers: withCors(req) });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: withCors(req) });
  }
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
  if (!token) return err(req, "Missing authorization token", 401);

  const SUPA_URL = Deno.env.get("SUPABASE_URL");
  const SVC_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ADMIN_EMAILS = (Deno.env.get("ADMIN_EMAILS") || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (!SUPA_URL || !SVC_KEY) return err(req, "Server not configured", 500);

  const callerClient = createClient(SUPA_URL, token);
  const { data: userData, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !userData?.user) return err(req, "Unauthorized", 401);

  const caller = userData.user;
  if (!ADMIN_EMAILS.includes(caller.email?.toLowerCase() ?? "")) return err(req, "Forbidden", 403);

  const admin = createClient(SUPA_URL, SVC_KEY);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return err(req, "Invalid JSON");
  }

  const log = async (action: string, targetEmail?: string, targetId?: string, meta?: object) => {
    await admin.from("admin_audit_log").insert({
      admin_email: caller.email,
      action,
      target_email: targetEmail ?? null,
      target_id: targetId ?? null,
      metadata: meta ?? null,
    });
  };

  switch (body.action) {
    case "list_users": {
      const page = Number(body.page ?? 1);
      const limit = Number(body.limit ?? 50);
      const from = Math.max(0, (page - 1) * limit);
      const to = from + limit - 1;

      const { data, error, count } = await admin
        .from("user_profiles")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) return err(req, error.message, 500);
      return ok(req, { users: data ?? [], total: count ?? 0, page, limit });
    }

    case "get_analytics": {
      const [analytics, growth] = await Promise.all([
        admin.from("admin_analytics").select("*").single(),
        admin.from("admin_growth_daily").select("*").order("day", { ascending: true }),
      ]);

      if (analytics.error) return err(req, analytics.error.message, 500);
      if (growth.error) return err(req, growth.error.message, 500);
      return ok(req, { analytics: analytics.data, growth: growth.data ?? [] });
    }

    case "grant_premium": {
      const { email, days, note } = body as { email: string; days: number; note?: string };
      if (!email || !days) return err(req, "email and days required");

      let target: { id: string; email?: string | null } | undefined;
      let page = 1;
      const perPage = 200;
      const maxPages = 50;
      while (!target && page <= maxPages) {
        const { data: usersData, error: listErr } = await admin.auth.admin.listUsers({ page, perPage });
        if (listErr) return err(req, listErr.message, 500);
        const users = usersData.users ?? [];
        target = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
        if (users.length < perPage) break;
        page += 1;
      }
      if (!target) return err(req, "User not found — they must have signed up first", 404);

      const expires = new Date();
      expires.setDate(expires.getDate() + Number(days));

      const { error: upErr } = await admin.from("user_profiles").upsert(
        {
          id: target.id,
          email: target.email,
          premium_expires_at: expires.toISOString(),
          premium_source: "admin",
          admin_note: note ?? null,
          p9a_access: true,
          payroll_access: true,
        },
        { onConflict: "id" },
      );

      if (upErr) return err(req, upErr.message, 500);
      await log("grant_premium", email, target.id, { days, note });
      return ok(req, { success: true, expires: expires.toISOString() });
    }

    case "revoke_premium": {
      const { user_id, email } = body as { user_id: string; email: string };
      if (!user_id) return err(req, "user_id required");

      const { error } = await admin.from("user_profiles").update({
        premium_expires_at: new Date().toISOString(),
      }).eq("id", user_id);

      if (error) return err(req, error.message, 500);
      await log("revoke_premium", email, user_id);
      return ok(req, { success: true });
    }

    case "reset_password_email": {
      const { email } = body as { email: string };
      if (!email) return err(req, "email required");

      const { data, error } = await admin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: "https://salarycalculator.co.ke/auth.html?mode=reset" },
      });

      if (error) return err(req, error.message, 500);
      await log("reset_password", email, undefined, { method: "email" });
      return ok(req, { success: true, link: data?.properties?.action_link });
    }

    case "generate_reset_link": {
      const { email } = body as { email: string };
      if (!email) return err(req, "email required");

      const { data, error } = await admin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: "https://salarycalculator.co.ke/auth.html?mode=reset" },
      });
      if (error) return err(req, error.message, 500);
      await log("reset_password", email, undefined, { method: "link" });
      return ok(req, { success: true, link: data?.properties?.action_link });
    }

    case "set_password": {
      const { user_id, email, password } = body as { user_id: string; email: string; password: string };
      if (!user_id || !password) return err(req, "user_id and password required");
      if (password.length < 8) return err(req, "Password must be ≥ 8 characters");

      const { error } = await admin.auth.admin.updateUserById(user_id, { password });
      if (error) return err(req, error.message, 500);
      await log("set_password", email, user_id);
      return ok(req, { success: true });
    }

    case "generate_magic_link": {
      const { email } = body as { email: string };
      if (!email) return err(req, "email required");

      const { data, error } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: "https://salarycalculator.co.ke/calculator.html?sc_admin=1" },
      });
      if (error) return err(req, error.message, 500);
      await log("impersonate", email, undefined, { link_generated: true });
      return ok(req, { success: true, link: data?.properties?.action_link });
    }

    case "toggle_feature": {
      const { user_id, email, field, value } = body as {
        user_id: string; email: string; field: string; value: boolean;
      };
      const ALLOWED = ["p9a_access", "payroll_access"];
      if (!user_id || !ALLOWED.includes(field)) return err(req, "Invalid request");

      const { error } = await admin.from("user_profiles").update({ [field]: value }).eq("id", user_id);
      if (error) return err(req, error.message, 500);
      await log("toggle_feature", email, user_id, { field, value });
      return ok(req, { success: true });
    }

    case "send_email": {
      const { subject, target } = body as { subject: string; target: "all" | "premium" | "free" | string };
      const now = new Date().toISOString();
      let query = admin.from("user_profiles").select("email, full_name, premium_expires_at");
      if (target === "premium") query = query.gt("premium_expires_at", now);
      else if (target === "free") query = query.or(`premium_expires_at.is.null,premium_expires_at.lte.${now}`);

      const { data: recipients, error } = await query;
      if (error) return err(req, error.message, 500);
      await log("send_email", undefined, undefined, { subject, target, recipient_count: recipients?.length ?? 0 });
      return ok(req, { success: true, recipients_count: recipients?.length ?? 0 });
    }

    default:
      return err(req, `Unknown action: ${body.action}`);
  }
});
