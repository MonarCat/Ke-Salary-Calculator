// assets/js/format-utils.js
// Shared formatting helpers exposed via window.FormatUtils

(function () {
    'use strict';

    function formatKES(amount) {
        const n = Math.round(parseFloat(amount) || 0);
        return 'KES ' + n.toLocaleString('en-KE');
    }

    function formatPct(value) {
        return (parseFloat(value) || 0).toFixed(1) + '%';
    }

    function monthLabel(dateOrStr) {
        const d = dateOrStr instanceof Date ? dateOrStr : new Date(dateOrStr);
        return d.toLocaleDateString('en-KE', { month: 'long', year: 'numeric' });
    }

    function shortMonthLabel(dateOrStr) {
        const d = dateOrStr instanceof Date ? dateOrStr : new Date(dateOrStr);
        return d.toLocaleDateString('en-KE', { month: 'short', year: 'numeric' });
    }

    function firstOfMonth(year, month) {
        return new Date(year, month - 1, 1);
    }

    window.FormatUtils = { formatKES, formatPct, monthLabel, shortMonthLabel, firstOfMonth };
})();
