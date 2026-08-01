import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://wznopthjoaqusalqoyru.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader("Location", location);
  return res.end();
}

export default async function handler(req, res) {
  const id = String(req.query?.id || "").trim();
  if (!id || !SERVICE_ROLE_KEY) return redirect(res, "/");

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const { data: booking, error } = await admin
      .from("ad_bookings")
      .select("id, click_url")
      .eq("id", id)
      .maybeSingle();

    if (error || !booking?.id || !booking?.click_url) return redirect(res, "/");

    await admin.rpc("increment_ad_click", { booking_id: booking.id });
    return redirect(res, booking.click_url);
  } catch (_) {
    return redirect(res, "/");
  }
}
