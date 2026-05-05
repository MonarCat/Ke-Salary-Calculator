// Authentication Logic

// Constants
const OAUTH_REDIRECT_DELAY_MS = 1000; // Delay before redirecting after OAuth callback

// hCaptcha widget IDs (populated after the hCaptcha library loads)
let hcaptchaLoginWidgetId = null;
let hcaptchaSignupWidgetId = null;

// Called by the hCaptcha script once it has loaded (onload=onHcaptchaLoad)
function onHcaptchaLoad() {
    if (typeof HCAPTCHA_SITE_KEY === 'undefined' || !HCAPTCHA_SITE_KEY) {
        console.warn('HCAPTCHA_SITE_KEY is not defined. hCaptcha widgets will not be rendered.');
        return;
    }

    const loginEl = document.getElementById('hcaptcha-login');
    if (loginEl && window.hcaptcha) {
        hcaptchaLoginWidgetId = hcaptcha.render(loginEl, { sitekey: HCAPTCHA_SITE_KEY });
    }

    const signupEl = document.getElementById('hcaptcha-signup');
    if (signupEl && window.hcaptcha) {
        hcaptchaSignupWidgetId = hcaptcha.render(signupEl, { sitekey: HCAPTCHA_SITE_KEY });
    }
}
window.onHcaptchaLoad = onHcaptchaLoad;

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
        messageEl.innerHTML = message;
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

    // Require hCaptcha token before attempting sign-in
    const captchaToken = (window.hcaptcha && hcaptchaLoginWidgetId !== null)
        ? hcaptcha.getResponse(hcaptchaLoginWidgetId)
        : '';
    if (!captchaToken) {
        showMessage('login-message', 'Please complete the CAPTCHA verification.', 'error');
        return;
    }

    // Show loading state
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="loading-spinner"></span> Signing in...';
    submitBtn.disabled = true;
    
    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password,
            options: { captchaToken }
        });
        
        if (error) throw error;
        
        showMessage('login-message', '✅ Login successful! Redirecting...', 'success');
        
        // Redirect after 1 second, respecting the ?redirect= query param.
        // Employer accounts with an incomplete profile are sent to the Organisation
        // Profile setup page so they can fill in their company details.
        const loginParams = new URLSearchParams(window.location.search);
        const rawLoginRedirect = loginParams.get('redirect') || '/';
        const loginRedirectTo = (typeof rawLoginRedirect === 'string' && rawLoginRedirect.startsWith('/')) ? rawLoginRedirect : '/';
        setTimeout(async () => {
            try {
                // Only check for employer redirect when no specific redirect is requested
                if (loginRedirectTo === '/' && supabaseClient && isSupabaseConfigured() && data && data.user) {
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
                            window.location.href = '/organisation-profile.html';
                            return;
                        }
                    }
                }
            } catch (_) {}
            window.location.href = loginRedirectTo;
        }, 1000);
        
    } catch (error) {
        // Reset captcha so the user can try again
        if (window.hcaptcha && hcaptchaLoginWidgetId !== null) {
            hcaptcha.reset(hcaptchaLoginWidgetId);
        }
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

    // Require hCaptcha token before attempting sign-up
    const captchaToken = (window.hcaptcha && hcaptchaSignupWidgetId !== null)
        ? hcaptcha.getResponse(hcaptchaSignupWidgetId)
        : '';
    if (!captchaToken) {
        showMessage('signup-message', 'Please complete the CAPTCHA verification.', 'error');
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
                captchaToken,
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
        // Reset captcha so the user can try again
        if (window.hcaptcha && hcaptchaSignupWidgetId !== null) {
            hcaptcha.reset(hcaptchaSignupWidgetId);
        }
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
        // Extract the base URL (origin + pathname without query/hash)
        const baseUrl = window.location.origin + window.location.pathname;
        
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                // Redirect back to the current auth page to handle the OAuth callback
                redirectTo: baseUrl
            }
        });
        
        if (error) throw error;
        
    } catch (error) {
        console.error('Google sign in error:', error);
        showMessage(messageId, 'Failed to sign in with Google. Please try again.', 'error');
    }
}

// Handle Forgot Password
async function handleForgotPassword(event) {
    if (event) event.preventDefault();
    
    if (!isSupabaseConfigured()) {
        showMessage('login-message', 'Supabase is not configured. Please update supabase-config.js with your project credentials.', 'error');
        return;
    }
    
    // Get email from login form if available
    const emailInput = document.getElementById('login-email');
    const email = emailInput ? emailInput.value : '';
    
    if (!email) {
        showMessage('login-message', 'Please enter your email address first.', 'error');
        return;
    }
    
    try {
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/reset-password.html',
        });
        
        if (error) throw error;
        
        showMessage('login-message', `Password reset email sent! 📧 Please check your inbox.<br><br>
            <small><strong>Tip:</strong> If you don't see our email, please check your <strong>Spam / Junk folder</strong> and mark it as "Not Spam" so the reset link works.<br>
            For assistance, contact <a href="mailto:support@salarycalculator.co.ke">support@salarycalculator.co.ke</a></small>`, 'success');
        
    } catch (error) {
        showMessage('login-message', 'Failed to send reset email: ' + error.message, 'error');
    }
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
        <p>For more information, contact support@salarycalculator.co.ke</p>
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
            
            // If we're on the auth page and user signed in, redirect away
            if (window.location.pathname === '/auth.html' || window.location.pathname.endsWith('/auth.html')) {
                const params = new URLSearchParams(window.location.search);
                const rawRedirect = params.get('redirect') || '/';
                const redirectTo = (typeof rawRedirect === 'string' && rawRedirect.startsWith('/')) ? rawRedirect : '/';
                setTimeout(() => {
                    window.location.href = redirectTo;
                }, OAUTH_REDIRECT_DELAY_MS);
            }
        } else if (event === 'PASSWORD_RECOVERY') {
            // Show the password reset form
            showPasswordResetForm();
        } else if (event === 'SIGNED_OUT') {
            console.log('User signed out');
        }
    });
} else {
    console.warn('Supabase client not available. Auth state changes will not be monitored.');
}

// Show password reset form when user clicks reset link from email
// Only used as a fallback on auth.html; reset-password.html has its own dedicated handler.
function showPasswordResetForm() {
    if (!window.location.pathname.includes('auth.html')) return;
    const authWrapper = document.querySelector('.auth-wrapper') || document.querySelector('.auth-container');
    if (!authWrapper) return;
    authWrapper.classList.add('auth-ready');
    authWrapper.innerHTML = `
        <div class="auth-form-container" style="display:block;">
            <h2>🔑 Set New Password</h2>
            <p class="auth-subtitle">Enter your new password below.</p>
            <form onsubmit="handlePasswordUpdate(event)">
                <div class="form-group">
                    <label for="new-password"><i class="fas fa-lock"></i> New Password</label>
                    <div class="password-field-wrapper">
                        <input type="password" id="new-password" required placeholder="Enter new password" minlength="6">
                        <button type="button" class="password-toggle-btn" onclick="togglePasswordVisibility('new-password', this)" aria-label="Show password"><i class="fas fa-eye"></i></button>
                    </div>
                </div>
                <div class="form-group">
                    <label for="confirm-new-password"><i class="fas fa-lock"></i> Confirm Password</label>
                    <div class="password-field-wrapper">
                        <input type="password" id="confirm-new-password" required placeholder="Confirm new password" minlength="6">
                        <button type="button" class="password-toggle-btn" onclick="togglePasswordVisibility('confirm-new-password', this)" aria-label="Show password"><i class="fas fa-eye"></i></button>
                    </div>
                </div>
                <div id="reset-update-message" class="auth-message" style="display:none;"></div>
                <button type="submit" class="auth-button"><i class="fas fa-save"></i> Update Password</button>
            </form>
        </div>
    `;
}

// Handle password update after clicking reset link
async function handlePasswordUpdate(event) {
    event.preventDefault();
    const newPwd = document.getElementById('new-password').value;
    const confirmPwd = document.getElementById('confirm-new-password').value;
    if (newPwd !== confirmPwd) {
        showMessage('reset-update-message', 'Passwords do not match.', 'error');
        return;
    }
    const btn = event.target.querySelector('button[type="submit"]');
    const orig = btn.innerHTML;
    btn.innerHTML = '<span class="loading-spinner"></span> Updating...';
    btn.disabled = true;
    try {
        const { error } = await supabaseClient.auth.updateUser({ password: newPwd });
        if (error) throw error;
        showMessage('reset-update-message', 'Password updated successfully! Redirecting...', 'success');
        setTimeout(() => { window.location.href = '/'; }, 2000);
    } catch (err) {
        showMessage('reset-update-message', err.message || 'Failed to update password.', 'error');
        btn.innerHTML = orig;
        btn.disabled = false;
    }
}

// Check if user is logged in on page load (for protected pages)
async function requireAuth() {
    const user = await checkAuthStatus();
    
    if (!user) {
        // Redirect to login page if not authenticated, passing current page as redirect target
        const redirectParam = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = '/auth.html?redirect=' + redirectParam;
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
            
            // Check if user is admin via the SECURITY DEFINER RPC to avoid
            // recursive RLS evaluation on the admin_users table (which causes 500).
            let isAdmin = false;
            if (supabaseClient && isSupabaseConfigured()) {
                try {
                    const { data, error } = await supabaseClient.rpc('is_admin');
                    isAdmin = !error && data === true;
                } catch (e) {
                    // RPC not available yet – fall through to email fallback
                    isAdmin = false;
                }
            }
            // Email-based fallback so kesalarycalculator@gmail.com always sees the link
            if (!isAdmin) {
                isAdmin = user.email === window.ADMIN_EMAIL;
            }
            
            authLinks.innerHTML = `
                <div class="user-profile">
                    <div class="user-welcome-btn" onclick="toggleUserDropdown()">
                        <div class="user-avatar">
                            ${userName.charAt(0).toUpperCase()}
                        </div>
                        <span class="user-welcome-text">Welcome, ${userName}</span>
                        <i class="fas fa-chevron-down user-welcome-chevron"></i>
                    </div>
                    <div class="user-dropdown" id="user-dropdown">
                        <div class="user-dropdown-item">
                            <i class="fas fa-user"></i> ${userName}
                        </div>
                        <div class="user-dropdown-item">
                            <i class="fas fa-envelope"></i> ${user.email}
                        </div>
                        <div class="user-dropdown-item" onclick="window.location.href='/profile.html'">
                            <i class="fas fa-id-card"></i> My Profile
                        </div>
                        <div class="user-dropdown-item" onclick="window.location.href='/account'">
                            <i class="fas fa-credit-card"></i> Account &amp; Billing
                        </div>
                        ${isEmployer ? `
                        <div class="user-dropdown-item" onclick="window.location.href='/organisation-profile.html'">
                            <i class="fas fa-building"></i> Organisation Profile
                        </div>
                        ` : ''}
                        ${isAdmin ? `
                        <div class="user-dropdown-item" onclick="window.location.href='/admin.html'" style="background: #006600; color: white; font-weight: bold;">
                            <i class="fas fa-tachometer-alt"></i> Admin Dashboard
                        </div>
                        ` : ''}
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
    }
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    const userProfile = document.querySelector('.user-profile');
    const dropdown = document.getElementById('user-dropdown');
    
    if (userProfile && dropdown && !userProfile.contains(event.target)) {
        dropdown.classList.remove('active');
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

    // If the URL hash contains type=recovery, this is a password-reset flow.
    // Let the onAuthStateChange PASSWORD_RECOVERY handler take over; do not redirect.
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    if (hashParams.get('type') === 'recovery') {
        const authWrapper = document.querySelector('.auth-wrapper') || document.querySelector('.auth-container');
        if (authWrapper) authWrapper.classList.add('auth-ready');
        return;
    }

    const user = await checkAuthStatus();
    if (user) {
        // Already logged in — send to homepage
        const params = new URLSearchParams(window.location.search);
        const rawRedirect = params.get('redirect') || '/';
        // Only allow relative paths starting with '/' to prevent open-redirect attacks
        const redirectTo = (typeof rawRedirect === 'string' && rawRedirect.startsWith('/')) ? rawRedirect : '/';
        window.location.href = redirectTo;
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
