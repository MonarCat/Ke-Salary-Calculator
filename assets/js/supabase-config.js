// Supabase Configuration
// Replace these with your actual Supabase project credentials
// You can find these in your Supabase project dashboard at https://app.supabase.com

const SUPABASE_URL = 'https://wznopthjoaqusalqoyru.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6bm9wdGhqb2FxdXNhbHFveXJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMTMxMzUsImV4cCI6MjA4NjU4OTEzNX0.dzShMzcDrvnI4amVPsfPYP8BCRVJUBKAm-HyUtIIbmk';
const PASSWORD_RESET_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/password-reset`;

// Cloudflare Turnstile site key (public – safe to include in client-side code).
// Replace with your production key from Cloudflare Turnstile dashboard.
const TURNSTILE_SITE_KEY = '0x4AAAAAADLINprHdcEil0v2';

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
    const urlLooksValid = typeof SUPABASE_URL === 'string' && /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(SUPABASE_URL.trim());
    const key = typeof SUPABASE_ANON_KEY === 'string' ? SUPABASE_ANON_KEY.trim() : '';
    const keyLooksValid =
        (key.startsWith('eyJ') && key.split('.').length === 3) ||
        key.startsWith('sb_publishable_');

    return (
        supabaseClient !== null &&
        urlLooksValid &&
        keyLooksValid &&
        SUPABASE_URL !== 'YOUR_SUPABASE_URL' &&
        SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY'
    );
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
const WEB_APP_TITLE = 'My Salo';

// Inject favicon/manifest metadata once for all pages that load this shared script.
function ensureGlobalFaviconMarkup() {
    const head = document.head;
    if (!head) return;

    const items = [
        { tag: 'link', selector: 'link[rel="icon"][sizes="96x96"]', attrs: { rel: 'icon', type: 'image/png', href: '/favicon-96x96.png', sizes: '96x96' } },
        { tag: 'link', selector: 'link[rel="icon"][type="image/svg+xml"]', attrs: { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' } },
        { tag: 'link', selector: 'link[rel="shortcut icon"]', attrs: { rel: 'shortcut icon', href: '/favicon.ico' } },
        { tag: 'link', selector: 'link[rel="apple-touch-icon"][sizes="180x180"]', attrs: { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' } },
        { tag: 'meta', selector: 'meta[name="apple-mobile-web-app-title"]', attrs: { name: 'apple-mobile-web-app-title', content: WEB_APP_TITLE } },
        { tag: 'link', selector: 'link[rel="manifest"]', attrs: { rel: 'manifest', href: '/site.webmanifest' } }
    ];

    items.forEach((item) => {
        if (head.querySelector(item.selector)) return;
        const el = document.createElement(item.tag);
        Object.entries(item.attrs).forEach(([key, value]) => el.setAttribute(key, value));
        head.appendChild(el);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureGlobalFaviconMarkup);
} else {
    ensureGlobalFaviconMarkup();
}

// Export for use in other files
window.supabaseClient = supabaseClient;
window.isSupabaseConfigured = isSupabaseConfigured;
window.ADMIN_EMAIL = ADMIN_EMAIL;
window.TURNSTILE_SITE_KEY = TURNSTILE_SITE_KEY;
window.PAYSTACK_PUBLIC_KEY = PAYSTACK_PUBLIC_KEY;
window.PAYSTACK_MONTHLY_AMOUNT = PAYSTACK_MONTHLY_AMOUNT;
window.PASSWORD_RESET_FUNCTION_URL = 'https://wznopthjoaqusalqoyru.supabase.co/functions/v1/password-reset';
