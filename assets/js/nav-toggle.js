// Google Analytics 4 — replace the placeholder below with your GA4 Measurement ID.
// Steps: 1) Go to analytics.google.com  2) Create/open your property
//        3) Admin > Data Streams > your stream > Measurement ID (format: G-XXXXXXXXXX)
//        4) Replace 'G-XXXXXXXXXX' below with that ID and save this file.
(function() {
    var GA4_MEASUREMENT_ID = 'G-XXXXXXXXXX';
    if (!GA4_MEASUREMENT_ID || GA4_MEASUREMENT_ID === 'G-XXXXXXXXXX') return;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_MEASUREMENT_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', GA4_MEASUREMENT_ID);
})();

// Shared navigation dropdown and mobile menu toggle for all pages
document.addEventListener('DOMContentLoaded', function() {
    // Handle dropdown toggles
    var dropdownToggles = document.querySelectorAll('.nav-dropdown-toggle');
    dropdownToggles.forEach(function(toggle) {
        toggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            var dropdown = this.closest('.nav-dropdown');
            document.querySelectorAll('.nav-dropdown').forEach(function(d) {
                if (d !== dropdown) d.classList.remove('open');
            });
            dropdown.classList.toggle('open');
        });
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.nav-dropdown')) {
            document.querySelectorAll('.nav-dropdown').forEach(function(d) { d.classList.remove('open'); });
        }
    });

    // Mobile menu toggle
    var mobileToggle = document.querySelector('.mobile-menu-toggle');
    if (mobileToggle) {
        mobileToggle.addEventListener('click', function() {
            var nav = document.querySelector('.main-nav');
            nav.classList.toggle('mobile-open');
            var icon = mobileToggle.querySelector('i');
            if (icon) {
                icon.classList.toggle('fa-bars');
                icon.classList.toggle('fa-times');
            }
        });
    }

    // Scroll to Top button
    var scrollBtn = document.getElementById('scrollToTop');
    if (scrollBtn) {
        window.addEventListener('scroll', function() {
            if (window.scrollY > 300) {
                scrollBtn.classList.add('visible');
            } else {
                scrollBtn.classList.remove('visible');
            }
        });
        scrollBtn.addEventListener('click', function() {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
});
