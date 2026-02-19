// Blog JavaScript Functions

// Helper function to check if Supabase is configured
function isSupabaseConfigured() {
    return window.supabaseClient !== null && 
           window.supabaseClient !== undefined &&
           typeof window.isSupabaseConfigured === 'function' &&
           window.isSupabaseConfigured();
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
        title: 'Kenya Treasury Hints at Tax Abolition for Low-Income Earners Below KES 30,000',
        slug: 'kenya-tax-abolition-below-30000',
        excerpt: 'The Kenya National Treasury and the Presidency are considering a significant policy shift that could see individuals earning below KES 30,000 per month exempted from income tax.',
        content: '<h2>A New Dawn for Low-Income Earners in Kenya</h2><p>In a significant policy development that could reshape Kenya\'s tax landscape, the National Treasury and the Office of the President have hinted at a groundbreaking proposal to abolish income tax for individuals earning below KES 30,000 per month.</p><p>This potential reform comes at a critical time when many Kenyans are grappling with the rising cost of living and economic pressures.</p>',
        featured_image_url: 'kenyan-economy-coins.jpg',
        author_name: 'Admin',
        views_count: 1250,
        published_at: '2025-01-15T10:00:00Z',
        status: 'published'
    },
    {
        id: 'post-2',
        title: 'Understanding NSSF New Rates 2025: What Kenyan Workers Need to Know',
        slug: 'nssf-new-rates-2025',
        excerpt: 'The National Social Security Fund (NSSF) has implemented new contribution rates for 2025. Learn how these changes affect your salary and retirement savings.',
        content: '<h2>NSSF Rate Changes Explained</h2><p>Starting January 2025, Kenyan workers will see changes in their NSSF deductions. The new system features a two-tier structure designed to enhance retirement savings while remaining affordable for all workers.</p><p><strong>Tier I:</strong> 6% of the first KES 7,000 (capped at KES 420)</p><p><strong>Tier II:</strong> 6% of earnings between KES 7,001 and KES 36,000 (capped at KES 1,740)</p><p>Combined maximum contribution: KES 2,160 per month.</p>',
        featured_image_url: 'kenyan-economy-coins.jpg',
        author_name: 'Admin',
        views_count: 980,
        published_at: '2025-01-20T14:30:00Z',
        status: 'published'
    },
    {
        id: 'post-3',
        title: 'SHIF Replaces NHIF: Complete Guide to Kenya\'s New Health Insurance',
        slug: 'shif-replaces-nhif-guide',
        excerpt: 'The Social Health Insurance Fund (SHIF) has officially replaced NHIF. Discover what this means for your healthcare coverage and salary deductions.',
        content: '<h2>SHIF: Kenya\'s New Healthcare System</h2><p>The transition from NHIF to SHIF marks a significant shift in Kenya\'s healthcare financing. SHIF aims to provide more comprehensive and equitable healthcare coverage for all Kenyans.</p><h3>Key Changes:</h3><ul><li><strong>Contribution Rate:</strong> 2.75% of gross salary (more progressive than flat NHIF rates)</li><li><strong>Coverage:</strong> Expanded benefits including chronic diseases and emergency care</li><li><strong>Access:</strong> Nationwide network of healthcare facilities</li><li><strong>Family Coverage:</strong> Automatic coverage for dependents</li></ul>',
        featured_image_url: 'kenyan-economy-coins.jpg',
        author_name: 'Admin',
        views_count: 1560,
        published_at: '2025-02-01T09:15:00Z',
        status: 'published'
    },
    {
        id: 'post-4',
        title: 'Housing Levy Kenya 2025: Everything Employers and Employees Should Know',
        slug: 'housing-levy-kenya-2025',
        excerpt: 'The Affordable Housing Levy is now mandatory for all Kenyan workers. Learn about contribution rates, benefits, and how to access affordable housing.',
        content: '<h2>Understanding the Housing Levy</h2><p>Kenya\'s Affordable Housing Levy, introduced as part of the government\'s Big Four Agenda, aims to provide affordable housing to millions of Kenyans.</p><h3>Contribution Details:</h3><ul><li><strong>Rate:</strong> 1.5% of gross salary from both employee and employer</li><li><strong>Combined:</strong> 3% total contribution per employee</li><li><strong>Cap:</strong> No upper limit currently</li></ul><h3>Benefits:</h3><p>Contributors will have priority access to affordable housing units being constructed across Kenya. The program targets building 250,000 housing units annually.</p>',
        featured_image_url: 'kenyan-economy-coins.jpg',
        author_name: 'Admin',
        views_count: 890,
        published_at: '2025-02-05T11:45:00Z',
        status: 'published'
    },
    {
        id: 'post-5',
        title: 'Kenya PAYE Calculator 2025: How to Calculate Your Take-Home Salary',
        slug: 'kenya-paye-calculator-2025',
        excerpt: 'Master the art of calculating your net salary with our comprehensive guide to Kenya\'s PAYE tax system, deductions, and reliefs.',
        content: '<h2>Understanding PAYE in Kenya</h2><p>Pay As You Earn (PAYE) is the tax deducted from your salary by your employer. Understanding how it\'s calculated helps you plan your finances better.</p><h3>PAYE Tax Bands 2025:</h3><ul><li>Up to KES 24,000: 10%</li><li>KES 24,001 - 32,333: 25%</li><li>KES 32,334 - 500,000: 30%</li><li>KES 500,001 - 800,000: 32.5%</li><li>Above KES 800,000: 35%</li></ul><h3>Tax Relief:</h3><p>Personal relief of KES 2,400 per month is deducted from your PAYE, reducing your tax burden.</p><p><em>Use our free <a href="/calculator.html" style="color: #006600;">Kenya Salary Calculator</a> to instantly calculate your net pay.</em></p>',
        featured_image_url: 'kenyan-economy-coins.jpg',
        author_name: 'Admin',
        views_count: 2100,
        published_at: '2025-02-10T08:00:00Z',
        status: 'published'
    },
    {
        id: 'post-6',
        title: 'KRA PIN Registration: Step-by-Step Guide for Kenyan Employees',
        slug: 'kra-pin-registration-guide',
        excerpt: 'Your KRA PIN is essential for employment in Kenya. Learn how to register, verify, and use your KRA PIN for tax compliance.',
        content: '<h2>Why You Need a KRA PIN</h2><p>A KRA Personal Identification Number (PIN) is mandatory for all Kenyan taxpayers. It\'s required for employment, opening bank accounts, and various government services.</p><h3>Registration Process:</h3><ol><li>Visit <a href="https://itax.kra.go.ke" target="_blank" rel="noopener">iTax Portal</a></li><li>Click "New PIN Registration"</li><li>Fill in personal details (ID/Passport number, email, phone)</li><li>Submit and verify via email/SMS</li><li>Download your PIN certificate</li></ol><h3>Important Tips:</h3><ul><li>Keep your PIN confidential</li><li>Update your details when they change</li><li>File your tax returns annually, even if unemployed</li><li>Check your tax compliance status regularly</li></ul>',
        featured_image_url: 'kenyan-economy-coins.jpg',
        author_name: 'Admin',
        views_count: 1680,
        published_at: '2025-02-12T10:30:00Z',
        status: 'published'
    }
];

// Blog Posts Management
async function loadBlogPosts() {
    const container = document.getElementById('blogGrid');
    if (!container) return;

    try {
        container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Loading posts...</p></div>';

        let posts = [];
        
        // Try loading from database first
        if (supabaseClient && isSupabaseConfigured()) {
            try {
                const { data, error } = await supabaseClient
                    .from('blog_posts')
                    .select('*')
                    .eq('status', 'published')
                    .order('published_at', { ascending: false });

                if (!error && data && data.length > 0) {
                    posts = data;
                }
            } catch (dbError) {
                console.log('Database unavailable, using fallback posts:', dbError);
            }
        }
        
        // Use fallback posts if database didn't return posts
        if (posts.length === 0) {
            console.log('Using fallback blog posts');
            posts = fallbackBlogPosts;
        }

        if (!posts || posts.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666;">No blog posts available yet.</p>';
            return;
        }

        container.innerHTML = '';
        posts.forEach(post => {
            const card = createBlogCard(post);
            container.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading blog posts:', error);
        // Try fallback posts on error
        container.innerHTML = '';
        fallbackBlogPosts.forEach(post => {
            const card = createBlogCard(post);
            container.appendChild(card);
        });
    }
}

function createBlogCard(post) {
    const card = document.createElement('div');
    card.className = 'blog-card';
    card.onclick = () => window.location.href = `blog-post.html?slug=${post.slug}`;

    const imageUrl = post.featured_image_url || 'kenyan-economy-coins.jpg';
    
    card.innerHTML = `
        <img src="${imageUrl}" alt="${post.title}" class="blog-card-image" loading="lazy" onerror="this.src='kenyan-economy-coins.jpg'">
        <div class="blog-card-content">
            <h2 class="blog-card-title">${post.title}</h2>
            <p class="blog-card-excerpt">${post.excerpt || ''}</p>
            <div class="blog-card-meta">
                <div class="blog-card-author">
                    <i class="fas fa-user-circle"></i>
                    <span>${post.author_name}</span>
                </div>
                <div class="blog-card-stats">
                    <span><i class="fas fa-eye"></i> ${post.views_count || 0}</span>
                </div>
            </div>
        </div>
    `;

    return card;
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

        // Try loading from database first
        if (supabaseClient && isSupabaseConfigured()) {
            try {
                const { data, error } = await supabaseClient
                    .from('blog_posts')
                    .select('*')
                    .eq('slug', slug)
                    .eq('status', 'published')
                    .single();

                if (!error && data) {
                    post = data;
                    
                    // Increment view count
                    await incrementPostViews(post.id);

                    // Load reactions and comments
                    reactions = await loadReactions(post.id);
                    comments = await loadComments(post.id);
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
            reactions = {};
            comments = [];
        }

        // Render the post
        renderBlogPost(post, reactions, comments);

    } catch (error) {
        console.error('Error loading blog post:', error);
        // Try fallback
        const post = fallbackBlogPosts.find(p => p.slug === slug);
        if (post) {
            renderBlogPost(post, {}, []);
        } else {
            container.innerHTML = '<p style="text-align: center; color: #CC0000;">Error loading post. Please try again later.</p>';
        }
    }
}

async function incrementPostViews(postId) {
    try {
        const { error } = await supabaseClient.rpc('increment_post_views', { p_post_id: postId });
        if (error) console.error('Error incrementing views:', error);
    } catch (error) {
        console.error('Error incrementing views:', error);
    }
}

function renderBlogPost(post, reactions, comments) {
    const container = document.getElementById('blogPostContainer');
    const imageUrl = post.featured_image_url || 'kenyan-economy-coins.jpg';

    container.innerHTML = `
        <article class="blog-post">
            <div class="blog-post-header">
                <h1 class="blog-post-title">${post.title}</h1>
                <div class="blog-post-meta">
                    <div class="blog-post-author-info">
                        <div class="blog-post-author-avatar">${getUserInitials(post.author_name)}</div>
                        <div class="blog-post-author-details">
                            <span class="blog-post-author">${post.author_name}</span>
                            <span class="blog-post-date">${formatDate(post.published_at)}</span>
                        </div>
                    </div>
                    <div class="blog-post-views">
                        <i class="fas fa-eye"></i> ${post.views_count + 1} views
                    </div>
                </div>
            </div>
            
            <img src="${imageUrl}" alt="${post.title}" class="blog-post-featured-image" loading="lazy" onerror="this.src='kenyan-economy-coins.jpg'">
            
            <div class="blog-post-content">
                ${post.content}
            </div>

            <!-- Reactions -->
            <div class="blog-reactions" id="reactionsSection">
                ${renderReactions(reactions, post.id)}
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

            <!-- Share Section -->
            <div class="blog-share">
                <span class="blog-share-title">Share this article:</span>
                <button class="share-button facebook" onclick="shareOnFacebook()" title="Share on Facebook">
                    <i class="fab fa-facebook-f"></i>
                </button>
                <button class="share-button twitter" onclick="shareOnTwitter()" title="Share on Twitter">
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
        </article>
    `;

    // Initialize comment form
    initCommentForm(post.id);

    // Load AdSense
    if (window.adsbygoogle) {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
    }
}

function renderReactions(reactions, postId) {
    const reactionTypes = [
        { type: 'like', emoji: '👍', label: 'Like' },
        { type: 'love', emoji: '❤️', label: 'Love' },
        { type: 'insightful', emoji: '💡', label: 'Insightful' },
        { type: 'celebrate', emoji: '🎉', label: 'Celebrate' },
        { type: 'support', emoji: '🙌', label: 'Support' }
    ];

    return reactionTypes.map(rt => {
        const count = reactions[rt.type] || 0;
        return `
            <button class="reaction-button" data-type="${rt.type}" onclick="handleReaction('${postId}', '${rt.type}')">
                <span class="emoji">${rt.emoji}</span>
                <span class="label">${rt.label}</span>
                <span class="count">${count > 0 ? count : ''}</span>
            </button>
        `;
    }).join('');
}

function renderComments(comments) {
    if (!comments || comments.length === 0) {
        return '<p style="text-align: center; color: #999;">No comments yet. Be the first to comment!</p>';
    }

    return comments.map(comment => `
        <div class="comment">
            <div class="comment-header">
                <div class="comment-author">
                    <div class="comment-avatar">${getUserInitials(comment.user_name)}</div>
                    <span class="comment-author-name">${comment.user_name}</span>
                </div>
                <span class="comment-date">${formatRelativeTime(comment.created_at)}</span>
            </div>
            <div class="comment-text">${comment.comment_text}</div>
        </div>
    `).join('');
}

// Reactions
async function loadReactions(postId) {
    try {
        const { data, error } = await supabaseClient
            .from('blog_reactions')
            .select('reaction_type')
            .eq('post_id', postId);

        if (error) throw error;

        const reactions = {};
        data.forEach(r => {
            reactions[r.reaction_type] = (reactions[r.reaction_type] || 0) + 1;
        });

        return reactions;
    } catch (error) {
        console.error('Error loading reactions:', error);
        return {};
    }
}

async function handleReaction(postId, reactionType) {
    if (!supabaseClient || !isSupabaseConfigured()) {
        showToast('Please sign in to react to posts', 'error');
        return;
    }

    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        
        if (!user) {
            showToast('Please sign in to react to posts', 'error');
            window.location.href = 'auth.html';
            return;
        }

        // Check if user already reacted
        const { data: existing, error: checkError } = await supabaseClient
            .from('blog_reactions')
            .select('*')
            .eq('post_id', postId)
            .eq('user_id', user.id)
            .single();

        if (checkError && checkError.code !== 'PGRST116') {
            throw checkError;
        }

        if (existing) {
            // Update reaction if different, delete if same
            if (existing.reaction_type === reactionType) {
                const { error } = await supabaseClient
                    .from('blog_reactions')
                    .delete()
                    .eq('id', existing.id);
                
                if (error) throw error;
                showToast('Reaction removed', 'success');
            } else {
                const { error } = await supabaseClient
                    .from('blog_reactions')
                    .update({ reaction_type: reactionType })
                    .eq('id', existing.id);
                
                if (error) throw error;
                showToast('Reaction updated', 'success');
            }
        } else {
            // Insert new reaction
            const { error } = await supabaseClient
                .from('blog_reactions')
                .insert({
                    post_id: postId,
                    user_id: user.id,
                    reaction_type: reactionType
                });
            
            if (error) throw error;
            showToast('Reaction added', 'success');
        }

        // Reload reactions
        const reactions = await loadReactions(postId);
        document.getElementById('reactionsSection').innerHTML = renderReactions(reactions, postId);

    } catch (error) {
        console.error('Error handling reaction:', error);
        showToast('Error updating reaction', 'error');
    }
}

// Comments
async function loadComments(postId) {
    try {
        const { data, error } = await supabaseClient
            .from('blog_comments')
            .select('*')
            .eq('post_id', postId)
            .eq('is_approved', true)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error loading comments:', error);
        return [];
    }
}

async function initCommentForm(postId) {
    const formContent = document.getElementById('commentFormContent');
    if (!formContent) return;

    if (!supabaseClient || !isSupabaseConfigured()) {
        formContent.innerHTML = '<p style="text-align: center;"><a href="auth.html">Sign in</a> to leave a comment</p>';
        return;
    }

    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        
        if (!user) {
            formContent.innerHTML = '<p style="text-align: center;"><a href="auth.html" style="color: #006600; font-weight: bold;">Sign in</a> to leave a comment</p>';
            return;
        }

        // Get user profile for name
        const { data: profile } = await supabaseClient
            .from('user_profiles')
            .select('full_name')
            .eq('id', user.id)
            .single();

        const userName = profile?.full_name || user.email?.split('@')[0] || 'Anonymous';

        formContent.innerHTML = `
            <div class="form-group">
                <label>Name</label>
                <input type="text" id="commentName" value="${userName}" readonly style="background: #f0f0f0;">
            </div>
            <div class="form-group">
                <label>Comment</label>
                <textarea id="commentText" placeholder="Share your thoughts..." required></textarea>
            </div>
            <button type="button" class="submit-comment-btn" onclick="submitComment('${postId}')">
                Post Comment
            </button>
        `;
    } catch (error) {
        console.error('Error initializing comment form:', error);
        formContent.innerHTML = '<p style="text-align: center;"><a href="auth.html">Sign in</a> to leave a comment</p>';
    }
}

async function submitComment(postId) {
    const commentText = document.getElementById('commentText')?.value?.trim();
    const commentName = document.getElementById('commentName')?.value?.trim();

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
            window.location.href = 'auth.html';
            return;
        }

        const btn = document.querySelector('.submit-comment-btn');
        btn.disabled = true;
        btn.textContent = 'Posting...';

        const { error } = await supabaseClient
            .from('blog_comments')
            .insert({
                post_id: postId,
                user_id: user.id,
                user_name: commentName,
                user_email: user.email,
                comment_text: commentText
            });

        if (error) throw error;

        showToast('Comment posted successfully!', 'success');
        document.getElementById('commentText').value = '';
        
        // Reload comments
        const comments = await loadComments(postId);
        document.getElementById('commentsList').innerHTML = renderComments(comments);
        
        // Update count
        document.querySelector('.comments-count').textContent = `(${comments.length})`;

    } catch (error) {
        console.error('Error posting comment:', error);
        showToast('Error posting comment', 'error');
    } finally {
        const btn = document.querySelector('.submit-comment-btn');
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Post Comment';
        }
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
});
