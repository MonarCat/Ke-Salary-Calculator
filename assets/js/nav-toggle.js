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
});
