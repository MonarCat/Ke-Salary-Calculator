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
 * Initialize all ads on the page
 * Call this after the DOM is loaded
 */
function initializeAds() {
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
