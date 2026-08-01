const SLOT_CONFIG = {
  rail_left: { containerId: "ad-rail-left", width: 160, height: 600, autoRotateMs: 0 },
  rail_right: { containerId: "ad-rail-right", width: 160, height: 600, autoRotateMs: 0 },
  strip_below_results: { containerId: "ad-strip-below-results", width: 728, height: 90, autoRotateMs: 35000 },
};

const impressionDebounce = new Set();
let cachedAds = null;

function weightedPick(bookings = []) {
  if (!bookings.length) return null;
  const normalized = bookings.map((b) => ({ ...b, weight: Math.max(1, Number(b.weight) || 1) }));
  const total = normalized.reduce((sum, b) => sum + b.weight, 0);
  let r = Math.random() * total;
  for (const booking of normalized) {
    r -= booking.weight;
    if (r <= 0) return booking;
  }
  return normalized[normalized.length - 1];
}

async function fetchActiveAds(supabase) {
  if (cachedAds) return cachedAds;
  const { data, error } = await supabase.functions.invoke("get-active-ads", { method: "GET" });
  if (error) throw error;
  cachedAds = data || {};
  return cachedAds;
}

function createCreative(booking, { width, height }) {
  const a = document.createElement("a");
  a.href = `/ad-click/${booking.id}`;
  a.target = "_blank";
  a.rel = "noopener sponsored";
  a.className = "ad-slot-creative";

  const img = document.createElement("img");
  img.src = booking.creative_url;
  img.width = width;
  img.height = height;
  img.alt = booking.advertiser_name;
  img.loading = "lazy";
  img.decoding = "async";

  a.appendChild(img);
  return a;
}

async function trackImpression(supabase, bookingId) {
  if (!bookingId || impressionDebounce.has(bookingId)) return;
  impressionDebounce.add(bookingId);
  try {
    await supabase.rpc("increment_ad_impression", { booking_id: bookingId });
  } catch (err) {
    console.warn("[ad-rotation] impression tracking failed", err);
  }
}

async function renderSlot(supabase, slotKey, bookings) {
  const config = SLOT_CONFIG[slotKey];
  const container = document.getElementById(config.containerId);
  if (!container || !bookings?.length) return;

  const renderBooking = async (booking) => {
    container.querySelectorAll("ins.adsbygoogle").forEach((el) => el.remove());
    const previous = container.querySelector(".ad-slot-creative");
    const next = createCreative(booking, config);
    next.classList.add("ad-fade-enter");
    container.appendChild(next);
    requestAnimationFrame(() => next.classList.remove("ad-fade-enter"));

    if (previous) {
      previous.classList.add("ad-fade-exit");
      setTimeout(() => previous.remove(), 360);
    }

    await trackImpression(supabase, booking.id);
  };

  await renderBooking(weightedPick(bookings));

  if (config.autoRotateMs > 0) {
    setInterval(() => {
      const next = weightedPick(bookings);
      if (next) renderBooking(next);
    }, config.autoRotateMs);
  }
}

export async function initAdRotation({ supabase, isPremium = false } = {}) {
  if (!supabase || isPremium) return;
  let adsBySlot;
  try {
    adsBySlot = await fetchActiveAds(supabase);
  } catch (err) {
    console.warn("[ad-rotation] failed to fetch active ads", err);
    return;
  }

  await Promise.all(Object.keys(SLOT_CONFIG).map((slotKey) => renderSlot(supabase, slotKey, adsBySlot[slotKey] || [])));
}
