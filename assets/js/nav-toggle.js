// Apply dark mode before paint to prevent FOUC
(function() {
    if (localStorage.getItem('darkMode') === 'on') {
        document.documentElement.classList.add('dark-mode');
        document.body && document.body.classList.add('dark-mode');
    }
})();

// Shared navigation dropdown and mobile menu toggle for all pages
document.addEventListener('DOMContentLoaded', function() {
    // Dark mode toggle (works on every page that has the toggle button)
    var darkBtn = document.getElementById('darkModeToggle');
    if (darkBtn) {
        // Sync body class (body may not exist yet when IIFE ran)
        if (localStorage.getItem('darkMode') === 'on') {
            document.body.classList.add('dark-mode');
            darkBtn.textContent = '☀️ Light';
        } else {
            darkBtn.textContent = '🌙 Dark';
        }
        darkBtn.addEventListener('click', function() {
            document.body.classList.toggle('dark-mode');
            var on = document.body.classList.contains('dark-mode');
            localStorage.setItem('darkMode', on ? 'on' : 'off');
            darkBtn.textContent = on ? '☀️ Light' : '🌙 Dark';
        });
    }
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

    // Mobile menu toggle (slide-in drawer)
    var mobileToggle = document.querySelector('.mobile-menu-toggle');
    var navDrawerOverlay = document.getElementById('navDrawerOverlay');
    if (mobileToggle) {
        function openDrawer() {
            var nav = document.querySelector('.main-nav');
            if (nav) nav.classList.add('mobile-open');
            if (navDrawerOverlay) navDrawerOverlay.classList.add('active');
            document.body.classList.add('nav-open');
            var icon = mobileToggle.querySelector('i');
            if (icon) { icon.classList.remove('fa-bars'); icon.classList.add('fa-times'); }
        }
        function closeDrawer() {
            var nav = document.querySelector('.main-nav');
            if (nav) nav.classList.remove('mobile-open');
            if (navDrawerOverlay) navDrawerOverlay.classList.remove('active');
            document.body.classList.remove('nav-open');
            var icon = mobileToggle.querySelector('i');
            if (icon) { icon.classList.remove('fa-times'); icon.classList.add('fa-bars'); }
        }
        mobileToggle.addEventListener('click', function() {
            var nav = document.querySelector('.main-nav');
            if (nav && nav.classList.contains('mobile-open')) {
                closeDrawer();
            } else {
                openDrawer();
            }
        });
        if (navDrawerOverlay) {
            navDrawerOverlay.addEventListener('click', closeDrawer);
        }
    }

    // Highlight active bottom tab based on current page
    var path = window.location.pathname;
    document.querySelectorAll('.bottom-tab-bar a').forEach(function(link) {
        if (link.getAttribute('href') === path || link.getAttribute('href') === path.replace(/\/$/, '') + '/') {
            link.classList.add('active');
        }
        if (path === '/' && link.getAttribute('href') === '/') {
            link.classList.add('active');
        }
    });

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
