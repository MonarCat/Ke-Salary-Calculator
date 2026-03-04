// Generic donate section helpers used on pages that don't include script.js

function toggleDonateInfoById(sectionId) {
    var info = document.getElementById(sectionId);
    if (info) {
        info.style.display = info.style.display === 'none' ? 'block' : 'none';
    }
}

function selectDonateMethodById(prefix, method) {
    var paypalDiv = document.getElementById(prefix + '-paypal');
    var mobileDiv = document.getElementById(prefix + '-mobile');
    if (!paypalDiv || !mobileDiv) return;
    if (method === 'paypal') {
        paypalDiv.style.display = '';
        mobileDiv.style.display = 'none';
    } else {
        paypalDiv.style.display = 'none';
        mobileDiv.style.display = '';
    }
    var container = paypalDiv.closest('.donate-info');
    if (container) {
        container.querySelectorAll('.donate-method-tab').forEach(function(btn) {
            btn.classList.toggle('active', btn.dataset.method === method);
        });
    }
}

function copyDonatePhone(btn, number) {
    function selectFallback() {
        var span = btn.previousElementSibling;
        if (span) {
            var range = document.createRange();
            range.selectNodeContents(span);
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(number).then(function() {
            var original = btn.innerHTML;
            btn.innerHTML = '✓';
            btn.classList.add('copied');
            setTimeout(function() { btn.innerHTML = original; btn.classList.remove('copied'); }, 2000);
        }).catch(selectFallback);
    } else {
        selectFallback();
    }
}
