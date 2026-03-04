// Admin Dashboard JavaScript

let currentUser = null;
let isAdmin = false;
let editingPostId = null;

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize admin dashboard
async function initAdminDashboard() {
    const loadingState = document.getElementById('loadingState');
    const accessDenied = document.getElementById('accessDenied');
    const dashboard = document.getElementById('adminDashboard');
    
    try {
        // Check if Supabase is configured
        if (!isSupabaseConfigured()) {
            showAccessDenied();
            return;
        }
        
        // Get current user
        const { data: { user } } = await supabaseClient.auth.getUser();
        
        if (!user) {
            showAccessDenied();
            return;
        }
        
        currentUser = user;
        
        // Check if user is admin
        const { data: adminData, error } = await supabaseClient
            .rpc('is_admin');
        
        if (error || adminData !== true) {
            showAccessDenied();
            return;
        }
        
        isAdmin = true;
        
        // Show dashboard
        loadingState.style.display = 'none';
        dashboard.style.display = 'block';
        
        // Load initial data
        await loadDashboardStats();
        await loadRecentPosts();
        
        // Setup slug auto-generation
        setupSlugGenerator();
        
    } catch (error) {
        console.error('Error initializing admin dashboard:', error);
        showAccessDenied();
    }
}

function showAccessDenied() {
    document.getElementById('loadingState').style.display = 'none';
    // Redirect to dedicated admin auth page instead of showing inline access denied
    window.location.replace('/admin-auth.html');
}

// Switch between tabs
function switchTab(tabName) {
    // Update tabs
    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    event.target.closest('.admin-tab').classList.add('active');
    
    // Update panels
    const panels = document.querySelectorAll('.admin-panel');
    panels.forEach(panel => panel.classList.remove('active'));
    document.getElementById(`panel-${tabName}`).classList.add('active');
    
    // Load data for specific tabs
    if (tabName === 'posts') {
        loadAllPosts();
    } else if (tabName === 'comments') {
        loadComments();
    } else if (tabName === 'dashboard') {
        loadDashboardStats();
        loadRecentPosts();
    }
}

// Load dashboard statistics
async function loadDashboardStats() {
    try {
        const { data, error } = await supabaseClient
            .rpc('get_blog_stats');
        
        if (error) throw error;
        
        if (data && data.length > 0) {
            const stats = data[0];
            document.getElementById('stat-posts').textContent = stats.total_posts || 0;
            document.getElementById('stat-views').textContent = stats.total_views || 0;
            document.getElementById('stat-comments').textContent = stats.total_comments || 0;
            document.getElementById('stat-reactions').textContent = stats.total_reactions || 0;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Load recent posts for dashboard
async function loadRecentPosts() {
    try {
        const { data, error } = await supabaseClient
            .from('blog_posts')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);
        
        if (error) throw error;
        
        const container = document.getElementById('recentPosts');
        
        if (!data || data.length === 0) {
            container.innerHTML = '<p>No posts yet.</p>';
            return;
        }
        
        let html = '<table class="posts-table"><thead><tr><th>Title</th><th>Status</th><th>Views</th><th>Date</th></tr></thead><tbody>';
        
        data.forEach(post => {
            html += `
                <tr>
                    <td>${escapeHtml(post.title)}</td>
                    <td><span class="status-badge status-${post.status}">${post.status}</span></td>
                    <td>${post.views_count || 0}</td>
                    <td>${new Date(post.created_at).toLocaleDateString()}</td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading recent posts:', error);
    }
}

// Load all posts for management
async function loadAllPosts() {
    const tbody = document.getElementById('postsTableBody');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Loading...</td></tr>';
    
    try {
        const { data, error } = await supabaseClient
            .from('blog_posts')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No posts found.</td></tr>';
            return;
        }
        
        tbody.innerHTML = '';
        
        data.forEach(post => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${escapeHtml(post.title)}</td>
                <td><span class="status-badge status-${post.status}">${post.status}</span></td>
                <td>${post.views_count || 0}</td>
                <td>${new Date(post.created_at).toLocaleDateString()}</td>
                <td class="action-buttons">
                    <button class="btn btn-small" onclick="editPost('${post.id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-small btn-danger" data-post-id="${post.id}" data-post-title="${escapeHtml(post.title)}" onclick="deletePostFromButton(this)">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
        
    } catch (error) {
        console.error('Error loading posts:', error);
        showMessage('postsMessage', 'Error loading posts: ' + error.message, 'error');
    }
}

// Edit post
async function editPost(postId) {
    try {
        const { data, error } = await supabaseClient
            .from('blog_posts')
            .select('*')
            .eq('id', postId)
            .single();
        
        if (error) throw error;
        
        editingPostId = postId;
        
        // Fill form
        document.getElementById('post-id').value = postId;
        document.getElementById('post-title').value = data.title;
        document.getElementById('post-slug').value = data.slug;
        document.getElementById('post-excerpt').value = data.excerpt || '';
        document.getElementById('post-content').value = data.content;
        // Also populate Quill editor if available
        if (window.quillEditor) {
            window.quillEditor.root.innerHTML = data.content || '';
        }
        document.getElementById('post-image').value = data.featured_image_url || '';
        document.getElementById('post-secondary-image').value = data.secondary_image_url || '';
        document.getElementById('post-author').value = data.author_name || 'Admin';
        document.getElementById('post-status').value = data.status;
        
        // Update form title
        document.getElementById('createFormTitle').textContent = 'Edit Blog Post';
        
        // Switch to create tab
        switchTab('create');
        document.querySelector('[onclick="switchTab(\'create\')"]').click();
        
    } catch (error) {
        console.error('Error loading post:', error);
        alert('Error loading post: ' + error.message);
    }
}

// Delete post
async function deletePost(postId, title) {
    if (!confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
        return;
    }
    
    try {
        const { error } = await supabaseClient
            .from('blog_posts')
            .delete()
            .eq('id', postId);
        
        if (error) throw error;
        
        showToast('Post deleted successfully', 'success');
        loadAllPosts();
        
    } catch (error) {
        console.error('Error deleting post:', error);
        alert('Error deleting post: ' + error.message);
    }
}

// Wrapper function for delete button with data attributes
function deletePostFromButton(button) {
    const postId = button.getAttribute('data-post-id');
    const title = button.getAttribute('data-post-title');
    deletePost(postId, title);
}

// Save post (create or update)
async function savePost(event) {
    event.preventDefault();
    
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="spinner"></span> Saving...';
    submitBtn.disabled = true;
    
    const postId = document.getElementById('post-id').value;
    const postData = {
        title: document.getElementById('post-title').value,
        slug: document.getElementById('post-slug').value,
        excerpt: document.getElementById('post-excerpt').value,
        content: (window.getQuillContent ? window.getQuillContent() : document.getElementById('post-content').value),
        featured_image_url: document.getElementById('post-image').value,
        secondary_image_url: document.getElementById('post-secondary-image').value || null,
        author_name: document.getElementById('post-author').value || currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || currentUser.email?.split('@')[0] || 'Admin',
        status: document.getElementById('post-status').value,
        author_id: currentUser.id,
        updated_at: new Date().toISOString()
    };
    
    try {
        let result;
        
        if (postId) {
            // Update existing post
            result = await supabaseClient
                .from('blog_posts')
                .update(postData)
                .eq('id', postId);
        } else {
            // Create new post
            postData.created_at = new Date().toISOString();
            postData.published_at = postData.status === 'published' ? new Date().toISOString() : null;
            
            result = await supabaseClient
                .from('blog_posts')
                .insert([postData]);
        }
        
        if (result.error) throw result.error;
        
        showMessage('createMessage', `Post ${postId ? 'updated' : 'created'} successfully!`, 'success');
        showToast(`Post ${postId ? 'updated' : 'created'} successfully!`, 'success');
        
        // Reset form after delay
        setTimeout(() => {
            resetPostForm();
            loadAllPosts();
        }, 1500);
        
    } catch (error) {
        console.error('Error saving post:', error);
        showMessage('createMessage', 'Error saving post: ' + error.message, 'error');
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Reset post form
function resetPostForm() {
    document.getElementById('postForm').reset();
    document.getElementById('post-id').value = '';
    document.getElementById('createFormTitle').textContent = 'Create New Blog Post';
    editingPostId = null;
    document.getElementById('createMessage').innerHTML = '';
}

// Setup slug auto-generation
function setupSlugGenerator() {
    const titleInput = document.getElementById('post-title');
    const slugInput = document.getElementById('post-slug');
    const slugPreview = document.getElementById('slug-preview');
    
    titleInput.addEventListener('input', (e) => {
        // Only auto-generate if slug is empty or matches previous title
        if (!slugInput.value || slugInput.dataset.autoGenerated === 'true') {
            const slug = generateSlug(e.target.value);
            slugInput.value = slug;
            slugInput.dataset.autoGenerated = 'true';
            slugPreview.textContent = slug;
        }
    });
    
    slugInput.addEventListener('input', (e) => {
        // Mark as manually edited
        slugInput.dataset.autoGenerated = 'false';
        slugPreview.textContent = e.target.value;
    });
}

// Generate URL slug from title
function generateSlug(title) {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// Load comments for moderation
async function loadComments() {
    const container = document.getElementById('commentsList');
    container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading comments...</p></div>';
    
    try {
        const { data, error } = await supabaseClient
            .from('post_comments')
            .select(`
                *,
                blog_posts (title)
            `)
            .order('created_at', { ascending: false })
            .limit(50);
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            container.innerHTML = '<p>No comments found.</p>';
            return;
        }
        
        let html = '<table class="posts-table"><thead><tr><th>Post</th><th>User</th><th>Comment</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead><tbody>';
        
        data.forEach(comment => {
            const postTitle = comment.blog_posts?.title || 'Unknown Post';
            const approved = comment.is_approved ? 'Approved' : 'Pending';
            const statusClass = comment.is_approved ? 'status-published' : 'status-draft';
            
            html += `
                <tr>
                    <td>${escapeHtml(postTitle)}</td>
                    <td>${escapeHtml(comment.user_name)}</td>
                    <td>${escapeHtml(comment.comment_text.substring(0, 100))}${comment.comment_text.length > 100 ? '...' : ''}</td>
                    <td><span class="status-badge ${statusClass}">${approved}</span></td>
                    <td>${new Date(comment.created_at).toLocaleDateString()}</td>
                    <td class="action-buttons">
                        ${!comment.is_approved ? `
                            <button class="btn btn-small" onclick="approveComment('${comment.id}')">
                                <i class="fas fa-check"></i> Approve
                            </button>
                        ` : ''}
                        <button class="btn btn-small btn-danger" onclick="deleteComment('${comment.id}')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading comments:', error);
        container.innerHTML = '<p class="alert alert-error">Error loading comments: ' + error.message + '</p>';
    }
}

// Approve comment
async function approveComment(commentId) {
    try {
        const { error } = await supabaseClient
            .from('post_comments')
            .update({ is_approved: true })
            .eq('id', commentId);
        
        if (error) throw error;
        
        showToast('Comment approved', 'success');
        loadComments();
        
    } catch (error) {
        console.error('Error approving comment:', error);
        alert('Error approving comment: ' + error.message);
    }
}

// Delete comment
async function deleteComment(commentId) {
    if (!confirm('Are you sure you want to delete this comment?')) {
        return;
    }
    
    try {
        const { error } = await supabaseClient
            .from('post_comments')
            .delete()
            .eq('id', commentId);
        
        if (error) throw error;
        
        showToast('Comment deleted', 'success');
        loadComments();
        
    } catch (error) {
        console.error('Error deleting comment:', error);
        alert('Error deleting comment: ' + error.message);
    }
}

// Show message in specific container
function showMessage(containerId, message, type) {
    const container = document.getElementById(containerId);
    container.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        container.innerHTML = '';
    }, 5000);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initAdminDashboard);
