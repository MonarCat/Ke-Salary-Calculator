/**
 * Kenya Salary Calculator — Site Navigation & FAQ Chatbot (Salo)
 * Free, open-source, runs fully client-side (no API keys needed).
 * Uses keyword/intent matching against a built-in knowledge base.
 */

(function () {
    'use strict';

    /* ── Knowledge Base ─────────────────────────────────────────────── */
    var KB = [
        /* Greetings — highest priority, matched first */
        {
            tags: ['hello', 'hi', 'hey', 'hiya', 'howdy', 'sup', 'yo', 'greetings',
                   'good morning', 'good afternoon', 'good evening', 'good day',
                   'how are you', 'how r u', 'how are u', "what's up", 'whats up',
                   'start', 'help', 'what can you do', 'assist'],
            answer: "👋 Hello! I'm <strong>Salo</strong>, your guide to the Kenya Salary Calculator.\n\nI can help you:\n• 💰 Calculate your net salary\n• 📄 Generate a payslip\n• 📊 Understand PAYE, NSSF, SHIF & Housing Levy\n• 🗺️ Navigate any part of the site\n\nJust type your question below!",
            isGreeting: true
        },
        {
            tags: ['calculate salary', 'how to calculate', 'calculate my salary', 'salary calculator', 'compute salary'],
            answer: "To calculate your salary:\n1. Go to the <a href='/' target='_blank'>home page</a>.\n2. Enter your <strong>gross monthly salary</strong> in the input box.\n3. Select your <strong>employment type</strong> (employed / self-employed).\n4. Click <strong>Calculate</strong>.\n\nYou'll instantly see your PAYE, NSSF, SHIF, Housing Levy, and your <strong>net take-home pay</strong>. 🎉"
        },
        {
            tags: ['payslip', 'generate payslip', 'payslip generator', 'payslip download', 'create payslip'],
            answer: "You can generate a professional Kenyan payslip at our <a href='/payslip-generator-kenya.html' target='_blank'>Payslip Generator</a>.\n\nFill in your details and salary info, then download a ready-to-use payslip PDF for free!"
        },
        {
            tags: ['paye calculator', 'paye', 'income tax calculator'],
            answer: "Our dedicated <a href='/paye-calculator-kenya.html' target='_blank'>PAYE Calculator</a> shows the exact income tax deducted each month using the official <strong>KRA tax bands for 2025/2026</strong>.\n\nCurrent PAYE bands:\n• 10% on first KES 24,000\n• 25% on KES 24,001–32,333\n• 30% on KES 32,334–500,000\n• 32.5% on KES 500,001–800,000\n• 35% above KES 800,000\n\nPersonal relief is KES 2,400/month."
        },
        {
            tags: ['nssf', 'national social security', 'nssf rate', 'nssf contribution'],
            answer: "<strong>NSSF (National Social Security Fund)</strong> contribution is <strong>6% of gross salary</strong>, capped at <strong>KES 4,320 per month</strong>.\n\nBoth employee and employer contribute equally. NSSF savings go towards your pension/retirement fund."
        },
        {
            tags: ['shif', 'nhif', 'health insurance', 'social health insurance', 'shif rate'],
            answer: "<strong>SHIF (Social Health Insurance Fund)</strong> replaced NHIF in 2024.\n\nThe rate is <strong>2.75% of gross salary</strong> with no cap.\n\nSHIF covers you and your dependants for medical expenses. Learn more on our <a href='/shif-vs-nhif-kenya-2024.html' target='_blank'>SHIF vs NHIF page</a>."
        },
        {
            tags: ['housing levy', 'affordable housing', 'housing fund', 'affordable housing levy'],
            answer: "<strong>Affordable Housing Levy</strong> is <strong>1.5% of gross salary</strong>.\n\nBoth employee and employer each contribute 1.5%. The levy funds Kenya's Affordable Housing Programme.\n\nRead our full explainer: <a href='/kenya-affordable-housing-levy-explained.html' target='_blank'>Housing Levy Explained</a>."
        },
        {
            tags: ['salary comparison', 'compare salaries', 'compare salary'],
            answer: "Use our <a href='/salary-comparison.html' target='_blank'>Salary Comparison Tool</a> to compare two salaries side-by-side, see the difference in take-home pay, and understand which offer is better after all deductions."
        },
        {
            tags: ['job salaries', 'salary by job', 'doctor salary', 'engineer salary', 'teacher salary', 'salary list', 'job salary'],
            answer: "We have detailed salary pages for many Kenyan jobs! Explore them on our <a href='/salary-index.html' target='_blank'>Salary Index</a>.\n\nPopular pages:\n• <a href='/salary/doctor-kenya.html' target='_blank'>Doctor Salary in Kenya</a>\n• <a href='/salary/police-officer-kenya.html' target='_blank'>Police Officer Salary</a>\n• <a href='/salary/software-engineer-kenya.html' target='_blank'>Software Engineer Salary</a>"
        },
        {
            tags: ['salary raise', 'raise calculator', 'increment calculator', 'salary increase'],
            answer: "Use our <a href='/salary-raise-calculator.html' target='_blank'>Salary Raise Calculator</a> to see how a raise or increment affects your net take-home pay, including updated tax deductions."
        },
        {
            tags: ['global salary', 'international salary', 'usd salary', 'convert salary', 'global calculator'],
            answer: "Convert and compare Kenyan salaries to global equivalents with our <a href='/global-salary-calculator.html' target='_blank'>Global Salary Calculator</a>."
        },
        {
            tags: ['salary news', 'news', 'latest news', 'salary updates'],
            answer: "Stay updated with the latest Kenyan salary and tax news on our <a href='/salary-news.html' target='_blank'>Salary News</a> page."
        },
        {
            tags: ['blog', 'articles', 'guides', 'tips'],
            answer: "Explore our <a href='/blog.html' target='_blank'>Blog</a> for guides, tips, and articles on Kenyan salaries, tax, and personal finance."
        },
        {
            tags: ['contact', 'reach out', 'support', 'help contact', 'contact us', 'feedback'],
            answer: "You can reach the team via our <a href='/contact-us.html' target='_blank'>Contact Us</a> page. We're happy to help with any questions or feedback!"
        },
        {
            tags: ['about', 'who are you', 'about the site', 'about us'],
            answer: "Kenya Salary Calculator is a <strong>free tool</strong> that helps Kenyans understand their pay after tax.\n\nLearn more on our <a href='/about-us.html' target='_blank'>About Us</a> page."
        },
        {
            tags: ['privacy', 'data', 'privacy policy', 'gdpr', 'data protection'],
            answer: "We take your privacy seriously. Read our full <a href='/privacy-policy.html' target='_blank'>Privacy Policy</a> to understand how your data is handled."
        },
        {
            tags: ['terms', 'terms of service', 'terms and conditions', 'disclaimer'],
            answer: "Read our <a href='/terms-of-service.html' target='_blank'>Terms of Service</a> for the conditions governing use of this site."
        },
        {
            tags: ['login', 'sign in', 'account', 'sign up', 'register', 'create account'],
            answer: "You can create an account or sign in on our <a href='/auth.html' target='_blank'>Auth page</a>.\n\nAn account lets you save salary calculations, access your profile, and manage payslips."
        },
        {
            tags: ['profile', 'my account', 'my profile', 'saved calculations'],
            answer: "After logging in, visit your <a href='/profile.html' target='_blank'>Profile</a> to view saved calculations, manage your account, and access premium features."
        },
        {
            tags: ['net salary', 'take home', 'take-home pay', 'net pay'],
            answer: "Your <strong>net (take-home) salary</strong> is your gross salary minus:\n• PAYE (income tax)\n• NSSF (6%, max KES 4,320)\n• SHIF (2.75%)\n• Affordable Housing Levy (1.5%)\n\nUse the <a href='/' target='_blank'>calculator on the home page</a> to get your exact net pay instantly!"
        },
        {
            tags: ['gross salary', 'gross pay', 'before tax', 'gross income'],
            answer: "<strong>Gross salary</strong> is your total salary before any deductions (PAYE, NSSF, SHIF, Housing Levy).\n\nEnter your gross salary in the <a href='/' target='_blank'>calculator</a> to see your net take-home pay."
        },
        {
            tags: ['tax exempt', 'tax free', 'below 30000', '30000 tax', 'tax abolition'],
            answer: "Salaries <strong>at or below KES 30,000/month</strong> are <strong>exempt from PAYE</strong> under the current KRA rules.\n\nLearn more: <a href='/kenya-tax-abolition-below-30000.html' target='_blank'>Kenya Tax Abolition Below KES 30,000</a>."
        },
        {
            tags: ['statutory deductions', 'mandatory deductions', 'deductions kenya', 'payroll deductions'],
            answer: "Statutory (mandatory) payroll deductions in Kenya:\n• <strong>PAYE</strong> — income tax per KRA bands\n• <strong>NSSF</strong> — 6% (max KES 4,320/mo)\n• <strong>SHIF</strong> — 2.75%\n• <strong>Housing Levy</strong> — 1.5%\n\nFull details: <a href='/statutory-deductions-kenya.html' target='_blank'>Statutory Deductions in Kenya</a>."
        },
        {
            tags: ['negotiate salary', 'salary negotiation', 'how to negotiate'],
            answer: "Learn proven strategies to negotiate your salary in Kenya: <a href='/how-to-negotiate-salary-kenya-2025.html' target='_blank'>How to Negotiate Salary in Kenya 2025</a>."
        },
        {
            tags: ['payslip explained', 'understand payslip', 'what is on payslip', 'payslip guide'],
            answer: "Not sure what each line on your payslip means? Read: <a href='/understanding-your-kenyan-payslip.html' target='_blank'>Understanding Your Kenyan Payslip</a>."
        },
        {
            tags: ['cost of living', 'nairobi cost', 'living expenses nairobi', 'nairobi expenses'],
            answer: "Planning finances in Nairobi? Check our guide: <a href='/cost-of-living-nairobi-2025.html' target='_blank'>Cost of Living in Nairobi 2025</a>."
        },
        {
            tags: ['salary game', 'game', 'salary guess', 'quiz', 'salary quiz'],
            answer: "Have fun with our <a href='/salary-guess-game.html' target='_blank'>Salary Guess Game</a> — guess the take-home pay for different professions in Kenya! 🎮"
        },
        {
            tags: ['employees', 'employer', 'hr tool', 'bulk calculator', 'payroll'],
            answer: "HR managers and employers can use our <a href='/employees.html' target='_blank'>Employees Tool</a> to calculate payroll for multiple employees at once."
        },
        {
            tags: ['thank you', 'thanks', 'awesome', 'great', 'helpful', 'nice', 'cool', 'perfect'],
            answer: "You're very welcome! 😊 Let me know if you have any other questions about salaries, taxes, or the site."
        },
        {
            tags: ['bye', 'goodbye', 'see you', 'exit', 'close', 'later', 'ciao', 'ttyl'],
            answer: "Goodbye! 👋 Come back anytime you need help understanding your Kenyan salary. Have a great day! 🇰🇪"
        }
    ];

    /* ── Helpers ─────────────────────────────────────────────────────── */
    function normalise(text) {
        return text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    /* Check if a whole word exists in text using word boundaries.
     * The replace pattern is the standard MDN regex-escape approach:
     * [.*+?^${}()|[\]\\] matches all regex special characters. */
    function containsWord(text, word) {
        var re = new RegExp('(?:^|\\s)' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:\\s|$)');
        return re.test(text);
    }

    /* Minimum score a KB entry must reach to be considered a match */
    var MIN_SCORE_THRESHOLD = 2;
    /* Maximum input length (chars) that can be classified as a short greeting */
    var MAX_SHORT_GREETING_LENGTH = 30;

    function findAnswer(input) {
        var q = normalise(input);

        /* ── Step 1: Pure greeting detection ───────────────────────── */
        /* If the entire message is a simple greeting phrase, answer immediately */
        var pureGreetings = ['hi', 'hey', 'hello', 'hiya', 'howdy', 'sup', 'yo',
                             'good morning', 'good afternoon', 'good evening', 'good day',
                             'how are you', 'how r u', 'how are u', "what's up", 'whats up',
                             'greetings'];
        for (var g = 0; g < pureGreetings.length; g++) {
            if (q === pureGreetings[g]) {
                return KB[0].answer;
            }
        }
        /* Short message that starts with a greeting word */
        var greetingStarters = ['hi ', 'hey ', 'hello ', 'hiya '];
        if (q.length < MAX_SHORT_GREETING_LENGTH) {
            for (var gs = 0; gs < greetingStarters.length; gs++) {
                if (q.indexOf(greetingStarters[gs]) === 0) {
                    return KB[0].answer;
                }
            }
        }

        /* ── Step 2: Scored matching ────────────────────────────────── */
        var bestScore = 0;
        var bestAnswer = null;

        for (var i = 0; i < KB.length; i++) {
            var entry = KB[i];
            var score = 0;
            for (var j = 0; j < entry.tags.length; j++) {
                var tag = entry.tags[j];
                if (q === tag) {
                    score += 10;                        // exact full match
                } else if (q.indexOf(tag) !== -1) {
                    /* Phrase is contained in query */
                    score += tag.split(' ').length > 1 ? 5 : 3;
                } else {
                    /* Word-level matching using whole-word boundaries */
                    var tagWords = tag.split(' ');
                    for (var k = 0; k < tagWords.length; k++) {
                        var tw = tagWords[k];
                        if (tw.length > 3 && containsWord(q, tw)) {
                            score += 2;
                        }
                    }
                }
            }
            if (score > bestScore) {
                bestScore = score;
                bestAnswer = entry.answer;
            }
        }

        /* Require a meaningful match threshold */
        if (bestScore >= MIN_SCORE_THRESHOLD) return bestAnswer;

        return "I'm not sure about that yet, but I'm always learning! 🤔\n\nYou can try:\n• Rephrasing your question\n• Visiting our <a href='/contact-us.html' target='_blank'>Contact page</a> for direct support\n• Browsing the <a href='/' target='_blank'>home page</a> for all tools";
    }

    /* ── Salo Avatar SVG ─────────────────────────────────────────────── */
    var SALO_AVATAR = '<svg class="salo-avatar-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" aria-hidden="true">' +
        '<circle cx="24" cy="24" r="24" fill="#1a4a2e"/>' +
        /* Head */
        '<circle cx="24" cy="18" r="10" fill="#d4956a"/>' +
        /* Hair — short, dark, professional */
        '<path d="M14 18 C14 7 34 7 34 18 C31 12 24 11 17 13Z" fill="#1a0f08"/>' +
        /* Ears */
        '<ellipse cx="14" cy="18" rx="2.2" ry="3" fill="#c4855a"/>' +
        '<ellipse cx="34" cy="18" rx="2.2" ry="3" fill="#c4855a"/>' +
        /* Eyes */
        '<ellipse cx="20" cy="17" rx="1.5" ry="1.8" fill="#1a0f08"/>' +
        '<ellipse cx="28" cy="17" rx="1.5" ry="1.8" fill="#1a0f08"/>' +
        /* Eyebrows */
        '<path d="M17.5 14 Q20 13 22.5 14" stroke="#1a0f08" stroke-width="1.2" fill="none" stroke-linecap="round"/>' +
        '<path d="M25.5 14 Q28 13 30.5 14" stroke="#1a0f08" stroke-width="1.2" fill="none" stroke-linecap="round"/>' +
        /* Nose */
        '<path d="M22.5 19 Q24 21.5 25.5 19" stroke="#a06040" stroke-width="1" fill="none" stroke-linecap="round"/>' +
        /* Smile */
        '<path d="M20 22 Q24 25 28 22" stroke="#a06040" stroke-width="1.2" fill="none" stroke-linecap="round"/>' +
        /* Suit body */
        '<path d="M8 48 Q8 34 24 34 Q40 34 40 48Z" fill="#1a3a5c"/>' +
        /* White shirt/collar */
        '<path d="M21 34 L24 39 L27 34" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linejoin="round"/>' +
        /* Tie */
        '<path d="M24 38 L22 44 L24 42 L26 44Z" fill="#b22222"/>' +
        '</svg>';

    /* ── Render Chat Widget ──────────────────────────────────────────── */
    function createWidget() {
        var html = [
            '<div id="kazi-chat-btn" role="button" aria-label="Open chat assistant" tabindex="0">',
            '  <span class="kazi-btn-icon">' + SALO_AVATAR + '</span>',
            '  <span class="kazi-btn-label">Chat with Salo</span>',
            '</div>',
            '<div id="kazi-chat-box" role="dialog" aria-label="Salo chat assistant" aria-hidden="true">',
            '  <div id="kazi-chat-header">',
            '    <span class="salo-header-identity">',
            '      <span class="salo-header-avatar">' + SALO_AVATAR + '</span>',
            '      <span class="salo-header-info"><strong>Salo</strong><span class="salo-status">● Online</span></span>',
            '    </span>',
            '    <button id="kazi-chat-close" aria-label="Close chat">&#10005;</button>',
            '  </div>',
            '  <div id="kazi-chat-messages" aria-live="polite" aria-atomic="false"></div>',
            '  <div id="kazi-chat-suggestions"></div>',
            '  <div id="kazi-chat-input-area">',
            '    <input id="kazi-chat-input" type="text" placeholder="Ask me anything…" autocomplete="off" maxlength="200" />',
            '    <button id="kazi-chat-send" aria-label="Send message">&#10148;</button>',
            '  </div>',
            '</div>'
        ].join('');

        var wrapper = document.createElement('div');
        wrapper.id = 'kazi-widget';
        wrapper.innerHTML = html;
        document.body.appendChild(wrapper);
    }

    function appendMessage(role, text) {
        var messages = document.getElementById('kazi-chat-messages');
        var msg = document.createElement('div');
        msg.className = 'kazi-msg kazi-msg-' + role;
        if (role === 'bot') {
            msg.innerHTML = text.replace(/\n/g, '<br>');
        } else {
            msg.textContent = text;
        }
        messages.appendChild(msg);
        messages.scrollTop = messages.scrollHeight;
    }

    function showTypingIndicator() {
        var messages = document.getElementById('kazi-chat-messages');
        var indicator = document.createElement('div');
        indicator.className = 'kazi-msg kazi-msg-bot kazi-typing';
        indicator.id = 'kazi-typing';
        indicator.innerHTML = '<span></span><span></span><span></span>';
        messages.appendChild(indicator);
        messages.scrollTop = messages.scrollHeight;
    }

    function removeTypingIndicator() {
        var el = document.getElementById('kazi-typing');
        if (el) el.parentNode.removeChild(el);
    }

    var suggestions = [
        'Calculate my salary',
        'What is PAYE?',
        'NSSF contribution',
        'Generate a payslip',
        'SHIF rate',
        'Housing Levy',
        'Job salaries in Kenya',
        'Salary comparison'
    ];

    function renderSuggestions() {
        var container = document.getElementById('kazi-chat-suggestions');
        container.innerHTML = '';
        for (var i = 0; i < suggestions.length; i++) {
            (function (text) {
                var chip = document.createElement('button');
                chip.className = 'kazi-chip';
                chip.textContent = text;
                chip.addEventListener('click', function () {
                    handleUserInput(text);
                });
                container.appendChild(chip);
            })(suggestions[i]);
        }
    }

    function handleUserInput(text) {
        text = text.trim();
        if (!text) return;

        // Clear input if came from text box
        var input = document.getElementById('kazi-chat-input');
        if (input) input.value = '';

        // Hide suggestion chips after first interaction
        var sugg = document.getElementById('kazi-chat-suggestions');
        if (sugg) sugg.style.display = 'none';

        appendMessage('user', text);
        showTypingIndicator();

        // Simulate brief thinking delay for natural feel
        setTimeout(function () {
            removeTypingIndicator();
            var answer = findAnswer(text);
            appendMessage('bot', answer);
        }, 500);
    }

    function openChat() {
        var box = document.getElementById('kazi-chat-box');
        var btn = document.getElementById('kazi-chat-btn');
        if (box) {
            box.classList.add('kazi-open');
            box.setAttribute('aria-hidden', 'false');
        }
        if (btn) btn.classList.add('kazi-active');
        var input = document.getElementById('kazi-chat-input');
        if (input) input.focus();
    }

    function closeChat() {
        var box = document.getElementById('kazi-chat-box');
        var btn = document.getElementById('kazi-chat-btn');
        if (box) {
            box.classList.remove('kazi-open');
            box.setAttribute('aria-hidden', 'true');
        }
        if (btn) btn.classList.remove('kazi-active');
    }

    function initChatbot() {
        createWidget();
        renderSuggestions();

        // Greeting message
        appendMessage('bot', KB[0].answer);

        // Toggle button
        var toggleBtn = document.getElementById('kazi-chat-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', function () {
                var box = document.getElementById('kazi-chat-box');
                if (box && box.classList.contains('kazi-open')) {
                    closeChat();
                } else {
                    openChat();
                }
            });
            toggleBtn.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleBtn.click();
                }
            });
        }

        // Close button
        var closeBtn = document.getElementById('kazi-chat-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeChat);
        }

        // Send button
        var sendBtn = document.getElementById('kazi-chat-send');
        if (sendBtn) {
            sendBtn.addEventListener('click', function () {
                var input = document.getElementById('kazi-chat-input');
                if (input) handleUserInput(input.value);
            });
        }

        // Enter key in input
        var inputEl = document.getElementById('kazi-chat-input');
        if (inputEl) {
            inputEl.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleUserInput(inputEl.value);
                }
            });
        }

        // Close on Escape key
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                var box = document.getElementById('kazi-chat-box');
                if (box && box.classList.contains('kazi-open')) closeChat();
            }
        });
    }

    /* ── Bootstrap ───────────────────────────────────────────────────── */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initChatbot);
    } else {
        initChatbot();
    }
})();
