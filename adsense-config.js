/**
 * Google AdSense Configuration
 * 
 * This file contains all AdSense ad unit configurations.
 * Replace the placeholder values with your actual Google AdSense codes.
 * 
 * To get your AdSense codes:
 * 1. Sign in to your Google AdSense account
 * 2. Navigate to Ads > By ad unit
 * 3. Create new ad units or copy existing ones
 * 4. Replace the placeholder scripts below
 */

// AdSense Publisher ID (data-ad-client)
const ADSENSE_PUBLISHER_ID = 'ca-pub-6832553346534070';

// Subscription tier constants
const SUBSCRIPTION_TIER_FREE = 'free';
const SUBSCRIPTION_TIER_PREMIUM = 'premium';
const SUBSCRIPTION_TIER_ENTERPRISE = 'enterprise';

// Cache duration for premium status (5 minutes)
const PREMIUM_STATUS_CACHE_DURATION = 5 * 60 * 1000;

// Ad Unit IDs
const AD_UNITS = {
    // Header banner ad (728x90 or responsive)
    HEADER_BANNER: 'XXXXXXXXXX',
    
    // Sidebar ad (300x250 or responsive)
    SIDEBAR_AD: 'XXXXXXXXXX',
    
    // In-content ad (responsive)
    IN_CONTENT_AD: 'XXXXXXXXXX',
    
    // Footer ad (728x90 or responsive)
    FOOTER_AD: 'XXXXXXXXXX',
    
    // Mobile ad (320x50 or responsive)
    MOBILE_AD: 'XXXXXXXXXX'
};

/**
 * Load AdSense script
 * This should be called once per page in the <head> section
 */
function loadAdSenseScript() {
    // Check if script already exists
    if (document.querySelector('script[src*="adsbygoogle.js"]')) {
        return;
    }
    
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUBLISHER_ID}`;
    script.crossOrigin = 'anonymous';
    document.head.appendChild(script);
}

/**
 * Insert an ad unit into the page
 * @param {string} containerId - ID of the container element
 * @param {string} adSlot - Ad unit ID from AD_UNITS
 * @param {string} adFormat - Ad format (auto, rectangle, horizontal, vertical)
 * @param {boolean} fullWidth - Whether ad should be full-width responsive
 */
function insertAdUnit(containerId, adSlot, adFormat = 'auto', fullWidth = true) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.warn(`AdSense container ${containerId} not found`);
        return;
    }
    
    // Create ad element
    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'block';
    ins.setAttribute('data-ad-client', ADSENSE_PUBLISHER_ID);
    ins.setAttribute('data-ad-slot', adSlot);
    ins.setAttribute('data-ad-format', adFormat);
    
    if (fullWidth) {
        ins.setAttribute('data-full-width-responsive', 'true');
    }
    
    container.appendChild(ins);
    
    // Push ad
    try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
        console.error('AdSense error:', e);
    }
}

/**
 * Check if the current user is a premium subscriber
 * Premium users should not see ads
 * @returns {Promise<boolean>} True if user is premium, false otherwise
 */
async function isPremiumUser() {
    // Check cache first
    const cachedStatus = checkPremiumStatusCache();
    if (cachedStatus !== null) {
        return cachedStatus;
    }
    
    // Check if Supabase is configured
    if (!window.supabaseClient || !window.isSupabaseConfigured?.()) {
        // If Supabase is not configured, show ads (default behavior)
        return false;
    }
    
    try {
        // Get current user session
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        
        if (!session || !session.user) {
            // No logged in user, show ads
            cachePremiumStatus(false);
            return false;
        }
        
        // Fetch user profile to check subscription tier
        const { data: profile, error } = await window.supabaseClient
            .from('user_profiles')
            .select('subscription_tier')
            .eq('id', session.user.id)
            .single();
        
        if (error) {
            console.warn('Could not fetch user profile, showing ads:', error);
            return false;
        }
        
        // User is premium or enterprise if subscription_tier is set to premium or enterprise
        const isPremium = profile && (
            profile.subscription_tier === SUBSCRIPTION_TIER_PREMIUM || 
            profile.subscription_tier === SUBSCRIPTION_TIER_ENTERPRISE
        );
        
        // Cache the result
        cachePremiumStatus(isPremium);
        
        return isPremium;
    } catch (error) {
        console.error('Error checking premium status:', error);
        // Default to showing ads if there's an error
        return false;
    }
}

/**
 * Cache premium status in sessionStorage
 * @param {boolean} isPremium - Whether user is premium
 */
function cachePremiumStatus(isPremium) {
    try {
        const cacheData = {
            isPremium: isPremium,
            timestamp: Date.now()
        };
        sessionStorage.setItem('premiumStatusCache', JSON.stringify(cacheData));
    } catch (error) {
        console.warn('Could not cache premium status:', error);
    }
}

/**
 * Check cached premium status
 * @returns {boolean|null} Cached premium status or null if not cached/expired
 */
function checkPremiumStatusCache() {
    try {
        const cached = sessionStorage.getItem('premiumStatusCache');
        if (!cached) {
            return null;
        }
        
        const cacheData = JSON.parse(cached);
        const age = Date.now() - cacheData.timestamp;
        
        // Return cached value if not expired
        if (age < PREMIUM_STATUS_CACHE_DURATION) {
            return cacheData.isPremium;
        }
        
        // Cache expired, remove it
        sessionStorage.removeItem('premiumStatusCache');
        return null;
    } catch (error) {
        console.warn('Error reading premium status cache:', error);
        return null;
    }
}

/**
 * Initialize all ads on the page
 * Call this after the DOM is loaded
 * Premium users will not see ads
 */
async function initializeAds() {
    // Check if user is premium
    const userIsPremium = await isPremiumUser();
    
    if (userIsPremium) {
        console.log('Premium user detected - ads will not be displayed');
        // Add premium-user class to body to hide ad containers
        document.body.classList.add('premium-user');
        return;
    }
    
    // User is not premium, load and display ads
    console.log('Free user - initializing ads');
    
    // Load AdSense script
    loadAdSenseScript();
    
    // Initialize ads based on available containers
    // Delay allows DOM to fully render and ensures proper ad placement
    setTimeout(() => {
        if (document.getElementById('adsense-header-banner')) {
            insertAdUnit('adsense-header-banner', AD_UNITS.HEADER_BANNER, 'horizontal');
        }
        
        if (document.getElementById('adsense-sidebar')) {
            insertAdUnit('adsense-sidebar', AD_UNITS.SIDEBAR_AD, 'rectangle');
        }
        
        if (document.getElementById('adsense-in-content')) {
            insertAdUnit('adsense-in-content', AD_UNITS.IN_CONTENT_AD, 'auto');
        }
        
        if (document.getElementById('adsense-footer')) {
            insertAdUnit('adsense-footer', AD_UNITS.FOOTER_AD, 'horizontal');
        }
        
        if (document.getElementById('adsense-mobile')) {
            insertAdUnit('adsense-mobile', AD_UNITS.MOBILE_AD, 'auto');
        }
    }, 100);
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAds);
} else {
    initializeAds();
}
