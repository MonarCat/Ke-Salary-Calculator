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
            .rpc('get_blog_stats');
        
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
