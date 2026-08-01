import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://salarycalculator.co.ke",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!url || !anonKey) {
      return new Response(JSON.stringify({ success: false, error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(url, anonKey);
    const today = new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("ad_bookings")
      .select("id, slot_id, advertiser_name, creative_url, click_url, start_date, end_date, weight, status")
      .eq("status", "active")
      .lte("start_date", today)
      .gte("end_date", today)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    const grouped: Record<string, unknown[]> = {
      rail_left: [],
      rail_right: [],
      strip_below_results: [],
    };

    for (const row of data ?? []) {
      if (!grouped[row.slot_id]) grouped[row.slot_id] = [];
      grouped[row.slot_id].push(row);
    }

    return new Response(JSON.stringify(grouped), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=120",
      },
    });
  } catch (err) {
    console.error("get-active-ads error:", err);
    return new Response(JSON.stringify({ success: false, error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
