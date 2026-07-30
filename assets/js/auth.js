// Authentication Logic

// Constants
const OAUTH_REDIRECT_DELAY_MS = 1000; // Delay before redirecting after OAuth callback
const AUTH_REDIRECT_FALLBACK = '/';
const SESSION_EXPIRY_SKEW_MS = 5000;
const ALLOWED_REDIRECT_PATHS = new Set([
    '/',
    '/employees.html',
    '/profile.html',
    '/payroll-report.html',
    '/payroll-history.html',
    '/organisation-profile.html',
    '/calculator.html',
    '/account',
    '/account.html',
    '/admin.html'
]);
const ALLOWED_CALCULATOR_TABS = new Set(['grossup', 'comparison', 'percentile', 'payslip']);

let authRedirectInProgress = false;

function getSafeRedirectTarget(rawRedirect, fallback = AUTH_REDIRECT_FALLBACK) {
    if (typeof rawRedirect !== 'string') return fallback;

    try {
        const parsed = new URL(rawRedirect, window.location.origin);
        const lowerRawRedirect = rawRedirect.toLowerCase();
        if (parsed.origin !== window.location.origin) return fallback;
        if (!parsed.pathname.startsWith('/') || parsed.pathname.startsWith('//')) return fallback;
        if (parsed.pathname.includes('\\') || parsed.pathname.includes('..')) return fallback;
        if (lowerRawRedirect.includes('%2f%2f') || lowerRawRedirect.includes('%5c')) return fallback;
        if (!ALLOWED_REDIRECT_PATHS.has(parsed.pathname)) return fallback;

        if (parsed.pathname === '/calculator.html') {
            const tab = parsed.searchParams.get('tab');
            if (!tab) return '/calculator.html';
            if (!ALLOWED_CALCULATOR_TABS.has(tab)) return '/calculator.html';
            return `/calculator.html?tab=${encodeURIComponent(tab)}`;
        }

        return parsed.pathname;
    } catch (_) {
        return fallback;
    }
}

function getRequestedRedirectTarget() {
    const params = new URLSearchParams(window.location.search);
    const rawRedirect = params.get('redirect') || AUTH_REDIRECT_FALLBACK;
    return getSafeRedirectTarget(rawRedirect, AUTH_REDIRECT_FALLBACK);
}

function isSessionFresh(session) {
    if (!session || !session.user || !session.access_token) return false;
    if (typeof session.expires_at === 'number') {
        const expiresAtMs = session.expires_at * 1000;
        if (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now() + SESSION_EXPIRY_SKEW_MS) {
            return false;
        }
    }
    return true;
}

async function hasVerifiedSession() {
    if (!supabaseClient || !supabaseClient.auth) return false;
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!isSessionFresh(session)) return false;

        // Verify the session token is still valid server-side before redirecting.
        const { data, error } = await supabaseClient.auth.getUser();
        if (error || !data || !data.user) return false;
        return data.user.id === session.user.id;
    } catch (_) {
        return false;
    }
}

function redirectFromAuthPage() {
    if (authRedirectInProgress) return;
    authRedirectInProgress = true;
    try {
        const redirectTo = getRequestedRedirectTarget();
        window.location.replace(redirectTo);
    } catch (_) {
        authRedirectInProgress = false;
        window.location.replace(AUTH_REDIRECT_FALLBACK);
    }
}

// Switch between login and signup tabs
function switchAuthTab(tab) {
    const tabs = document.querySelectorAll('.auth-tab');
    const forms = document.querySelectorAll('.auth-form-container');
    
    tabs.forEach(t => t.classList.remove('active'));
    forms.forEach(f => f.style.display = 'none');
    
    const activeTab = document.querySelector(`[data-tab="${tab}"]`);
    const activeForm = document.getElementById(`${tab}-form`);
    
    if (activeTab) activeTab.classList.add('active');
    if (activeForm) activeForm.style.display = 'block';
    
    // Clear messages
    clearAuthMessages();
}

// Clear all auth messages
function clearAuthMessages() {
    const messages = document.querySelectorAll('.auth-message');
    messages.forEach(msg => {
        msg.style.display = 'none';
        msg.className = 'auth-message';
        msg.textContent = '';
    });
}

// Show message
function showMessage(elementId, message, type) {
    const messageEl = document.getElementById(elementId);
    if (messageEl) {
        messageEl.textContent = message;
        messageEl.className = `auth-message ${type}`;
        messageEl.style.display = 'block';
    }
}

// Handle Login
async function handleLogin(event) {
    event.preventDefault();
    
    if (!isSupabaseConfigured()) {
        showMessage('login-message', 'Supabase is not configured. Please update supabase-config.js with your project credentials.', 'error');
        return;
    }
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    // Show loading state
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="loading-spinner"></span> Signing in...';
    submitBtn.disabled = true;
    
    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) throw error;
        
        showMessage('login-message', '✅ Login successful! Redirecting...', 'success');
        
        // Redirect after 1 second, respecting the ?redirect= query param.
        // Employer accounts with an incomplete profile are sent to the Organisation
        // Profile setup page so they can fill in their company details.
        const loginRedirectTo = getRequestedRedirectTarget();
        setTimeout(async () => {
            try {
                // Only check for employer redirect when no specific redirect is requested
                const shouldCheckEmployerRedirect =
                    loginRedirectTo === AUTH_REDIRECT_FALLBACK &&
                    supabaseClient &&
                    isSupabaseConfigured() &&
                    data &&
                    data.user;

                if (shouldCheckEmployerRedirect) {
                    const { data: profile } = await supabaseClient
                        .from('user_profiles')
                        .select('account_type')
                        .eq('id', data.user.id)
                        .maybeSingle();
                    if (profile && profile.account_type === 'employer') {
                        const { data: employer } = await supabaseClient
                            .from('employers')
                            .select('profile_complete')
                            .eq('user_id', data.user.id)
                            .maybeSingle();
                        if (!employer || !employer.profile_complete) {
                            window.location.replace('/organisation-profile.html');
                            return;
                        }
                    }
                }
            } catch (_) {}
            window.location.replace(loginRedirectTo);
        }, 1000);
        
    } catch (error) {
        // Detect unverified email and offer resend link
        if (error.message && error.message.toLowerCase().includes('email not confirmed')) {
            showMessage('login-message',
                `Your email has not been verified yet. Please check your inbox (and <strong>Spam / Junk</strong> folder) for the confirmation link.<br><br>
                <button onclick="resendVerificationEmail()" style="background:#006600;color:white;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-size:0.9em;">
                    <i class="fas fa-envelope"></i> Resend Verification Email
                </button>`, 'error');
        } else {
            showMessage('login-message', error.message || 'Login failed. Please check your credentials.', 'error');
        }
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Resend email verification link
async function resendVerificationEmail() {
    const emailInput = document.getElementById('login-email');
    const email = emailInput ? emailInput.value : '';
    if (!email) {
        showMessage('login-message', 'Please enter your email address first.', 'error');
        return;
    }
    try {
        const { error } = await supabaseClient.auth.resend({
            type: 'signup',
            email: email,
        });
        if (error) throw error;
        showMessage('login-message', `Verification email resent. Please check your inbox and Spam folder.`, 'success');
    } catch (err) {
        showMessage('login-message', 'Failed to resend verification email: ' + (err.message || 'Please try again.'), 'error');
    }
}
window.resendVerificationEmail = resendVerificationEmail;

// Handle Signup
async function handleSignup(event) {
    event.preventDefault();
    
    if (!isSupabaseConfigured()) {
        showMessage('signup-message', 'Supabase is not configured. Please update supabase-config.js with your project credentials.', 'error');
        return;
    }
    
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;
    const accountType = document.getElementById('account-type').value;
    const organizationName = document.getElementById('organization-name').value;
    
    // Validate account type
    if (!accountType) {
        showMessage('signup-message', 'Please select an account type.', 'error');
        return;
    }
    
    // Validate organization name for employer accounts
    if (accountType === 'employer' && !organizationName) {
        showMessage('signup-message', 'Please enter your organization name.', 'error');
        return;
    }
    
    // Validate password match
    if (password !== confirmPassword) {
        showMessage('signup-message', 'Passwords do not match!', 'error');
        return;
    }
    
    // Validate password length
    if (password.length < 6) {
        showMessage('signup-message', 'Password must be at least 6 characters long.', 'error');
        return;
    }

    // Show loading state
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="loading-spinner"></span> Creating account...';
    submitBtn.disabled = true;
    
    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: {
                emailRedirectTo: window.location.origin + '/auth.html',
                data: {
                    full_name: name,
                    account_type: accountType,
                    organization_name: organizationName || null
                }
            }
        });
        
        if (error) throw error;

        // Detect duplicate email: Supabase returns an empty identities array (not an error)
        // when "Email Enumeration Protection" is enabled in Supabase Auth settings and
        // the submitted email is already registered. This prevents user enumeration attacks
        // but means we must explicitly check identities to give the user accurate feedback.
        if (data.user && data.user.identities && data.user.identities.length === 0) {
            showMessage('signup-message',
                `This email is already registered. Please <button type="button" onclick="switchAuthTab('login')" class="inline-link-btn">sign in</button> instead, or use a different email.`,
                'error');
            return;
        }
        
        showMessage('signup-message', `✅ Account created! 📧 Please check your email to verify your account.<br><br>
            <small><strong>Tip:</strong> If you don't see our email in your inbox, please check your <strong>Spam / Junk folder</strong> and mark it as "Not Spam" to ensure links work properly.<br>
            For assistance, contact <a href="mailto:support@salarycalculator.co.ke">support@salarycalculator.co.ke</a></small>`, 'success');
        
        // Reset form
        event.target.reset();
        document.getElementById('organization-fields').style.display = 'none';
        
    } catch (error) {
        // Provide a friendlier message for the known Supabase trigger failure
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('database error saving new user')) {
            showMessage('signup-message',
                'We could not complete your registration due to a temporary server issue. ' +
                'Please try again in a moment or contact <a href="mailto:support@salarycalculator.co.ke">support@salarycalculator.co.ke</a> if the problem persists.',
                'error');
        } else {
            // Escape error.message before inserting into innerHTML to prevent XSS
            const escapeHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            showMessage('signup-message', escapeHtml(error.message || 'Signup failed. Please try again.'), 'error');
        }
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Toggle organization fields based on account type
function toggleOrganizationFields() {
    const accountType = document.getElementById('account-type').value;
    const organizationFields = document.getElementById('organization-fields');
    const organizationNameInput = document.getElementById('organization-name');
    
    if (accountType === 'employer') {
        organizationFields.style.display = 'block';
        organizationNameInput.required = true;
    } else {
        organizationFields.style.display = 'none';
        organizationNameInput.required = false;
        organizationNameInput.value = '';
    }
}

// Handle Google Sign In
async function handleGoogleSignIn() {
    const activeTab = document.querySelector('.auth-tab.active').getAttribute('data-tab');
    const messageId = activeTab === 'login' ? 'login-message' : 'signup-message';
    
    if (!isSupabaseConfigured()) {
        showMessage(messageId, 'Supabase is not configured. Please update supabase-config.js with your project credentials.', 'error');
        return;
    }
    
    try {
        // Use a stable callback target that matches Supabase redirect URL setup.
        const baseUrl = window.location.origin + '/auth.html';
        const redirectParam = new URLSearchParams(window.location.search).get('redirect');
        const redirectTo = redirectParam
            ? `${baseUrl}?redirect=${encodeURIComponent(redirectParam)}`
            : baseUrl;
        
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                // Redirect back to the current auth page to handle the OAuth callback
                redirectTo
            }
        });
        
        if (error) throw error;
        
    } catch (error) {
        console.error('Google sign in error:', error);
        showMessage(messageId, 'Failed to sign in with Google. Please try again.', 'error');
    }
}

const AUTH_PASSWORD_RESET_FUNCTION_URL =
    window.PASSWORD_RESET_FUNCTION_URL ||
    'https://wznopthjoaqusalqoyru.supabase.co/functions/v1/password-reset';

const FORGOT_PASSWORD_SENDING_LABEL = 'Sending…';

function setResetButtonState(button, isLoading) {
    if (!button) return;

    if (isLoading) {
        button.dataset.originalText = button.textContent;
        button.textContent = FORGOT_PASSWORD_SENDING_LABEL;
        button.disabled = true;
        button.style.pointerEvents = 'none';
        button.setAttribute('aria-disabled', 'true');
    } else {
        button.textContent = button.dataset.originalText || 'Forgot Password?';
        button.disabled = false;
        button.style.pointerEvents = '';
        button.removeAttribute('aria-disabled');
    }
}

async function sendResetEmail(email) {
    const btn = document.getElementById('forgot-password-btn');
    setResetButtonState(btn, true);

    try {
        const res = await fetch(AUTH_PASSWORD_RESET_FUNCTION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'send', email }),
        });

        // Always show success — never confirm whether email exists
        showMessage('login-message', 'If that email is registered, a reset link is on its way.', 'success');

    } catch (err) {
        console.error('Password reset request failed:', err?.message || err);
        // Still show success to avoid user enumeration
        showMessage('login-message', 'If that email is registered, a reset link is on its way.', 'success');
    } finally {
        setResetButtonState(btn, false);
    }
}

// Handle Forgot Password
async function handleForgotPassword(event) {
    if (event) event.preventDefault();

    const emailInput = document.getElementById('login-email');
    const email = emailInput ? emailInput.value.trim().toLowerCase() : '';

    if (!email) {
        showMessage('login-message', 'Please enter your email address first.', 'error');
        return;
    }

    await sendResetEmail(email);
}

// Show Terms and Conditions
function showTerms(event) {
    if (event) event.preventDefault();
    
    const termsText = `
        <h3>Terms & Conditions</h3>
        <p>By using the Kenya Salary Calculator, you agree to:</p>
        <ol>
            <li>Use the calculator for informational purposes only</li>
            <li>Understand that calculations are estimates</li>
            <li>Consult with a qualified accountant for official computations</li>
            <li>Protect your account credentials</li>
            <li>Not misuse the service</li>
        </ol>
        <p>For more information, contact info@salarycalculator.co.ke</p>
    `;
    
    showMessage('signup-message', termsText, 'info');
}

// Handle Logout
async function handleLogout() {
    try {
        const { error } = await supabaseClient.auth.signOut();
        
        if (error) throw error;
        
        window.location.href = '/auth.html';
        
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Check Authentication Status
async function checkAuthStatus() {
    if (!supabaseClient || !supabaseClient.auth) {
        return null;
    }
    
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        
        if (session) {
            return session.user;
        }
        return null;
        
    } catch (error) {
        console.error('Auth check error:', error);
        return null;
    }
}

// Initialize auth state listener
if (supabaseClient && supabaseClient.auth) {
    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN') {
            console.log('User signed in:', session.user?.email);

            // Expose email globally so the admin impersonation banner can display it
            if (session?.user?.email) {
                window.__SC_USER_EMAIL = session.user.email;
                window.__SC_EMAIL = session.user.email;
                const emailEl = document.getElementById('sc-admin-email');
                if (emailEl) emailEl.textContent = session.user.email;
            }

            // If we're on the auth page and user signed in, redirect away
            if (window.location.pathname === '/auth.html' || window.location.pathname.endsWith('/auth.html')) {
                setTimeout(async () => {
                    if (isSessionFresh(session) && await hasVerifiedSession()) {
                        redirectFromAuthPage();
                    }
                }, OAUTH_REDIRECT_DELAY_MS);
            }
        } else if (event === 'SIGNED_OUT') {
            console.log('User signed out');
        }
    });
} else {
    console.warn('Supabase client not available. Auth state changes will not be monitored.');
}

// Check if user is logged in on page load (for protected pages)
async function requireAuth() {
    const user = await checkAuthStatus();
    
    if (!user) {
        // Redirect to login page if not authenticated, passing current page as redirect target
        const redirectParam = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.replace('/auth.html?redirect=' + redirectParam);
    }
    
    return user;
}

// Update UI based on auth state
async function updateAuthUI() {
    const user = await checkAuthStatus();
    const authLinks = document.getElementById('auth-links');
    
    if (authLinks) {
        if (user) {
            // User is logged in
            const userName = user.user_metadata?.full_name || user.email.split('@')[0];
            const isEmployer = user.user_metadata?.account_type === 'employer';
            
            authLinks.innerHTML = `
                <div class="user-profile">
                    <button type="button" class="user-welcome-btn" onclick="toggleUserDropdown()" aria-expanded="false" aria-controls="user-dropdown">
                        <span class="user-avatar" aria-hidden="true">
                            ${userName.charAt(0).toUpperCase()}
                        </span>
                        <span class="user-welcome-text">Welcome, ${userName}</span>
                        <i class="fas fa-chevron-down user-welcome-chevron"></i>
                    </button>
                    <div class="user-dropdown" id="user-dropdown" role="menu">
                        <div class="user-dropdown-item">
                            <i class="fas fa-user"></i> ${userName}
                        </div>
                        <div class="user-dropdown-item">
                            <i class="fas fa-envelope"></i> ${user.email}
                        </div>
                        ${isEmployer ? `
                        <div class="user-dropdown-item" onclick="window.location.href='/organisation-profile.html'">
                            <i class="fas fa-building"></i> Organisation Profile
                        </div>
                        ` : ''}
                        <div class="user-dropdown-item" onclick="window.location.href='/profile.html'">
                            <i class="fas fa-id-card"></i> My Profile
                        </div>
                        <div class="user-dropdown-item" onclick="window.location.href='/account'">
                            <i class="fas fa-credit-card"></i> Account &amp; Billing
                        </div>
                        <div class="user-dropdown-divider" role="separator"></div>
                        <a class="user-dropdown-item user-dropdown-item--support" href="/donate.html" role="menuitem">
                            <i class="fas fa-heart" aria-hidden="true"></i> Support KeSalary
                        </a>
                        <div class="user-dropdown-divider" role="separator"></div>
                        <div class="user-dropdown-item" onclick="handleLogout()">
                            <i class="fas fa-sign-out-alt"></i> Logout
                        </div>
                    </div>
                </div>
            `;
        } else {
            // User is not logged in
            authLinks.innerHTML = `
                <a href="/auth.html" class="sign-in-up-btn">
                    <i class="fas fa-user-circle"></i> Sign In/Up
                </a>
            `;
        }
    }
}

// Toggle user dropdown
function toggleUserDropdown() {
    const dropdown = document.getElementById('user-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('active');
        const trigger = document.querySelector('.user-welcome-btn');
        if (trigger) trigger.setAttribute('aria-expanded', dropdown.classList.contains('active'));
    }
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    const userProfile = document.querySelector('.user-profile');
    const dropdown = document.getElementById('user-dropdown');
    
    if (userProfile && dropdown && !userProfile.contains(event.target)) {
        dropdown.classList.remove('active');
        const trigger = userProfile.querySelector('.user-welcome-btn');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
    }
});

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        updateAuthUI();
        redirectIfLoggedIn();
    });
} else {
    updateAuthUI();
    redirectIfLoggedIn();
}

// Redirect away from auth page if already logged in
async function redirectIfLoggedIn() {
    if (!window.location.pathname.includes('auth.html')) return;

    const isLoggedIn = await hasVerifiedSession();
    if (isLoggedIn) {
        // Already logged in — send to requested destination.
        redirectFromAuthPage();
    } else {
        // Not logged in — show the auth container
        const authWrapper = document.querySelector('.auth-wrapper') || document.querySelector('.auth-container');
        if (authWrapper) authWrapper.classList.add('auth-ready');
        // If URL hash is #signup, switch to the sign-up tab
        if (window.location.hash === '#signup') {
            switchAuthTab('signup');
        }
    }
}
