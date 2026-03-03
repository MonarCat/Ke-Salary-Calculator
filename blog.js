// Blog JavaScript Functions

// Current user ID for comment editing
let _currentUserId = null;
// Current post comments cache for re-rendering after auth resolves
let _currentPostComments = [];
// Comment reactions cache keyed by comment ID
let _currentCommentReactions = {};
// Reactions realtime subscription reference for cleanup
let _reactionsSubscription = null;
// Comment reactions realtime subscription reference for cleanup
let _commentReactionsSubscription = null;
// Comments realtime subscription reference for cleanup
let _commentsSubscription = null;
// Whether the current post is a fallback (not from DB)
let _isUsingFallback = false;
// Current post ID (real UUID when loaded from DB)
let _currentPostId = null;
// Reference to the emoji picker outside-click handler for cleanup
let _emojiPickerCloseHandler = null;
// Ensure beforeunload cleanup is registered only once
let _beforeunloadRegistered = false;

// Helper function to check if Supabase is configured
function isSupabaseConfigured() {
    return window.supabaseClient !== null && 
           window.supabaseClient !== undefined &&
           typeof window.isSupabaseConfigured === 'function' &&
           window.isSupabaseConfigured();
}

// Helper: race a Supabase query promise against a timeout so the page never
// hangs indefinitely when the database is slow or unreachable.
// The timer is always cleared (win or lose) to avoid lingering callbacks.
function withTimeout(promise, ms) {
    let timerId;
    const timeout = new Promise((_, reject) => {
        timerId = setTimeout(() => reject(new Error('Database request timed out')), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timerId));
}

// Safely escape HTML to prevent XSS when rendering user-supplied text
function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Render comment text: HTML-escaped then simple markdown applied
function renderCommentText(text) {
    const escaped = escapeHtml(text);
    return escaped
        .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+?)\*/g, '<em>$1</em>');
}

// Check if a string is a valid UUID (real DB post IDs are UUIDs)
function isValidUUID(str) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// Scroll to Top Button
function initScrollButton() {
    const scrollBtn = document.getElementById('scrollToTop');
    if (!scrollBtn) return;

    // Show/hide button based on scroll position
    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 300) {
            scrollBtn.classList.add('show');
        } else {
            scrollBtn.classList.remove('show');
        }
    });

    // Scroll to top when clicked
    scrollBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

// Toast Notification
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast') || createToast();
    toast.textContent = message;
    toast.className = `toast-notification ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function createToast() {
    const toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast-notification';
    document.body.appendChild(toast);
    return toast;
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

// Format relative time
function formatRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return formatDate(dateString);
}

// Get user initials for avatar
function getUserInitials(name) {
    if (!name) return 'A';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

// Fallback blog posts when database is unavailable
const fallbackBlogPosts = [
    {
        id: 'post-1',
        title: 'Understanding PAYE in Kenya: A Comprehensive Guide for Employees and Employers',
        slug: 'understanding-paye-kenya-comprehensive-guide',
        excerpt: 'In the bustling economic landscape of Kenya, where every shilling counts, navigating the intricacies of Pay As You Earn (PAYE) can feel like decoding a secret language. Master PAYE to ensure financial clarity and compliance in 2026.',
        content: '<p>In the bustling economic landscape of Kenya, where every shilling counts, navigating the intricacies of Pay As You Earn (PAYE) can feel like decoding a secret language. But fear not! Whether you\'re an ambitious employee eyeing your next paycheck or a savvy employer streamlining payroll, mastering PAYE is your ticket to financial clarity and compliance. Let\'s dive deep into what PAYE really means, how it\'s calculated, and why it\'s a game-changer for your wallet in 2026.</p><h3>What is PAYE and Why Does It Matter?</h3><p>PAYE, or Pay As You Earn, is Kenya\'s income tax system administered by the Kenya Revenue Authority (KRA). It\'s not just a deduction—it\'s a structured way to ensure taxes are paid progressively based on your earnings. Introduced to promote fairness, PAYE ensures that higher earners contribute more, while providing relief for lower-income brackets. In 2026, with economic shifts like inflation and new levies, understanding PAYE isn\'t optional; it\'s essential for avoiding penalties and maximizing your net salary.</p><p>Imagine this: You\'re a mid-level manager in Nairobi earning KSh 100,000 monthly. Without grasping PAYE, you might be shocked by deductions eating into your take-home pay. But with knowledge, you can plan ahead, claim reliefs, and even negotiate better packages.</p><h3>Breaking Down the PAYE Tax Bands for 2026</h3><p>KRA updates tax bands periodically to reflect economic realities. Here\'s the latest scoop for 2026, including proposed changes:</p><ul><li><strong>Up to KSh 24,000 monthly</strong>: 10% tax rate (after personal relief).</li><li><strong>KSh 24,001 to KSh 32,333</strong>: 25%.</li><li><strong>KSh 32,334 to KSh 500,000 annually</strong>: 30%.</li><li><strong>KSh 500,001 to KSh 800,000</strong>: 32.5%.</li><li><strong>Over KSh 800,000</strong>: 35%.</li></ul><p>A new proposal aims to expand the lowest band to KSh 30,000 at 10%, introduce 25% for KSh 30,001-50,000, and keep 30% above, potentially increasing personal relief to KSh 3,000 monthly. Don\'t forget the current personal relief of KSh 2,400 per month, which reduces your taxable income. For instance, if your gross is KSh 50,000:</p><ul><li>Taxable income: KSh 50,000 - KSh 2,400 = KSh 47,600.</li><li>Tax: 10% on first KSh 24,000 = KSh 2,400; 25% on next KSh 8,333 = KSh 2,083; 30% on remaining KSh 15,267 ≈ KSh 4,580.</li><li>Total PAYE: Around KSh 9,063.</li></ul><p><strong>Pro tip:</strong> Use our free PAYE calculator on <a href="/calculator.html" style="color: #006600;">salarycalculator.co.ke</a> to crunch these numbers instantly—no math degree required!</p><h3>Other Deductions That Dance with PAYE</h3><p>PAYE doesn\'t party alone. It mingles with:</p><ul><li><strong>NSSF (National Social Security Fund)</strong>: Tier I (KSh 400 employee + employer) and Tier II (up to 6% of pensionable pay).</li><li><strong>NHIF (National Hospital Insurance Fund)</strong>: Scaled from KSh 150 to KSh 1,700 based on salary.</li><li><strong>Housing Levy</strong>: 1.5% from employee and employer, aimed at affordable housing initiatives.</li><li><strong>SHIF (Social Health Insurance Fund)</strong>: The new kid on the block, replacing NHIF with broader coverage at 2.75% of gross, capped at KSh 5,000.</li></ul><p>These add up, but they\'re investments in your future—pensions, health, and housing security.</p><h3>Tips to Minimize PAYE Legally</h3><p>Want to keep more in your pocket? Here\'s how:</p><ol><li><strong>Claim All Reliefs</strong>: Insurance relief (up to 15% of premiums), mortgage interest relief, and disability exemptions.</li><li><strong>Pension Contributions</strong>: Voluntary schemes like RBA-approved funds reduce taxable income.</li><li><strong>Salary Structuring</strong>: Opt for allowances (e.g., housing, transport) that might be tax-exempt.</li><li><strong>Stay Updated</strong>: KRA\'s iTax portal is your best friend for filing returns and avoiding underpayments.</li></ol><p>Employers, automate this with our <a href="/payslip-generator-kenya.html" style="color: #006600;">payslip generator</a> to ensure 100% compliance and happy teams.</p><h3>Common PAYE Pitfalls and How to Avoid Them</h3><ul><li><strong>Under-declaration</strong>: Leads to hefty fines—up to 200% of the tax due.</li><li><strong>Ignoring Deadlines</strong>: Monthly remittances by the 9th; annual returns by June 30th.</li><li><strong>Miscalculating Reliefs</strong>: Always double-check with tools like ours.</li></ul><p>In a nutshell, PAYE is the backbone of Kenya\'s tax system, ensuring equitable contributions while funding national development. By staying informed and using smart tools, you can turn tax season from a headache into a high-five moment. Ready to calculate yours? Head to <a href="/calculator.html" style="color: #006600;">salarycalculator.co.ke</a> and let\'s make your salary work harder for you!</p>',
        featured_image_url: 'kenyan-economy-coins.jpg',
        secondary_image_url: 'nairobi_wh10.jpg',
        author_name: 'Admin',
        views_count: 0,
        published_at: '2026-02-15T08:00:00Z',
        status: 'published'
    },
    {
        id: 'post-2',
        title: 'Maximize Your Take-Home Pay: 7 Proven Strategies for Kenyan Workers in 2026',
        slug: 'maximize-take-home-pay-strategies-2026',
        excerpt: 'In a world where living costs in Kenya are skyrocketing, who wouldn\'t want to squeeze every extra shilling from their salary? Discover seven actionable strategies to boost your take-home pay without breaking the law.',
        content: '<p>In a world where living costs in Kenya are skyrocketing—from matatu fares in Nairobi to unga prices in Kisumu—who wouldn\'t want to squeeze every extra shilling from their salary? Your gross pay is just the starting line; the real race is to the net amount hitting your M-Pesa. Buckle up as we unveil seven catchy, actionable strategies to boost your take-home pay without breaking a sweat (or the law).</p><h3>1. Master Tax Reliefs Like a Pro</h3><p>Kenya\'s tax code is packed with hidden gems. Claim personal relief (KSh 28,800 annually), insurance relief (up to KSh 60,000 for health premiums), and even savings relief for deposits in registered schemes. Example: If you\'re paying KSh 5,000 monthly for medical insurance, that\'s KSh 750 back in your pocket via reduced PAYE. Use our <a href="/calculator.html" style="color: #006600;">calculator</a> to simulate savings!</p><h3>2. Negotiate Smart Salary Packages</h3><p>Don\'t just accept the base salary—ask for tax-friendly perks. Housing allowances (up to KSh 3,000 tax-free), car benefits, or meal vouchers can pad your net without inflating taxes. In 2026, with remote work booming, negotiate internet reimbursements too. Pro tip: Research industry averages on sites like Glassdoor to back your ask.</p><h3>3. Contribute to Retirement Funds</h3><p>Pumping money into NSSF or private pensions isn\'t just future-proofing; it\'s tax-deductible up to KSh 20,000 monthly. That\'s instant savings on PAYE. Imagine deferring taxes while building a nest egg—win-win!</p><h3>4. Track and Deduct Business Expenses</h3><p>Freelancers and side-hustlers, rejoice! Home office setups, travel costs, and professional development can be deducted if self-employed. Keep receipts and file accurately via iTax to reclaim what\'s yours.</p><h3>5. Optimize Deduction Timing</h3><p>Time bonuses or allowances to fall in lower tax brackets. For high earners, spreading income across years can drop you from 30% to 25% bands.</p><h3>6. Stay Ahead of Statutory Changes</h3><p>2026 brings SHIF fully online, potentially altering deductions. Subscribe to KRA updates or our blog for alerts. Knowledge is power—and extra pay!</p><h3>7. Use Tech Tools for Precision</h3><p>Ditch spreadsheets; our free <a href="/payslip-generator-kenya.html" style="color: #006600;">payslip generator</a> and <a href="/calculator.html" style="color: #006600;">salary calculator</a> ensure error-free computations, spotting over-deductions instantly.</p><p>Implementing these could add thousands to your monthly net. Take Jane, a teacher in Mombasa: By claiming reliefs and restructuring her package, she boosted her take-home by 15%. Your turn—calculate your potential at salarycalculator.co.ke and start maximizing today!</p>',
        featured_image_url: 'by wirestock on Freepik.jpg',
        secondary_image_url: 'kenyan-economy-coins.jpg',
        author_name: 'Admin',
        views_count: 0,
        published_at: '2026-02-16T10:30:00Z',
        status: 'published'
    },
    {
        id: 'post-3',
        title: '2026 Tax Law Updates: What Kenyan Salaried Workers Need to Know Now',
        slug: '2026-tax-law-updates-kenya',
        excerpt: 'Tax laws in Kenya evolve faster than Nairobi traffic. With Finance Bill tweaks, new levies, and digital shifts in 2026, staying updated isn\'t just smart—it\'s profitable.',
        content: '<p>Tax laws in Kenya evolve faster than Nairobi traffic, and 2026 is no exception. With Finance Bill tweaks, new levies, and digital shifts, staying updated isn\'t just smart—it\'s profitable. This article breaks down the must-know changes, their impact on your salary, and how to adapt for a smoother financial ride.</p><h3>Key Changes in the 2026 Finance Act</h3><ul><li><strong>PAYE Bands Adjustment</strong>: Thresholds rise slightly to account for inflation—first band now up to KSh 25,000 at 10%, easing burden on low earners. Proposed expansions to KSh 30,000 at 10% and a new 25% for up to KSh 50,000.</li><li><strong>SHIF Rollout</strong>: Replacing NHIF, contributions start at 2.75% of gross salary, capped at KSh 5,000 monthly, with better benefits like outpatient coverage.</li><li><strong>Housing Levy Tweaks</strong>: Now 1.5% matched, but exemptions for low-income housing loans.</li><li><strong>Digital Tax Services</strong>: Mandatory e-filing for all, with AI audits for discrepancies via eTIMS validation starting January 2026.</li></ul><h3>Impact on Your Paycheck</h3><p>For an average KSh 60,000 earner:</p><ul><li>Old NHIF: KSh 1,200.</li><li>New SHIF: ~KSh 1,650.</li><li>But expanded reliefs offset this for many.</li></ul><p>High earners face stiffer penalties for non-compliance, up to KSh 100,000 fines.</p><h3>How to Prepare and Save</h3><ol><li><strong>Update Your Details</strong>: Link your PIN to SHIF portal ASAP.</li><li><strong>Review Contracts</strong>: Ensure employers adjust for new bands.</li><li><strong>Seek Professional Advice</strong>: For complex cases, consult a tax expert.</li><li><strong>Leverage Tools</strong>: Our <a href="/paye-calculator-kenya.html" style="color: #006600;">PAYE calculator</a> incorporates all 2026 updates—test scenarios free!</li></ol><p>These changes aim for equity and efficiency, funding infrastructure like the SGR extensions. Don\'t get caught off-guard; plug in your details at <a href="/calculator.html" style="color: #006600;">salarycalculator.co.ke</a> and sail through tax season unscathed.</p>',
        featured_image_url: 'nairobi_wh10.jpg',
        secondary_image_url: 'giraffe-wild.jpg',
        author_name: 'Admin',
        views_count: 0,
        published_at: '2026-02-17T09:15:00Z',
        status: 'published'
    },
    {
        id: 'post-4',
        title: 'Salary Negotiation Tips: How to Ask for More in Kenya\'s Competitive Job Market',
        slug: 'salary-negotiation-tips-kenya-2026',
        excerpt: 'In Kenya\'s cutthroat job scene, nailing salary negotiations can transform your career trajectory. Empower yourself with these tips to demand what you\'re worth in 2026.',
        content: '<p>In Kenya\'s cutthroat job scene, where talent is abundant but opportunities are golden, nailing salary negotiations can transform your career trajectory. Gone are the days of accepting the first offer—empower yourself with these catchy tips to demand (and get) what you\'re worth in 2026.</p><h3>Prep Like a Boss</h3><p>Research is key: Use platforms like MyJobMag or BrighterMonday for salary benchmarks. Know your value—factor in experience, skills, and location (Nairobi pays 20% more than rural areas).</p><h3>Timing is Everything</h3><p>Negotiate after a job offer, not during interviews. Leverage performance reviews for raises.</p><h3>Craft Your Pitch</h3><ul><li>Highlight achievements: "I increased sales by 30%—that\'s worth KSh X more."</li><li>Bundle requests: Salary + benefits like flexible hours.</li><li>Be flexible: If no to cash, yes to training or bonuses.</li></ul><h3>Handle Objections Gracefully</h3><p>If they say "budget constraints," counter with "What about performance-based incentives?"</p><h3>Cultural Nuances in Kenya</h3><p>Build rapport—Kenyans value relationships. Use polite language: "I\'d appreciate if we could discuss..."</p><p>Success story: Alex, an IT specialist, negotiated a 25% hike by presenting data. You can too! Simulate your ideal salary with our <a href="/calculator.html" style="color: #006600;">calculator</a> at salarycalculator.co.ke and step into negotiations armed and confident.</p>',
        featured_image_url: 'JT Banner Gemini_Generated_Image_.png',
        secondary_image_url: 'nairobi_wh10.jpg',
        author_name: 'Admin',
        views_count: 0,
        published_at: '2026-02-18T11:00:00Z',
        status: 'published'
    },
    {
        id: 'post-5',
        title: 'Why Every Kenyan Business Needs a Payslip Generator in 2026',
        slug: 'why-kenyan-business-needs-payslip-generator',
        excerpt: 'From bustling startups in Westlands to established firms in Industrial Area, payroll mishaps can derail your success. Discover why a payslip generator is indispensable in 2026.',
        content: '<p>In the fast-paced world of Kenyan entrepreneurship, from bustling startups in Westlands to established firms in Industrial Area, payroll mishaps can derail your success. Enter the payslip generator: your secret weapon for compliance, efficiency, and employee satisfaction. Discover why it\'s indispensable and how ours at salarycalculator.co.ke revolutionizes your operations.</p><h3>The Pain of Manual Payroll</h3><p>Errors in calculations lead to disputes, fines (KRA penalties up to 25%), and low morale. Manual processes waste hours better spent growing your business.</p><h3>Benefits of Automation</h3><ul><li><strong>Accuracy</strong>: Auto-computes PAYE, NSSF, SHIF—always up-to-date.</li><li><strong>Compliance</strong>: Generates KRA-compliant slips, reducing audit risks with eTIMS integration.</li><li><strong>Efficiency</strong>: Batch processing for teams; email delivery.</li><li><strong>Insights</strong>: Analytics on labor costs for better budgeting.</li></ul><h3>Real-World Wins</h3><p>A Nairobi retailer cut payroll time by 70% using our tool, saving KSh 50,000 annually.</p><h3>Getting Started</h3><p>Free to use, customizable, and secure. Integrate with HR software for seamless ops.</p><p>Don\'t let payroll bog you down—elevate your business with our <a href="/payslip-generator-kenya.html" style="color: #006600;">generator</a> today at salarycalculator.co.ke. Your team (and bottom line) will thank you!</p>',
        featured_image_url: 'kenyan-economy-coins.jpg',
        secondary_image_url: 'by wirestock on Freepik.jpg',
        author_name: 'Admin',
        views_count: 0,
        published_at: '2026-02-18T14:45:00Z',
        status: 'published'
    },
    {
        id: 'post-6',
        title: 'Proposed PAYE Exemption for Earnings Below KSh 30,000: A Game-Changer for Low-Income Kenyans?',
        slug: 'paye-exemption-below-30000-proposal',
        excerpt: 'Treasury CS John Mbadi has proposed exempting PAYE for individuals earning less than KSh 30,000 monthly. This reform could put more money back into the pockets of over 1.5 million low-wage earners.',
        content: '<p>In a bold move to alleviate financial pressures on Kenya\'s working class, Treasury Cabinet Secretary John Mbadi has proposed exempting PAYE for individuals earning less than KSh 30,000 monthly. Announced in early February 2026 and backed by President William Ruto, this reform aims to put more money back into the pockets of over 1.5 million low-wage earners amid rising living costs. But what does it really mean, and will it pass Parliament? Let\'s unpack the details.</p><h3>The Core of the Proposal</h3><p>Under the Tax Laws (Amendment) Bill 2026, workers earning KSh 30,000 or below would pay zero PAYE, effectively increasing their take-home pay by up to KSh 731 per month for those at the threshold. Additionally, those in the KSh 30,001-50,000 bracket would see their tax rate drop from 30% to 25%, adding about KSh 2,500 monthly to their net salary. The personal relief could also rise from KSh 2,400 to KSh 3,000, further cushioning the blow.</p><p>This initiative, as stated by CS Mbadi, targets equitable taxation: "Anybody earning KSh 30,000 and below in Kenya should not pay PAYE. You pay zero." President Ruto has emphasized its role in easing the cost of living, with the proposal set for parliamentary debate soon.</p><h3>Potential Impacts and Benefits</h3><ul><li><strong>For Employees</strong>: Low earners could see a net increase of KSh 1,361 after offsets like NSSF hikes, providing relief for essentials like food and transport.</li><li><strong>For the Economy</strong>: More disposable income could boost consumer spending, stimulating small businesses and growth.</li><li><strong>Challenges</strong>: Critics argue it might not fully offset other deductions, and revenue loss could strain government budgets, potentially leading to higher taxes elsewhere.</li></ul><h3>How to Prepare</h3><p>Monitor KRA updates via iTax. If passed, employers must adjust payroll systems—use our <a href="/payslip-generator-kenya.html" style="color: #006600;">payslip generator</a> for seamless compliance. Calculate your potential savings with our free tool at <a href="/calculator.html" style="color: #006600;">salarycalculator.co.ke</a>.</p><p>This proposal signals a shift toward progressive taxation, but its success hinges on legislative approval. Stay tuned, and let\'s hope it delivers real relief for Kenya\'s hustlers!</p>',
        featured_image_url: 'kenyan-economy-coins.jpg',
        secondary_image_url: 'nairobi_wh10.jpg',
        author_name: 'Admin',
        views_count: 0,
        published_at: '2026-02-19T08:30:00Z',
        status: 'published'
    }
];

// Blog Posts Management
async function loadBlogPosts() {
    const container = document.getElementById('blogGrid');
    if (!container) return;

    // Show fallback posts immediately so the page is never blank
    function renderPosts(posts) {
        container.innerHTML = '';
        posts.forEach((post, index) => {
            const card = createBlogCard(post, index);
            container.appendChild(card);
        });
    }

    renderPosts(fallbackBlogPosts);

    // Try loading fresher posts from the database in the background (5 s timeout)
    if (supabaseClient && isSupabaseConfigured()) {
        try {
            const { data, error } = await withTimeout(
                supabaseClient
                    .from('blog_posts')
                    .select('*')
                    .eq('status', 'published')
                    .order('published_at', { ascending: false }),
                5000
            );

            if (!error && data && data.length > 0) {
                renderPosts(data);
            }
        } catch (dbError) {
            console.log('Database unavailable, keeping fallback posts:', dbError);
        }
    }
}

const CARD_ACCENTS = ['accent-red', 'accent-blue', 'accent-orange', 'accent-purple', 'accent-teal'];

function createBlogCard(post, index = 0) {
    const card = document.createElement('div');
    const accent = CARD_ACCENTS[index % CARD_ACCENTS.length];
    const isFeatured = index === 0;
    card.className = `blog-card ${accent}${isFeatured ? ' blog-card-featured' : ''}`;
    card.onclick = () => window.location.href = `blog-post.html?slug=${post.slug}`;

    const imageUrl = post.featured_image_url || 'kenyan-economy-coins.jpg';
    const category = post.category || 'Finance';
    const readTime = estimateReadTime(post.content || post.excerpt || '');
    const authorInitial = (post.author_name || 'A').charAt(0).toUpperCase();

    card.innerHTML = `
        <div class="blog-card-image-wrap">
            <img src="${imageUrl}" alt="${post.title}" class="blog-card-image" loading="lazy" onerror="this.src='kenyan-economy-coins.jpg'">
            <span class="blog-card-category-badge">${category}</span>
        </div>
        <div class="blog-card-content">
            <h2 class="blog-card-title">${post.title}</h2>
            <p class="blog-card-excerpt">${post.excerpt || ''}</p>
            <div class="blog-card-meta">
                <div class="blog-card-author">
                    <div class="blog-card-author-avatar">${authorInitial}</div>
                    <span>${post.author_name}</span>
                </div>
                <div class="blog-card-read-time">
                    <i class="fas fa-clock"></i> ${readTime} min read
                </div>
                <div class="blog-card-stats">
                    <span><i class="fas fa-eye"></i> ${post.views_count || 0}</span>
                </div>
            </div>
        </div>
    `;

    return card;
}

// Estimate reading time (avg 200 words/min)
function estimateReadTime(text) {
    const words = text.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
}

// Single Blog Post
async function loadBlogPost() {
    const urlParams = new URLSearchParams(window.location.search);
    const slug = urlParams.get('slug');

    if (!slug) {
        window.location.href = 'blog.html';
        return;
    }

    const container = document.getElementById('blogPostContainer');
    if (!container) return;

    try {
        container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Loading post...</p></div>';

        let post = null;
        let reactions = {};
        let comments = [];
        // Reset state for new post load
        _isUsingFallback = false;
        _currentPostId = null;

        // Try loading from database first (5 s timeout to avoid infinite hang)
        if (supabaseClient && isSupabaseConfigured()) {
            try {
                const { data, error } = await withTimeout(
                    supabaseClient
                        .from('blog_posts')
                        .select('*')
                        .eq('slug', slug)
                        .eq('status', 'published')
                        .single(),
                    5000
                );

                if (!error && data) {
                    post = data;
                    _currentPostId = post.id;
                    
                    // Increment view count
                    await incrementPostViews(post.id);

                    // Load reactions and comments
                    reactions = await loadReactions(post.id);
                    comments = await loadComments(post.id);
                    if (comments.length > 0) {
                        const commentIds = comments.map(c => c.id);
                        _currentCommentReactions = await loadCommentReactions(commentIds);
                    } else {
                        _currentCommentReactions = {};
                    }

                    // Start real-time reactions and comments subscriptions
                    setupReactionsSubscription(post.id);
                    setupCommentReactionsSubscription(post.id);
                    setupCommentsSubscription(post.id);
                }
            } catch (dbError) {
                console.log('Database unavailable, using fallback post:', dbError);
            }
        }
        
        // Use fallback post if database didn't return a post
        if (!post) {
            post = fallbackBlogPosts.find(p => p.slug === slug);
            if (!post) {
                container.innerHTML = '<p style="text-align: center; color: #CC0000;">Post not found.</p>';
                return;
            }
            // For fallback posts, reactions and comments remain empty
            _isUsingFallback = true;
            reactions = { counts: {}, userReaction: null };
            comments = [];
        }
        
        // Ensure reactions has proper structure
        if (!reactions.counts) {
            reactions = { counts: reactions || {}, userReaction: null };
        }

        // Render the post
        renderBlogPost(post, reactions, comments);

    } catch (error) {
        console.error('Error loading blog post:', error);
        // Try fallback
        const post = fallbackBlogPosts.find(p => p.slug === slug);
        if (post) {
            _isUsingFallback = true;
            renderBlogPost(post, { counts: {}, userReaction: null }, []);
        } else {
            container.innerHTML = '<p style="text-align: center; color: #CC0000;">Error loading post. Please try again later.</p>';
        }
    }
}

async function incrementPostViews(postId) {
    try {
        const { error } = await supabaseClient.rpc('increment_post_views', { p_post_id: postId });
        if (error) console.error('Error incrementing views:', error);
        
        // Setup real-time subscription for view count updates
        setupViewCountSubscription(postId);
    } catch (error) {
        console.error('Error incrementing views:', error);
    }
}

// Setup real-time subscription for view count updates
function setupViewCountSubscription(postId) {
    if (!supabaseClient || !isSupabaseConfigured()) return;
    
    try {
        supabaseClient
            .channel(`post-${postId}-views`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'blog_posts',
                    filter: `id=eq.${postId}`
                },
                (payload) => {
                    // Update view count in real-time
                    const viewElement = document.querySelector('.blog-post-views');
                    if (viewElement && payload.new && payload.new.views_count) {
                        viewElement.innerHTML = `<i class="fas fa-eye"></i> ${payload.new.views_count} view${payload.new.views_count !== 1 ? 's' : ''}`;
                    }
                }
            )
            .subscribe();
        // Cleanup is handled by the shared beforeunload listener
    } catch (error) {
        console.error('Error setting up realtime subscription:', error);
    }
}

// Setup real-time subscription for reaction updates
function setupReactionsSubscription(postId) {
    if (!supabaseClient || !isSupabaseConfigured()) return;

    // Unsubscribe from any existing reactions subscription
    if (_reactionsSubscription) {
        _reactionsSubscription.unsubscribe();
        _reactionsSubscription = null;
    }

    try {
        _reactionsSubscription = supabaseClient
            .channel(`post-${postId}-reactions`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'post_reactions',
                    filter: `post_id=eq.${postId}`
                },
                async () => {
                    // Re-load and re-render reactions in real-time
                    const reactionsData = await loadReactions(postId);
                    const reactionsSection = document.getElementById('reactionsSection');
                    if (reactionsSection) {
                        reactionsSection.innerHTML = renderReactions(reactionsData.counts, postId, reactionsData.userReaction);
                    }
                }
            )
            .subscribe();

        // Cleanup is handled by the shared beforeunload listener registered in setupCommentsSubscription
    } catch (error) {
        console.error('Error setting up reactions realtime subscription:', error);
    }
}

// Setup real-time subscription for comment reaction updates so that optimistic
// UI is reconciled with authoritative DB state when multiple devices interact.
function setupCommentReactionsSubscription(postId) {
    if (!supabaseClient || !isSupabaseConfigured()) return;

    if (_commentReactionsSubscription) {
        _commentReactionsSubscription.unsubscribe();
        _commentReactionsSubscription = null;
    }

    try {
        _commentReactionsSubscription = supabaseClient
            .channel(`post-${postId}-comment-reactions`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'comment_reactions'
                },
                async () => {
                    // Re-load reactions for all visible comments and reconcile the UI
                    const commentIds = _currentPostComments.map(c => c.id);
                    if (commentIds.length === 0) return;
                    const updated = await loadCommentReactions(commentIds);
                    commentIds.forEach(id => {
                        _currentCommentReactions[id] = updated[id] || { counts: {}, userReaction: null };
                        const el = document.getElementById(`comment-reactions-${id}`);
                        if (el) {
                            const rd = _currentCommentReactions[id];
                            el.innerHTML = renderCommentReactionButtons(rd.counts, id, rd.userReaction);
                        }
                    });
                }
            )
            .subscribe();
    } catch (error) {
        console.error('Error setting up comment reactions realtime subscription:', error);
    }
}

function renderBlogPost(post, reactions, comments) {
    const container = document.getElementById('blogPostContainer');
    const imageUrl = post.featured_image_url || 'kenyan-economy-coins.jpg';
    const secondaryImageUrl = post.secondary_image_url || 'nairobi_wh10.jpg';
    const category = post.category || 'Finance';
    const readTime = estimateReadTime(post.content || post.excerpt || '');

    // Cache comments for re-rendering after auth resolves
    _currentPostComments = comments || [];

    // Split content at the midpoint (after first </h3> or </p> past the halfway mark)
    const rawContent = post.content || '';
    const mid = Math.floor(rawContent.length / 2);
    const splitIdx = rawContent.indexOf('</p>', mid);
    let contentPart1 = rawContent;
    let contentPart2 = '';
    if (splitIdx !== -1) {
        contentPart1 = rawContent.slice(0, splitIdx + 4);
        contentPart2 = rawContent.slice(splitIdx + 4);
    }

    const secondaryImageHtml = `
        <figure class="blog-post-secondary-image">
            <img src="${secondaryImageUrl}" alt="${post.title} - additional image" loading="lazy" onerror="this.src='kenyan-economy-coins.jpg'">
        </figure>`;

    container.innerHTML = `
        <article class="blog-post">
            <!-- Hero Image -->
            <div class="blog-post-hero">
                <img src="${imageUrl}" alt="${post.title}" class="blog-post-hero-image" loading="lazy" onerror="this.src='kenyan-economy-coins.jpg'">
            </div>

            <div class="blog-post-inner">
                <!-- Category badge -->
                <span class="blog-post-category-badge">${category}</span>

                <div class="blog-post-header">
                    <h1 class="blog-post-title">${post.title}</h1>
                </div>

                <div class="blog-post-meta">
                    <div class="blog-post-author-info">
                        <div class="blog-post-author-avatar">${getUserInitials(post.author_name)}</div>
                        <div class="blog-post-author-details">
                            <span class="blog-post-author">${post.author_name}</span>
                            <span class="blog-post-date">${formatDate(post.published_at)}</span>
                        </div>
                    </div>
                    <div class="blog-post-meta-right">
                        <span class="blog-post-read-time"><i class="fas fa-clock"></i> ${readTime} min read</span>
                        ${_isUsingFallback ? '' : `<span class="blog-post-views"><i class="fas fa-eye"></i> ${(post.views_count || 0) + 1} view${(post.views_count || 0) + 1 !== 1 ? 's' : ''}</span>`}
                    </div>
                </div>
                
                <div class="blog-post-content">
                    ${contentPart1}
                    ${secondaryImageHtml}
                    ${contentPart2}
                </div>

                <!-- Reactions -->
                <div class="blog-reactions" id="reactionsSection" role="group" aria-label="Post reactions">
                    ${renderReactions(reactions.counts, post.id, reactions.userReaction)}
                </div>

                <!-- Share Section -->
                <div class="blog-share">
                    <span class="blog-share-title">Share:</span>
                    <button class="share-button facebook" onclick="shareOnFacebook()" title="Share on Facebook">
                        <i class="fab fa-facebook-f"></i>
                    </button>
                    <button class="share-button twitter" onclick="shareOnTwitter()" title="Share on X (Twitter)">
                        <i class="fab fa-twitter"></i>
                    </button>
                    <button class="share-button linkedin" onclick="shareOnLinkedIn()" title="Share on LinkedIn">
                        <i class="fab fa-linkedin-in"></i>
                    </button>
                    <button class="share-button whatsapp" onclick="shareOnWhatsApp()" title="Share on WhatsApp">
                        <i class="fab fa-whatsapp"></i>
                    </button>
                    <button class="share-button copy" onclick="copyLink()" title="Copy Link">
                        <i class="fas fa-link"></i>
                    </button>
                </div>

                <!-- AdSense Ad -->
                <div class="blog-adsense">
                    <ins class="adsbygoogle"
                         style="display:block"
                         data-ad-format="fluid"
                         data-ad-layout-key="-6t+ed+2i-1n-4w"
                         data-ad-client="ca-pub-6832553346534070"
                         data-ad-slot="1234567890"></ins>
                </div>

                <!-- Comments Section -->
                <div class="blog-comments">
                    <div class="comments-header">
                        <h2 class="comments-title">Comments</h2>
                        <span class="comments-count">(${comments.length})</span>
                    </div>

                    <!-- Comment Form -->
                    <div class="comment-form" id="commentForm">
                        <h3>Leave a Comment</h3>
                        <div id="commentFormContent"></div>
                    </div>

                    <!-- Comments List -->
                    <div class="comments-list" id="commentsList">
                        ${renderComments(comments)}
                    </div>
                </div>
            </div><!-- /.blog-post-inner -->

            <!-- Related Posts -->
            ${renderRelatedPosts(post)}
        </article>
    `;

    // Initialize comment form
    initCommentForm(post.id);

    // Load AdSense
    if (window.adsbygoogle) {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
    }
}

function renderReactions(reactions, postId, userReaction = null) {
    const reactionTypes = [
        { type: 'like', emoji: '👍', label: 'Like' },
        { type: 'love', emoji: '❤️', label: 'Love' },
        { type: 'insightful', emoji: '💡', label: 'Insightful' },
        { type: 'celebrate', emoji: '🎉', label: 'Celebrate' },
        { type: 'support', emoji: '🙌', label: 'Support' }
    ];

    // postId is a UUID (safe) and rt.type is from a hardcoded static list (safe);
    // data attributes are used so no user-controlled data is interpolated into onclick.
    const buttons = reactionTypes.map(rt => {
        const count = reactions[rt.type] || 0;
        const isActive = userReaction === rt.type ? 'active' : '';
        const ariaLabel = `${rt.label}${count > 0 ? ': ' + count + ' reaction' + (count !== 1 ? 's' : '') : ''}`;
        const ariaPressed = userReaction === rt.type ? 'true' : 'false';
        return `
            <button class="reaction-button ${isActive}" data-post-id="${postId}" data-reaction-type="${rt.type}" title="${rt.label}${count > 0 ? ': ' + count : ''}" aria-label="${ariaLabel}" aria-pressed="${ariaPressed}">
                <span class="emoji" aria-hidden="true">${rt.emoji}</span>
                <span class="label">${rt.label}</span>
                <span class="count"${count > 0 ? '' : ' aria-hidden="true"'}>${count > 0 ? count : ''}</span>
            </button>
        `;
    }).join('');

    return `<span class="reactions-label" aria-label="Reactions">React:</span>${buttons}`;
}

function renderRelatedPosts(currentPost) {
    const related = fallbackBlogPosts
        .filter(p => p.slug !== currentPost.slug)
        .slice(0, 3);
    if (!related.length) return '';

    const cards = related.map(p => {
        const imgUrl = p.featured_image_url || 'kenyan-economy-coins.jpg';
        const category = p.category || 'Finance';
        return `
            <div class="blog-related-card" onclick="window.location.href='blog-post.html?slug=${p.slug}'" style="cursor:pointer;">
                <img src="${imgUrl}" alt="${p.title}" loading="lazy" onerror="this.src='kenyan-economy-coins.jpg'">
                <div class="blog-related-card-body">
                    <div class="blog-related-card-title">${p.title}</div>
                    <div class="blog-related-card-date"><i class="fas fa-tag"></i> ${category}</div>
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="blog-related">
            <h3><i class="fas fa-newspaper"></i> More Articles</h3>
            <div class="blog-related-grid">${cards}</div>
        </div>
    `;
}

// Organize flat comments list into a tree (top-level + nested replies)
function organizeComments(comments) {
    const byId = {};
    const roots = [];
    comments.forEach(c => { byId[c.id] = { ...c, replies: [] }; });
    comments.forEach(c => {
        if (c.parent_comment_id && byId[c.parent_comment_id]) {
            byId[c.parent_comment_id].replies.push(byId[c.id]);
        } else {
            roots.push(byId[c.id]);
        }
    });
    return roots;
}

function renderComments(comments) {
    if (!comments || comments.length === 0) {
        return '<p style="text-align: center; color: #999;">No comments yet. Be the first to comment!</p>';
    }

    const organized = organizeComments(comments);
    return organized.map(comment => renderSingleComment(comment, 0)).join('');
}

function renderSingleComment(comment, depth) {
    const canEdit = _currentUserId && comment.user_id === _currentUserId;
    // Use data attributes for safe event delegation (avoids inline onclick with interpolated IDs)
    const editBtn = canEdit
        ? `<button class="comment-action-btn" data-action="edit-comment" data-comment-id="${comment.id}" title="Edit comment"><i class="fas fa-edit"></i> Edit</button>`
        : '';
    // Only show Reply button for real DB posts with a logged-in user
    const canReply = _currentPostId && !_isUsingFallback && _currentUserId;
    const replyBtn = canReply
        ? `<button class="comment-action-btn comment-reply-btn" data-action="reply-comment" data-comment-id="${comment.id}" title="Reply"><i class="fas fa-reply"></i> Reply</button>`
        : '';
    const reactionData = _currentCommentReactions[comment.id] || { counts: {}, userReaction: null };
    // Use CSS classes for depth indentation (avoids inline style injection)
    const depthClass = depth > 0 ? ` comment-depth-${Math.min(depth, 2)}` : '';
    const replies = (comment.replies || []).map(r => renderSingleComment(r, depth + 1)).join('');
    return `
        <div class="comment${depth > 0 ? ' comment-reply' : ''}${depthClass}" id="comment-${comment.id}">
            <div class="comment-header">
                <div class="comment-author">
                    <div class="comment-avatar">${getUserInitials(comment.user_name)}</div>
                    <span class="comment-author-name">${escapeHtml(comment.user_name)}</span>
                </div>
                <span class="comment-date">${formatRelativeTime(comment.created_at)}</span>
            </div>
            <div class="comment-text" id="comment-text-${comment.id}">${renderCommentText(comment.comment_text)}</div>
            <div class="comment-footer">
                <div id="comment-reactions-${comment.id}" class="comment-reactions">${renderCommentReactionButtons(reactionData.counts, comment.id, reactionData.userReaction)}</div>
                <div class="comment-actions">${replyBtn}${editBtn}</div>
            </div>
            <div id="reply-form-${comment.id}" class="reply-form-container"></div>
        </div>
        ${replies}`;
}


function renderCommentReactionButtons(counts, commentId, userReaction) {
    const reactionTypes = [
        { type: 'like', emoji: '👍', label: 'Like' },
        { type: 'love', emoji: '❤️', label: 'Love' },
        { type: 'insightful', emoji: '💡', label: 'Insightful' },
        { type: 'celebrate', emoji: '🎉', label: 'Celebrate' },
        { type: 'support', emoji: '🙌', label: 'Support' }
    ];

    return reactionTypes.map(rt => {
        const count = (counts && counts[rt.type]) || 0;
        const isActive = userReaction === rt.type ? 'active' : '';
        const ariaPressed = userReaction === rt.type ? 'true' : 'false';
        const countHtml = count > 0 ? `<span class="cr-count">${count}</span>` : '';
        return `<button class="comment-reaction-btn ${isActive}" data-comment-id="${commentId}" data-reaction-type="${rt.type}" title="${rt.label}${count > 0 ? ': ' + count : ''}" aria-label="${rt.label}${count > 0 ? ': ' + count + ' reaction' + (count !== 1 ? 's' : '') : ''}" aria-pressed="${ariaPressed}"><span class="cr-emoji" aria-hidden="true">${rt.emoji}</span>${countHtml}</button>`;
    }).join('');
}

// Reactions
async function loadReactions(postId) {
    try {
        // Use server-side RPC for aggregated counts (reduces payload vs. fetching every row)
        const { data, error } = await supabaseClient
            .rpc('get_reaction_counts', { p_post_id: postId });

        if (error) throw error;

        // Build counts map from RPC result: [{ reaction_type, count }, ...]
        const counts = {};
        (data || []).forEach(row => {
            counts[row.reaction_type] = Number(row.count);
        });

        // Check if current user has reacted (separate lightweight query)
        let userReaction = null;
        try {
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (user) {
                const { data: userReactionData } = await supabaseClient
                    .from('post_reactions')
                    .select('reaction_type')
                    .eq('post_id', postId)
                    .eq('user_id', user.id)
                    .maybeSingle();
                if (userReactionData) {
                    userReaction = userReactionData.reaction_type;
                }
            }
        } catch (authError) {
            // User not logged in - that's okay
        }

        return { counts, userReaction };
    } catch (error) {
        console.error('Error loading reactions:', error);
        return { counts: {}, userReaction: null };
    }
}

async function handleReaction(postId, reactionType) {
    if (!supabaseClient || !isSupabaseConfigured()) {
        return; // Offline check and user notification is handled by the event handler
    }

    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        
        if (!user) {
            showToast('Please sign in to react to posts', 'error');
            window.location.href = 'auth.html?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
            return;
        }

        // Get all existing reactions for this user + post (handles any duplicates gracefully)
        const { data: existing, error: checkError } = await supabaseClient
            .from('post_reactions')
            .select('reaction_type')
            .eq('post_id', postId)
            .eq('user_id', user.id);

        if (checkError) throw checkError;

        const prevReactionType = existing && existing.length > 0 ? existing[0].reaction_type : null;

        // Delete all existing reactions for this user+post
        if (existing && existing.length > 0) {
            const { error: deleteError } = await supabaseClient
                .from('post_reactions')
                .delete()
                .eq('post_id', postId)
                .eq('user_id', user.id);
            if (deleteError) throw deleteError;
        }

        if (prevReactionType !== reactionType) {
            // Insert new reaction (different type, or no prior reaction)
            const { error } = await supabaseClient
                .from('post_reactions')
                .insert({
                    post_id: postId,
                    user_id: user.id,
                    reaction_type: reactionType
                });
            if (error) throw error;
            showToast('Reaction added', 'success');
        } else {
            showToast('Reaction removed', 'success');
        }

        // Reload reactions with user's current reaction
        const reactionsData = await loadReactions(postId);
        const reactionsSection = document.getElementById('reactionsSection');
        if (reactionsSection) {
            reactionsSection.innerHTML = renderReactions(reactionsData.counts, postId, reactionsData.userReaction);
        }

    } catch (error) {
        console.error('Error handling reaction:', error);
        showToast('Error updating reaction', 'error');
    }
}

async function handleCommentReaction(commentId, reactionType) {
    if (!supabaseClient || !isSupabaseConfigured()) {
        return; // Offline check and user notification is handled by the event handler
    }

    try {
        const { data: { user } } = await supabaseClient.auth.getUser();

        if (!user) {
            showToast('Please sign in to react to comments', 'error');
            window.location.href = 'auth.html?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
            return;
        }

        // Get all existing reactions for this user + comment (handles duplicates)
        const { data: existing, error: checkError } = await supabaseClient
            .from('comment_reactions')
            .select('reaction_type')
            .eq('comment_id', commentId)
            .eq('user_id', user.id);

        if (checkError) throw checkError;

        const prevReactionType = existing && existing.length > 0 ? existing[0].reaction_type : null;

        // Delete all existing reactions for this user+comment
        if (existing && existing.length > 0) {
            const { error: deleteError } = await supabaseClient
                .from('comment_reactions')
                .delete()
                .eq('comment_id', commentId)
                .eq('user_id', user.id);
            if (deleteError) throw deleteError;
        }

        if (prevReactionType !== reactionType) {
            // Insert new reaction (different type, or no prior reaction)
            const { error } = await supabaseClient
                .from('comment_reactions')
                .insert({
                    comment_id: commentId,
                    user_id: user.id,
                    reaction_type: reactionType
                });
            if (error) throw error;
            showToast('Reaction added', 'success');
        } else {
            showToast('Reaction removed', 'success');
        }

        // Update cached reactions and re-render this comment's reaction section
        const updated = await loadCommentReactions([commentId]);
        _currentCommentReactions[commentId] = updated[commentId] || { counts: {}, userReaction: null };

        const reactionsEl = document.getElementById(`comment-reactions-${commentId}`);
        if (reactionsEl) {
            const rd = _currentCommentReactions[commentId];
            reactionsEl.innerHTML = renderCommentReactionButtons(rd.counts, commentId, rd.userReaction);
        }

    } catch (error) {
        console.error('Error handling comment reaction:', error);
        showToast('Error updating reaction', 'error');
    }
}

// Comments
async function loadComments(postId) {
    try {
        const { data, error } = await supabaseClient
            .from('post_comments')
            .select('*')
            .eq('post_id', postId)
            .eq('is_approved', true)
            .order('created_at', { ascending: false });

        if (error) throw error;
        const comments = data || [];

        // Optionally enrich comments with display_name from the profiles table.
        // Falls back silently to the inline user_name if the table does not yet exist.
        if (comments.length > 0) {
            try {
                const userIds = [...new Set(comments.map(c => c.user_id).filter(id => id != null))];
                if (userIds.length > 0) {
                    const { data: profilesData } = await supabaseClient
                        .from('profiles')
                        .select('id, display_name')
                        .in('id', userIds);
                    if (profilesData && profilesData.length > 0) {
                        const profileMap = {};
                        profilesData.forEach(p => { profileMap[p.id] = p.display_name; });
                        comments.forEach(c => {
                            if (c.user_id && profileMap[c.user_id]) {
                                c.user_name = profileMap[c.user_id];
                            }
                        });
                    }
                }
            } catch (profilesError) {
                // Suppress "relation does not exist" errors — the profiles table hasn't
                // been created yet; fall back to the inline user_name on each comment.
                // Re-throw any other unexpected errors so they surface in the console.
                const msg = (profilesError && profilesError.message) ? profilesError.message : '';
                if (!msg.includes('relation') && !msg.includes('does not exist') &&
                    profilesError?.code !== '42P01') {
                    console.error('Unexpected error loading profiles:', profilesError);
                }
            }
        }

        // Load comment reactions and populate cache
        if (comments.length > 0) {
            _currentCommentReactions = await loadCommentReactions(comments.map(c => c.id));
        } else {
            _currentCommentReactions = {};
        }

        return comments;
    } catch (error) {
        console.error('Error loading comments:', error);
        return [];
    }
}

async function loadCommentReactions(commentIds) {
    if (!commentIds || commentIds.length === 0) return {};
    try {
        const { data, error } = await supabaseClient
            .from('comment_reactions')
            .select('comment_id, reaction_type, user_id')
            .in('comment_id', commentIds);

        if (error) throw error;

        // Group reactions by comment_id
        const byComment = {};
        (data || []).forEach(r => {
            if (!byComment[r.comment_id]) {
                byComment[r.comment_id] = { counts: {}, userReaction: null };
            }
            byComment[r.comment_id].counts[r.reaction_type] =
                (byComment[r.comment_id].counts[r.reaction_type] || 0) + 1;
        });

        // Mark current user's reaction
        try {
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (user) {
                (data || []).filter(r => r.user_id === user.id).forEach(r => {
                    if (byComment[r.comment_id]) {
                        byComment[r.comment_id].userReaction = r.reaction_type;
                    }
                });
            }
        } catch (authError) {
            // User not logged in — that's okay
        }

        return byComment;
    } catch (error) {
        console.error('Error loading comment reactions:', error);
        return {};
    }
}

async function initCommentForm(postId) {
    const formContent = document.getElementById('commentFormContent');
    if (!formContent) return;

    // For fallback posts (non-UUID IDs), comments are not stored in the DB
    if (!isValidUUID(postId)) {
        // Hide the "Leave a Comment" heading — it's irrelevant without DB access
        const commentForm = document.getElementById('commentForm');
        if (commentForm) {
            const heading = commentForm.querySelector('h3');
            if (heading) heading.style.display = 'none';
        }
        formContent.innerHTML = `<div class="offline-comments-notice"><i class="fas fa-database"></i> Comments are not available while offline. Reconnect to the database to join the discussion.</div>`;
        const commentsList = document.getElementById('commentsList');
        if (commentsList) commentsList.innerHTML = '';
        return;
    }

    if (!supabaseClient || !isSupabaseConfigured()) {
        formContent.innerHTML = `<p style="text-align: center;"><a href="auth.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}">Sign in</a> to leave a comment</p>`;
        return;
    }

    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        
        if (!user) {
            formContent.innerHTML = `<p style="text-align: center;"><a href="auth.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}" style="color: #006600; font-weight: bold;">Sign in</a> to leave a comment</p>`;
            return;
        }

        // Get user display name from metadata
        const userName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Anonymous';

        _currentUserId = user.id;

        const emojiList = ['😀','😂','😍','🥰','😎','🤔','😢','😅','👍','👎','❤️','🎉','🔥','💯',
                           '👏','🙌','💪','🤝','😊','🥳','💡','✅','❌','📊','💰','💼','🏢','📈',
                           '🇰🇪','🎓','😮','🤩','💬','⭐','🚀','📱','💻','🏆','🌟','✍️'];

        formContent.innerHTML = `
            <div class="comment-format-toolbar" role="toolbar" aria-label="Comment formatting">
                <button type="button" class="format-btn" data-format="bold" title="Bold — wraps selection with **bold**"><b>B</b></button>
                <button type="button" class="format-btn" data-format="italic" title="Italic — wraps selection with *italic*"><i>I</i></button>
                <button type="button" class="format-btn emoji-toggle-btn" id="emojiToggleBtn" title="Insert emoji" aria-haspopup="dialog" aria-expanded="false" aria-controls="emojiPicker">😊 Emoji</button>
                <span class="format-hint">Tip: **bold** or *italic*</span>
            </div>
            <div class="emoji-picker" id="emojiPicker" style="display:none;" role="dialog" aria-label="Emoji picker" aria-modal="true">
                <div class="emoji-grid">
                    ${emojiList.map(e => `<button type="button" class="emoji-item" data-emoji="${e}" title="${e}" aria-label="${e}">${e}</button>`).join('')}
                </div>
            </div>
            <div class="form-group">
                <textarea id="commentText" placeholder="Share your thoughts on this article…" required style="min-height:140px; border:2px solid #006600; font-size:1em; margin-top:6px;"></textarea>
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
                <button type="button" class="submit-comment-btn" id="submitCommentBtn">
                    <i class="fas fa-paper-plane"></i> Post Comment
                </button>
                <span style="font-size:0.8em; color:#888; font-style:italic;">Posting as: ${escapeHtml(userName)}</span>
            </div>
        `;

        // Attach submit handler (avoids inline onclick with interpolated data)
        document.getElementById('submitCommentBtn').addEventListener('click', () => submitComment(postId));

        // Format toolbar buttons
        formContent.querySelectorAll('.format-btn[data-format]').forEach(btn => {
            btn.addEventListener('click', () => applyFormat(btn.dataset.format));
        });

        // Emoji toggle button
        document.getElementById('emojiToggleBtn').addEventListener('click', function(e) {
            e.stopPropagation();
            toggleEmojiPicker();
        });

        // Emoji item buttons
        formContent.querySelectorAll('.emoji-item').forEach(btn => {
            btn.addEventListener('click', () => insertEmoji(btn.dataset.emoji));
        });

        // Close emoji picker when clicking elsewhere (single global handler, de-registered on re-render)
        if (_emojiPickerCloseHandler) {
            document.removeEventListener('click', _emojiPickerCloseHandler);
        }
        _emojiPickerCloseHandler = function(e) {
            const picker = document.getElementById('emojiPicker');
            const toggleBtn = document.getElementById('emojiToggleBtn');
            if (picker && toggleBtn && !picker.contains(e.target) && !toggleBtn.contains(e.target)) {
                picker.style.display = 'none';
                toggleBtn.setAttribute('aria-expanded', 'false');
            }
        };
        document.addEventListener('click', _emojiPickerCloseHandler);

        // Keyboard navigation inside emoji picker: Escape closes it, arrow keys move focus
        formContent.querySelector('#emojiPicker').addEventListener('keydown', function(e) {
            const items = Array.from(this.querySelectorAll('.emoji-item'));
            const idx = items.indexOf(document.activeElement);
            const cols = Math.floor(this.querySelector('.emoji-grid').offsetWidth / (items[0] ? items[0].offsetWidth : 40)) || 8;
            if (e.key === 'Escape') {
                this.style.display = 'none';
                const toggleBtn = document.getElementById('emojiToggleBtn');
                if (toggleBtn) {
                    toggleBtn.setAttribute('aria-expanded', 'false');
                    toggleBtn.focus();
                }
                e.preventDefault();
            } else if (e.key === 'ArrowRight' && idx >= 0 && idx < items.length - 1) {
                items[idx + 1].focus();
                e.preventDefault();
            } else if (e.key === 'ArrowLeft' && idx > 0) {
                items[idx - 1].focus();
                e.preventDefault();
            } else if (e.key === 'ArrowDown' && idx + cols < items.length) {
                items[idx + cols].focus();
                e.preventDefault();
            } else if (e.key === 'ArrowUp' && idx - cols >= 0) {
                items[idx - cols].focus();
                e.preventDefault();
            }
        });

        // Re-render comments list now that we know the current user (to show edit/reply buttons)
        const commentsList = document.getElementById('commentsList');
        if (commentsList && _currentPostComments.length > 0) {
            commentsList.innerHTML = renderComments(_currentPostComments);
        }
    } catch (error) {
        console.error('Error initializing comment form:', error);
        formContent.innerHTML = `<p style="text-align: center;"><a href="auth.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}">Sign in</a> to leave a comment</p>`;
    }
}

// Apply bold/italic markdown formatting to selected textarea text
function applyFormat(type) {
    const textarea = document.getElementById('commentText');
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end);
    const before = textarea.value.substring(0, start);
    const after = textarea.value.substring(end);
    let marker, placeholder;
    if (type === 'bold') { marker = '**'; placeholder = 'bold text'; }
    else if (type === 'italic') { marker = '*'; placeholder = 'italic text'; }
    else { return; }
    const inner = selected || placeholder;
    const formatted = `${marker}${inner}${marker}`;
    textarea.value = before + formatted + after;
    const cursorStart = start + marker.length;
    const cursorEnd = cursorStart + inner.length;
    textarea.setSelectionRange(cursorStart, cursorEnd);
    textarea.focus();
}

// Toggle the emoji picker panel
function toggleEmojiPicker() {
    const picker = document.getElementById('emojiPicker');
    const toggleBtn = document.getElementById('emojiToggleBtn');
    if (!picker) return;
    const isOpen = picker.style.display !== 'none';
    picker.style.display = isOpen ? 'none' : 'flex';
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
    // Move focus into picker when opening so keyboard users can navigate
    if (!isOpen) {
        const firstEmoji = picker.querySelector('.emoji-item');
        if (firstEmoji) firstEmoji.focus();
    }
}

// Insert an emoji at the current cursor position in the comment textarea
function insertEmoji(emoji) {
    const textarea = document.getElementById('commentText');
    if (!textarea) return;
    const start = textarea.selectionStart;
    const before = textarea.value.substring(0, start);
    const after = textarea.value.substring(textarea.selectionEnd);
    textarea.value = before + emoji + after;
    textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
    textarea.focus();
    const picker = document.getElementById('emojiPicker');
    if (picker) picker.style.display = 'none';
    const toggleBtn = document.getElementById('emojiToggleBtn');
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
}

// Show an inline reply form below a comment
function showReplyForm(commentId, postId) {
    // Toggle: close if already open
    const container = document.getElementById(`reply-form-${commentId}`);
    if (!container) return;
    if (container.children.length > 0) {
        container.innerHTML = '';
        return;
    }
    // Close any other open reply forms
    document.querySelectorAll('.reply-form-container').forEach(el => {
        if (el.id !== `reply-form-${commentId}`) el.innerHTML = '';
    });
    if (!supabaseClient || !isSupabaseConfigured() || !_currentUserId) {
        showToast('Please sign in to reply', 'error');
        return;
    }
    container.innerHTML = `
        <div class="reply-form">
            <textarea id="reply-text-${commentId}" class="reply-textarea" placeholder="Write a reply… (use **bold** or *italic*)"></textarea>
            <div class="reply-form-actions">
                <button type="button" class="submit-comment-btn reply-submit-btn" id="reply-submit-${commentId}">
                    <i class="fas fa-reply"></i> Post Reply
                </button>
                <button type="button" class="comment-action-btn reply-cancel-btn" id="reply-cancel-${commentId}">
                    <i class="fas fa-times"></i> Cancel
                </button>
            </div>
        </div>
    `;
    document.getElementById(`reply-submit-${commentId}`).addEventListener('click', () => submitReply(postId, commentId));
    document.getElementById(`reply-cancel-${commentId}`).addEventListener('click', () => { container.innerHTML = ''; });
    document.getElementById(`reply-text-${commentId}`).focus();
}

// Submit a reply to a comment
async function submitReply(postId, parentCommentId) {
    const textarea = document.getElementById(`reply-text-${parentCommentId}`);
    if (!textarea) return;
    const replyText = textarea.value.trim();
    if (!replyText) {
        showToast('Please enter a reply', 'error');
        return;
    }
    if (!supabaseClient || !isSupabaseConfigured()) {
        showToast('Please sign in to reply', 'error');
        return;
    }
    const submitBtn = document.getElementById(`reply-submit-${parentCommentId}`);
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
            showToast('Please sign in to reply', 'error');
            return;
        }
        if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting…'; }
        const userName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Anonymous';
        const { error } = await supabaseClient
            .from('post_comments')
            .insert({
                post_id: postId,
                user_id: user.id,
                user_name: userName,
                user_email: user.email,
                comment_text: replyText,
                parent_comment_id: parentCommentId
            });
        if (error) throw error;
        showToast('Reply posted!', 'success');
        const replyContainer = document.getElementById(`reply-form-${parentCommentId}`);
        if (replyContainer) replyContainer.innerHTML = '';
        const comments = await loadComments(postId);
        _currentPostComments = comments;
        const commentsList = document.getElementById('commentsList');
        if (commentsList) commentsList.innerHTML = renderComments(comments);
        const countEl = document.querySelector('.comments-count');
        if (countEl) countEl.textContent = `(${comments.length})`;
    } catch (error) {
        console.error('Error posting reply:', error);
        showToast('Error posting reply', 'error');
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fas fa-reply"></i> Post Reply'; }
    }
}


async function submitComment(postId) {
    const commentText = document.getElementById('commentText')?.value?.trim();

    if (!commentText) {
        showToast('Please enter a comment', 'error');
        return;
    }

    if (!supabaseClient || !isSupabaseConfigured()) {
        showToast('Please sign in to comment', 'error');
        return;
    }

    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        
        if (!user) {
            showToast('Please sign in to comment', 'error');
            window.location.href = 'auth.html?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
            return;
        }

        const btn = document.getElementById('submitCommentBtn');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...'; }

        const userName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Anonymous';

        const { error } = await supabaseClient
            .from('post_comments')
            .insert({
                post_id: postId,
                user_id: user.id,
                user_name: userName,
                user_email: user.email,
                comment_text: commentText
            });

        if (error) throw error;

        showToast('Comment posted successfully!', 'success');
        document.getElementById('commentText').value = '';
        
        // Reload comments (also refreshes _currentCommentReactions)
        const comments = await loadComments(postId);
        _currentPostComments = comments;
        document.getElementById('commentsList').innerHTML = renderComments(comments);
        
        // Update count
        const countEl = document.querySelector('.comments-count');
        if (countEl) countEl.textContent = `(${comments.length})`;

    } catch (error) {
        console.error('Error posting comment:', error);
        showToast('Error posting comment', 'error');
    } finally {
        const btn = document.getElementById('submitCommentBtn');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Post Comment'; }
    }
}

// Start inline editing for a comment
function startEditComment(commentId) {
    const textEl = document.getElementById(`comment-text-${commentId}`);
    if (!textEl) return;

    // Get the current text from the cached comments data (avoids XSS via innerHTML)
    const cached = _currentPostComments.find(c => c.id === commentId);
    const currentText = cached ? cached.comment_text : textEl.textContent.trim();

    // Build edit UI safely
    const wrapper = document.createElement('div');

    const textarea = document.createElement('textarea');
    textarea.id = `edit-textarea-${commentId}`;
    textarea.value = currentText;
    textarea.style.cssText = 'width:100%; min-height:100px; border:2px solid #006600; border-radius:5px; padding:8px; font-size:1em; font-family:inherit; resize:vertical;';

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'margin-top:8px; display:flex; gap:10px;';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'submit-comment-btn';
    saveBtn.style.cssText = 'padding:8px 18px; font-size:0.9em;';
    saveBtn.innerHTML = '<i class="fas fa-save"></i> Save';
    saveBtn.onclick = () => saveEditComment(commentId);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'comment-action-btn';
    cancelBtn.style.cssText = 'padding:8px 14px; border:1px solid #ccc; border-radius:5px; background:#f5f5f5; font-size:0.9em;';
    cancelBtn.innerHTML = '<i class="fas fa-times"></i> Cancel';
    cancelBtn.onclick = () => cancelEditComment(commentId, currentText);

    btnRow.appendChild(saveBtn);
    btnRow.appendChild(cancelBtn);
    wrapper.appendChild(textarea);
    wrapper.appendChild(btnRow);

    textEl.innerHTML = '';
    textEl.appendChild(wrapper);
    textarea.focus();
}

// Cancel editing and restore original text safely
function cancelEditComment(commentId, originalText) {
    const textEl = document.getElementById(`comment-text-${commentId}`);
    if (textEl) {
        textEl.innerHTML = renderCommentText(originalText);
    }
}

// Save edited comment to the database
async function saveEditComment(commentId) {
    const textarea = document.getElementById(`edit-textarea-${commentId}`);
    if (!textarea) return;
    const newText = textarea.value.trim();
    if (!newText) {
        showToast('Comment cannot be empty', 'error');
        return;
    }
    if (!supabaseClient || !isSupabaseConfigured()) {
        showToast('Unable to save: not connected', 'error');
        return;
    }
    try {
        const { error } = await supabaseClient
            .from('post_comments')
            .update({ comment_text: newText })
            .eq('id', commentId)
            .eq('user_id', _currentUserId);
        if (error) throw error;

        // Update cached data
        const cached = _currentPostComments.find(c => c.id === commentId);
        if (cached) cached.comment_text = newText;

        // Restore display with safe rendered text
        const textEl = document.getElementById(`comment-text-${commentId}`);
        if (textEl) {
            textEl.innerHTML = renderCommentText(newText);
        }
        showToast('Comment updated', 'success');
    } catch (error) {
        console.error('Error updating comment:', error);
        showToast('Error updating comment', 'error');
    }
}

// Setup real-time subscription for new comments on a post
function setupCommentsSubscription(postId) {
    if (!supabaseClient || !isSupabaseConfigured()) return;

    // Unsubscribe from any existing subscription
    if (_commentsSubscription) {
        _commentsSubscription.unsubscribe();
        _commentsSubscription = null;
    }

    try {
        _commentsSubscription = supabaseClient
            .channel(`post-${postId}-comments`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'post_comments',
                    filter: `post_id=eq.${postId}`
                },
                async () => {
                    // Reload and re-render comments when a new one arrives
                    const comments = await loadComments(postId);
                    _currentPostComments = comments;
                    const commentsList = document.getElementById('commentsList');
                    if (commentsList) commentsList.innerHTML = renderComments(comments);
                    const countEl = document.querySelector('.comments-count');
                    if (countEl) countEl.textContent = `(${comments.length})`;
                }
            )
            .subscribe();

        // Register a single shared beforeunload cleanup for all subscriptions
        if (!_beforeunloadRegistered) {
            _beforeunloadRegistered = true;
            window.addEventListener('beforeunload', () => {
                if (_reactionsSubscription) _reactionsSubscription.unsubscribe();
                if (_commentReactionsSubscription) _commentReactionsSubscription.unsubscribe();
                if (_commentsSubscription) _commentsSubscription.unsubscribe();
            });
        }
    } catch (error) {
        console.error('Error setting up comments subscription:', error);
    }
}

// Share Functions
function shareOnFacebook() {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
}

function shareOnTwitter() {
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(document.querySelector('.blog-post-title')?.textContent || 'Check out this article');
    window.open(`https://twitter.com/intent/tweet?url=${url}&text=${title}`, '_blank');
}

function shareOnLinkedIn() {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank');
}

function shareOnWhatsApp() {
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(document.querySelector('.blog-post-title')?.textContent || 'Check out this article');
    window.open(`https://wa.me/?text=${title}%20${url}`, '_blank');
}

function copyLink() {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
        showToast('Link copied to clipboard!', 'success');
    }).catch(err => {
        console.error('Error copying link:', err);
        showToast('Error copying link', 'error');
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initScrollButton();
    
    // Load blog posts if on blog page
    if (document.getElementById('blogGrid')) {
        loadBlogPosts();
    }
    
    // Load single blog post if on blog post page
    if (document.getElementById('blogPostContainer')) {
        loadBlogPost();
    }
    
    // Initialize dropdown menus
    initDropdowns();
    
    // Initialize mobile menu
    initMobileMenu();

    // Event delegation for reaction buttons (avoids inline onclick with interpolated data)
    document.addEventListener('click', function(e) {
        const btn = e.target.closest('.reaction-button[data-post-id]');
        if (btn) {
            const postId = btn.dataset.postId;
            const reactionType = btn.dataset.reactionType;
            if (postId && reactionType) {
                // Skip optimistic UI entirely when offline — the handler will show a toast
                if (!supabaseClient || !isSupabaseConfigured()) {
                    showToast('Reactions require a live database connection', 'error');
                    return;
                }
                // Optimistic UI: toggle active state and update counts immediately before DB round-trip
                const wasActive = btn.classList.contains('active');
                const currentActive = document.querySelector(`.reaction-button.active[data-post-id="${postId}"]`);
                document.querySelectorAll(`.reaction-button[data-post-id="${postId}"]`).forEach(b => b.classList.remove('active'));
                // Optimistically decrement the previously active reaction count
                if (currentActive) {
                    const prevCountSpan = currentActive.querySelector('.count');
                    if (prevCountSpan) {
                        const c = (parseInt(prevCountSpan.textContent) || 1) - 1;
                        prevCountSpan.textContent = c > 0 ? String(c) : '';
                    }
                }
                if (!wasActive) {
                    btn.classList.add('active');
                    // Optimistically increment the new reaction count
                    const countSpan = btn.querySelector('.count');
                    if (countSpan) {
                        countSpan.textContent = String((parseInt(countSpan.textContent) || 0) + 1);
                    }
                }
                handleReaction(postId, reactionType);
            }
        }

        const commentBtn = e.target.closest('.comment-reaction-btn[data-comment-id]');
        if (commentBtn) {
            const commentId = commentBtn.dataset.commentId;
            const reactionType = commentBtn.dataset.reactionType;
            if (commentId && reactionType) {
                // Skip optimistic UI when offline
                if (!supabaseClient || !isSupabaseConfigured()) {
                    showToast('Reactions require a live database connection', 'error');
                    return;
                }
                // Optimistic UI: toggle active state immediately
                const wasActive = commentBtn.classList.contains('active');
                document.querySelectorAll(`.comment-reaction-btn[data-comment-id="${commentId}"]`).forEach(b => b.classList.remove('active'));
                if (!wasActive) commentBtn.classList.add('active');
                handleCommentReaction(commentId, reactionType);
            }
        }

        // Event delegation for comment action buttons (edit / reply)
        const actionBtn = e.target.closest('[data-action]');
        if (actionBtn) {
            const action = actionBtn.dataset.action;
            const commentId = actionBtn.dataset.commentId;
            if (action === 'edit-comment' && commentId) {
                startEditComment(commentId);
            } else if (action === 'reply-comment' && commentId && _currentPostId) {
                showReplyForm(commentId, _currentPostId);
            }
        }
    });
});

// Navigation dropdown functionality
// Note: These functions are duplicated from script.js because blog pages
// don't include script.js - they only load blog.js for blog-specific functionality
function initDropdowns() {
    const dropdownToggles = document.querySelectorAll('.nav-dropdown-toggle');
    dropdownToggles.forEach(toggle => {
        toggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const dropdown = this.closest('.nav-dropdown');
            
            // Close other dropdowns
            document.querySelectorAll('.nav-dropdown').forEach(d => {
                if (d !== dropdown) {
                    d.classList.remove('open');
                }
            });
            
            // Toggle current dropdown
            dropdown.classList.toggle('open');
        });
    });
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.nav-dropdown')) {
            document.querySelectorAll('.nav-dropdown').forEach(d => {
                d.classList.remove('open');
            });
        }
    });
}

// Mobile menu functionality
function initMobileMenu() {
    const mobileToggle = document.querySelector('.mobile-menu-toggle');
    if (mobileToggle) {
        mobileToggle.addEventListener('click', function() {
            const nav = document.querySelector('.main-nav');
            nav.classList.toggle('mobile-open');
            // Toggle icon between hamburger and close
            const icon = mobileToggle.querySelector('i');
            if (icon) {
                icon.classList.toggle('fa-bars');
                icon.classList.toggle('fa-times');
            }
        });
    }
}
