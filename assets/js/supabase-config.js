// Supabase Configuration
// Replace these with your actual Supabase project credentials
// You can find these in your Supabase project dashboard at https://app.supabase.com

const SUPABASE_URL = 'https://wznopthjoaqusalqoyru.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6bm9wdGhqb2FxdXNhbHFveXJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMTMxMzUsImV4cCI6MjA4NjU4OTEzNX0.dzShMzcDrvnI4amVPsfPYP8BCRVJUBKAm-HyUtIIbmk';

// Cloudflare Turnstile site key (public – safe to include in client-side code).
// Replace with your production key from Cloudflare Turnstile dashboard.
// This default uses Cloudflare's public testing key.
const TURNSTILE_SITE_KEY = '1x00000000000000000000AA';

// Initialize Supabase client with error handling
let supabaseClient = null;
try {
    if (window.supabase) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
        console.warn('Supabase library not loaded. Authentication features will be disabled.');
    }
} catch (error) {
    console.error('Failed to initialize Supabase client:', error);
}

// Check if Supabase is properly configured
function isSupabaseConfigured() {
    return supabaseClient !== null && 
           SUPABASE_URL !== 'YOUR_SUPABASE_URL' && 
           SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';
}

// Paystack public key (safe to include in client-side code).
// Replace with your actual Paystack PUBLIC key from:
//   Paystack Dashboard → Settings → API Keys & Webhooks → Public Key
// Format: pk_live_xxxxx (production) or pk_test_xxxxx (test/sandbox)
const PAYSTACK_PUBLIC_KEY = 'pk_live_598132f0ebe09cef45d6f7f7286f87db57f8429e';

// Paystack subscription amount in the smallest currency unit (kobo/cents).
// 9900 = KES 99 per month  (1 KES = 100 units)
const PAYSTACK_MONTHLY_AMOUNT = 9900;

// Designated super-admin email.
// Used as a fallback when the admin_users table / is_admin() RPC is not yet set up.
const ADMIN_EMAIL = 'kesalarycalculator@gmail.com';

// Export for use in other files
window.supabaseClient = supabaseClient;
window.isSupabaseConfigured = isSupabaseConfigured;
window.ADMIN_EMAIL = ADMIN_EMAIL;
window.TURNSTILE_SITE_KEY = TURNSTILE_SITE_KEY;
window.PAYSTACK_PUBLIC_KEY = PAYSTACK_PUBLIC_KEY;
window.PAYSTACK_MONTHLY_AMOUNT = PAYSTACK_MONTHLY_AMOUNT;
