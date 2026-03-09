// Supabase Configuration
// Replace these with your actual Supabase project credentials
// You can find these in your Supabase project dashboard at https://app.supabase.com

// hCaptcha site key — production key for salarycalculator.co.ke
const HCAPTCHA_SITE_KEY = '0c6634e8-ff5e-4b8c-8d2e-792633d88708';

const SUPABASE_URL = 'https://wznopthjoaqusalqoyru.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6bm9wdGhqb2FxdXNhbHFveXJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMTMxMzUsImV4cCI6MjA4NjU4OTEzNX0.dzShMzcDrvnI4amVPsfPYP8BCRVJUBKAm-HyUtIIbmk';

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

// Designated super-admin email.
// Used as a fallback when the admin_users table / is_admin() RPC is not yet set up.
const ADMIN_EMAIL = 'kesalarycalculator@gmail.com';

// Export for use in other files
window.supabaseClient = supabaseClient;
window.isSupabaseConfigured = isSupabaseConfigured;
window.ADMIN_EMAIL = ADMIN_EMAIL;
window.HCAPTCHA_SITE_KEY = HCAPTCHA_SITE_KEY;
