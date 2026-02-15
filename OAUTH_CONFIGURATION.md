# OAuth Configuration Guide

This document explains how to ensure Google OAuth Sign-In works properly for the Kenya Salary Calculator.

## Prerequisites

✅ Supabase project is set up with credentials in `supabase-config.js`
✅ Google OAuth is enabled in Supabase Dashboard
✅ Google Cloud Console OAuth credentials are created

## Required Configuration

### 1. Supabase Configuration

The following URLs must be configured in your Supabase Dashboard under **Authentication** > **URL Configuration**:

#### Site URL
```
https://salarycalculator.co.ke
```
Or your actual production domain.

#### Redirect URLs (All must be added)
```
https://salarycalculator.co.ke
https://salarycalculator.co.ke/
https://salarycalculator.co.ke/auth.html
https://salarycalculator.co.ke/calculator.html
https://wznopthjoaqusalqoyru.supabase.co/auth/v1/callback
http://localhost:8080
http://localhost:8080/
http://localhost:3000
http://localhost:3000/
```

**Important Notes:**
- Include both with and without trailing slashes
- Include the Supabase callback URL: `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
- Add all local development URLs for testing

### 2. Google Cloud Console Configuration

#### OAuth 2.0 Authorized Redirect URIs

In your Google Cloud Console, under **APIs & Services** > **Credentials** > Your OAuth 2.0 Client:

Add these Authorized Redirect URIs:
```
https://wznopthjoaqusalqoyru.supabase.co/auth/v1/callback
http://localhost:8080/auth/v1/callback
http://localhost:3000/auth/v1/callback
```

**Format:**
```
https://YOUR-SUPABASE-PROJECT-REF.supabase.co/auth/v1/callback
```

Replace `YOUR-SUPABASE-PROJECT-REF` with your actual Supabase project reference ID.

### 3. Supabase Google Provider Setup

In Supabase Dashboard, go to **Authentication** > **Providers** > **Google**:

1. ✅ Enable the Google provider
2. Add your Google OAuth credentials:
   - Client ID (from Google Cloud Console)
   - Client Secret (from Google Cloud Console)
3. Click **Save**

## Common Issues and Solutions

### Issue 1: "redirect_uri_mismatch" Error

**Cause:** The redirect URL in your request doesn't match any authorized redirect URIs in Google Cloud Console.

**Solution:**
1. Check your Supabase project reference ID (it's in your SUPABASE_URL)
2. Ensure this exact URL is in Google Cloud Console:
   ```
   https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback
   ```
3. Wait 5 minutes after adding the URL for Google to propagate changes

### Issue 2: "Access Denied" After Google Login

**Cause:** The redirect URL after authentication is not in Supabase's allowed redirect URLs.

**Solution:**
1. Go to Supabase Dashboard > Authentication > URL Configuration
2. Add your site's root URL to Redirect URLs:
   ```
   https://salarycalculator.co.ke
   https://salarycalculator.co.ke/
   ```
3. Save changes

### Issue 3: Google Sign-In Button Does Nothing

**Cause:** Popup blockers or Supabase client not initialized.

**Solution:**
1. Check browser console for errors
2. Verify `supabase-config.js` has correct credentials
3. Ensure Supabase JS library is loaded (check `<script>` tag in HTML)
4. Disable popup blockers for your domain

### Issue 4: "Invalid Client" Error

**Cause:** Google OAuth credentials are incorrect or not configured in Supabase.

**Solution:**
1. Verify Client ID and Client Secret in Supabase match Google Cloud Console
2. Ensure OAuth consent screen is configured in Google Cloud Console
3. Check that the OAuth client is for "Web application" type

### Issue 5: Works Locally But Not in Production

**Cause:** Production URLs not added to allowed redirect URIs.

**Solution:**
1. Add production domain to Google Cloud Console authorized redirect URIs
2. Add production domain to Supabase redirect URLs
3. Ensure Site URL in Supabase matches your production domain

## Testing OAuth Flow

### Local Testing (localhost:8080)

1. Start local server:
   ```bash
   python3 -m http.server 8080
   ```

2. Open browser to `http://localhost:8080`

3. Click "Sign Up" or "Sign In"

4. Click "Continue with Google"

5. You should be redirected to Google sign-in

6. After signing in, you should be redirected back to the home page

### Production Testing

1. Deploy your changes to production

2. Visit your production URL

3. Follow the same sign-in flow

4. Verify redirect works correctly

## Verification Checklist

Before going live, verify:

- [ ] Supabase URL and API key are correct in `supabase-config.js`
- [ ] Google provider is enabled in Supabase Dashboard
- [ ] Google Client ID and Secret are configured in Supabase
- [ ] Site URL is set in Supabase (production domain)
- [ ] All redirect URLs are added in Supabase
- [ ] Supabase callback URL is in Google Cloud Console
- [ ] OAuth consent screen is configured in Google Cloud Console
- [ ] Test flow works on localhost
- [ ] Test flow works on production domain

## Current Configuration

Based on your `supabase-config.js`, your Supabase project is:

**Project URL:** `https://wznopthjoaqusalqoyru.supabase.co`

**Required Google Redirect URI:**
```
https://wznopthjoaqusalqoyru.supabase.co/auth/v1/callback
```

Make sure this exact URL is in your Google Cloud Console authorized redirect URIs.

## Support

If you continue to experience issues:

1. Check Supabase Dashboard > Authentication > Logs for error details
2. Check browser console for JavaScript errors
3. Review Google Cloud Console OAuth consent screen status
4. Ensure you're not exceeding Google OAuth rate limits

## Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Supabase OAuth Guide](https://supabase.com/docs/guides/auth/social-login/auth-google)
