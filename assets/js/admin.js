// Admin Dashboard JavaScript

let currentUser = null;
let isAdmin = false;

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Check if a user has admin privileges.
// Tries the is_admin() RPC first (requires admin-setup.sql to have been run).
// Falls back to a direct email check so that access works even before the
// database admin tables are created.
async function checkIsAdmin(user) {
    if (!user) return false;
    try {
        const { data, error } = await supabaseClient.rpc('is_admin');
        if (!error && data === true) return true;
    } catch (_) {
        // RPC not available yet – fall through to email check
    }
    return user.email === window.ADMIN_EMAIL;
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
        
        // Check if user is admin (with email fallback for kesalarycalculator@gmail.com)
        const adminGranted = await checkIsAdmin(currentUser);
        
        if (!adminGranted) {
            showAccessDenied();
            return;
        }
        
        isAdmin = true;

        // Clear the redirect-loop counter — authenticated successfully
        sessionStorage.removeItem('_admin_redirect_n');

        // Show dashboard
        loadingState.style.display = 'none';
        dashboard.style.display = 'block';
        
        // Load initial data
        await loadDashboardStats();
        
    } catch (error) {
        console.error('Error initializing admin dashboard:', error);
        showAccessDenied();
    }
}

function showAccessDenied() {
    document.getElementById('loadingState').style.display = 'none';

    // ── Guard 1: Supabase not configured ─────────────────────────────────────
    // If the anon key is still the placeholder we must NOT redirect to
    // admin-auth.html — that page would see a valid session and redirect right
    // back here, creating an infinite loop.  Show a clear config error instead.
    if (typeof isSupabaseConfigured === 'function' && !isSupabaseConfigured()) {
        const ls = document.getElementById('loadingState');
        if (ls) {
            ls.style.display = 'block';
            ls.innerHTML = `
                <div style="padding:48px 32px;text-align:center;font-family:sans-serif;">
                    <div style="font-size:2.5rem;margin-bottom:16px;">⚙️</div>
                    <h2 style="color:#c00;margin-bottom:8px;">Configuration Error</h2>
                    <p style="color:#555;max-width:420px;margin:0 auto;">
                        <code>SUPABASE_ANON_KEY</code> in <strong>admin.html</strong> is still set to
                        the placeholder value. Open the file, replace <code>'YOUR_ANON_KEY_HERE'</code>
                        with your actual project anon key, then redeploy.
                    </p>
                </div>`;
        }
        return;
    }

    // ── Guard 2: redirect-loop breaker ───────────────────────────────────────
    // Count how many times we have redirected to admin-auth.html in this tab
    // session.  If we have already been here twice without a successful login,
    // stop redirecting and show an access-denied message instead.
    const LOOP_KEY   = '_admin_redirect_n';
    const redirectN  = parseInt(sessionStorage.getItem(LOOP_KEY) || '0', 10);
    if (redirectN >= 2) {
        sessionStorage.removeItem(LOOP_KEY);
        const ls = document.getElementById('loadingState');
        if (ls) {
            ls.style.display = 'block';
            ls.innerHTML = `
                <div style="padding:48px 32px;text-align:center;font-family:sans-serif;">
                    <div style="font-size:2.5rem;margin-bottom:16px;">🔒</div>
                    <h2 style="color:#c00;margin-bottom:8px;">Access Denied</h2>
                    <p style="color:#555;">You do not have admin privileges for this account.</p>
                    <a href="/auth.html" style="display:inline-block;margin-top:16px;
                        padding:10px 24px;background:#006600;color:#fff;border-radius:6px;
                        text-decoration:none;font-size:0.95rem;">Sign in with a different account</a>
                </div>`;
        }
        return;
    }
    sessionStorage.setItem(LOOP_KEY, String(redirectN + 1));

    // Redirect to dedicated admin auth page
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
    if (tabName === 'users') {
        loadUsers();
    } else if (tabName === 'organisations') {
        loadOrganisations();
    } else if (tabName === 'dashboard') {
        loadDashboardStats();
    }
}

// Load dashboard statistics
async function loadDashboardStats() {
    try {
        const { data, error } = await supabaseClient
            .rpc('get_admin_dashboard_stats');
        
        if (error) throw error;
        
        if (data && data.length > 0) {
            const stats = data[0];
            const usersEl = document.getElementById('stat-users');
            if (usersEl) usersEl.textContent = stats.total_users != null ? stats.total_users : '-';
            const orgsEl = document.getElementById('stat-organisations');
            if (orgsEl) orgsEl.textContent = stats.total_organizations != null ? stats.total_organizations : '-';
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// ─── Users Management ────────────────────────────────────────────────────────

// Classify a user's online status based on last_sign_in_at
function getUserStatus(lastSignInAt) {
    if (!lastSignInAt) return { label: 'Never', cls: 'status-offline', dot: 'dot-offline' };
    const diffMs = Date.now() - new Date(lastSignInAt).getTime();
    const diffMins = diffMs / 60000;
    if (diffMins < 15) return { label: 'Online', cls: 'status-online', dot: 'dot-online' };
    if (diffMins < 1440) return { label: 'Today', cls: 'status-recent', dot: 'dot-recent' };
    return { label: 'Offline', cls: 'status-offline', dot: 'dot-offline' };
}

// Load all registered users
async function loadUsers() {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading...</td></tr>';

    try {
        const { data, error } = await supabaseClient.rpc('get_all_users');

        if (error) throw error;

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No users found.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        data.forEach(user => {
            const status = getUserStatus(user.last_sign_in_at);
            const lastSeen = user.last_sign_in_at
                ? new Date(user.last_sign_in_at).toLocaleString()
                : 'Never';
            const roleLabel = user.is_super_admin
                ? '<span class="status-badge status-admin"><i class="fas fa-crown"></i> Super Admin</span>'
                : user.is_admin_user
                    ? '<span class="status-badge status-admin"><i class="fas fa-shield-alt"></i> Admin</span>'
                    : '<span class="status-badge status-draft">User</span>';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <strong>${escapeHtml(user.display_name)}</strong><br>
                    <small style="color:#666;">${escapeHtml(user.email)}</small>
                </td>
                <td>${roleLabel}</td>
                <td>
                    <span class="online-dot ${status.dot}"></span>
                    <span class="status-badge ${status.cls}">${status.label}</span>
                </td>
                <td>${new Date(user.created_at).toLocaleDateString()}</td>
                <td>${lastSeen}</td>
            `;
            tbody.appendChild(row);
        });

    } catch (error) {
        console.error('Error loading users:', error);
        showMessage('usersMessage', 'Error loading users: ' + error.message, 'error');
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Failed to load users.</td></tr>';
    }
}

// ─── Organisations Management ─────────────────────────────────────────────────

// Load all employer / organisation profiles
async function loadOrganisations() {
    const tbody = document.getElementById('organisationsTableBody');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Loading...</td></tr>';

    try {
        const { data, error } = await supabaseClient.rpc('get_all_employers');

        if (error) throw error;

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No organisations found.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        data.forEach(org => {
            const businessType = org.business_type
                ? org.business_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                : '-';
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <strong>${escapeHtml(org.organization_name)}</strong><br>
                    <small style="color:#666;">${escapeHtml(org.email || '')}</small>
                </td>
                <td>${escapeHtml(businessType)}</td>
                <td>${escapeHtml(org.industry || '-')}</td>
                <td>${escapeHtml(org.county || '-')}</td>
                <td>
                    ${org.contact_email ? escapeHtml(org.contact_email) : ''}
                    ${org.contact_phone ? '<br><small>' + escapeHtml(org.contact_phone) + '</small>' : ''}
                </td>
                <td>${new Date(org.created_at).toLocaleDateString()}</td>
            `;
            tbody.appendChild(row);
        });

    } catch (error) {
        console.error('Error loading organisations:', error);
        showMessage('organisationsMessage', 'Error loading organisations: ' + error.message, 'error');
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Failed to load organisations.</td></tr>';
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
