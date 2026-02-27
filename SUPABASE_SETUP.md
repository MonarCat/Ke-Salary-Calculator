# Supabase Authentication Setup Guide

This guide will walk you through setting up Supabase authentication for the Kenya Salary Calculator.

## Prerequisites

- A Supabase account (free tier is sufficient)
- Access to your website's domain

## Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign up or log in
2. Click "New Project"
3. Enter the following details:
   - **Name**: Kenya Salary Calculator
   - **Database Password**: Create a secure password (save it somewhere safe)
   - **Region**: Choose the region closest to your users (e.g., Africa - South Africa)
   - **Pricing Plan**: Free tier is sufficient
4. Click "Create new project"
5. Wait for your project to be set up (this may take 1-2 minutes)

## Step 2: Get Your Project Credentials

1. Once your project is ready, go to **Settings** (gear icon in the sidebar)
2. Click on **API** in the settings menu
3. You'll see two important values:
   - **Project URL**: Copy this value (e.g., `https://xxxxxxxxxxxxx.supabase.co`)
   - **anon public**: Copy this key (it's the public API key)

## Step 3: Configure Your Application

1. Open the file `supabase-config.js` in your project
2. Replace the placeholder values with your actual credentials:

```javascript
const SUPABASE_URL = 'https://xxxxxxxxxxxxx.supabase.co'; // Your Project URL
const SUPABASE_ANON_KEY = 'your-anon-key-here'; // Your anon public key
```

3. Save the file

## Step 4: Configure Authentication Providers

### Email/Password Authentication (Default - Already Enabled)

Email/password authentication is enabled by default. No additional configuration needed.

### Google OAuth (Optional)

To enable Google sign-in:

1. In your Supabase dashboard, go to **Authentication** > **Providers**
2. Find **Google** in the list and click **Enable**
3. You'll need to create a Google OAuth application:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable the Google+ API
   - Create OAuth credentials (Web application)
   - Add authorized redirect URIs (CRITICAL - must match exactly):
     - `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
     - Replace YOUR-PROJECT-REF with your actual Supabase project reference (from your SUPABASE_URL)
   - Copy the Client ID and Client Secret
4. Back in Supabase, paste your Google Client ID and Client Secret
5. Click **Save**

**Note:** If you experience OAuth denial issues, see `OAUTH_CONFIGURATION.md` for detailed troubleshooting steps.

## Step 5: Configure Site URL and Redirect URLs

1. In Supabase dashboard, go to **Authentication** > **URL Configuration**
2. Set the **Site URL** to your production domain: `https://salarycalculator.co.ke`
3. Add **Redirect URLs** (add all of these):
   - `https://salarycalculator.co.ke`
   - `https://salarycalculator.co.ke/`
   - `https://salarycalculator.co.ke/auth.html`
   - `https://salarycalculator.co.ke/admin-auth.html`
   - `https://salarycalculator.co.ke/calculator.html`
   - `http://localhost:8080` (for local testing)
   - `http://localhost:8080/` (for local testing)
   - `http://localhost:3000` (for local testing)
   - `http://localhost:3000/` (for local testing)
4. Click **Save**

**Important:** Include both URLs with and without trailing slashes for best compatibility.

## Step 6: Set Up Admin Access (Required for Admin Dashboard)

The admin dashboard at `/admin-auth.html` requires an `admin_users` table in your Supabase database with appropriate Row Level Security (RLS) policies.

### 6a: Run the Admin Setup SQL Script

1. In the Supabase dashboard, go to **SQL Editor**
2. Click **New query**
3. Open the file `admin-setup.sql` from this repository and paste its entire contents into the editor
4. Click **Run** (or press `Ctrl+Enter`)

This script will:
- Create the `admin_users` table
- Enable Row Level Security on it
- Create RLS policies so each user can only check their own admin status
- Create helper functions (`is_admin`, `grant_admin_access`, etc.)
- Add admin-aware policies on `blog_posts` and `post_comments`

### 6b: Create the Admin User Account

The admin user must exist in Supabase Auth **before** being added to `admin_users`.

1. Navigate to `https://salarycalculator.co.ke/auth.html` (or your local equivalent)
2. Sign up with:
   - **Email:** `kesalarycalculator@gmail.com`
   - **Password:** *(choose a strong password)*
   - **Name:** Admin
   - **Account Type:** Individual
3. Check the inbox for `kesalarycalculator@gmail.com` and confirm the email if email confirmation is enabled

### 6c: Grant Admin Privileges

After the user has signed up and confirmed their email, run the following SQL in the Supabase **SQL Editor** to insert them into `admin_users`:

```sql
INSERT INTO admin_users (user_id, email, is_super_admin)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'kesalarycalculator@gmail.com'),
  'kesalarycalculator@gmail.com',
  TRUE
)
ON CONFLICT (email) DO NOTHING;
```

**Important:** If the `SELECT` returns `NULL` (user not found), make sure the sign-up in step 6b was completed and the email was confirmed.

### 6d: Access the Admin Dashboard

1. Navigate to `https://salarycalculator.co.ke/admin-auth.html`
2. Sign in with `kesalarycalculator@gmail.com` and the password you created
3. On successful authentication, the page verifies the `admin_users` record and redirects you to `/admin.html`

### Troubleshooting Admin Access

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| "Access denied. You do not have admin privileges." | User exists but is not in `admin_users` | Run the INSERT in step 6c |
| "Invalid email or password." | Wrong credentials or user not confirmed | Confirm email or reset password |
| "Authentication service is unavailable." | `supabase-config.js` not configured | Update `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `supabase-config.js` |
| Blank page / spinner forever | `admin_users` table missing | Run `admin-setup.sql` (step 6a) |

## Step 7: Configure Email Templates (Optional)

You can customize the email templates sent to users:

1. Go to **Authentication** > **Email Templates**
2. Customize the following templates:
   - **Confirm signup**: Sent when a user signs up
   - **Magic Link**: Sent for passwordless login
   - **Change Email Address**: Sent when changing email
   - **Reset Password**: Sent when resetting password

## Step 8: Set Up Database Tables (Optional)

If you want to store user profiles or additional data:

1. Go to **Database** > **Tables**
2. Create a new table called `profiles`:

```sql
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to read their own profile
CREATE POLICY "Users can view their own profile" 
  ON profiles FOR SELECT 
  USING (auth.uid() = id);

-- Create policy to allow users to update their own profile
CREATE POLICY "Users can update their own profile" 
  ON profiles FOR UPDATE 
  USING (auth.uid() = id);

-- Create policy to allow users to insert their own profile
CREATE POLICY "Users can insert their own profile" 
  ON profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);
```

## Step 9: Test Your Setup

1. Open your website in a browser
2. Click on "Sign In" in the navigation
3. Try signing up with a new account
4. Check your email for the verification link
5. Try logging in with your credentials

## Security Best Practices

1. **Never commit your Supabase credentials to version control**
   - Add `supabase-config.js` to `.gitignore` if it contains real credentials
   - For production, use environment variables

2. **Enable Row Level Security (RLS)**
   - Always enable RLS on your database tables
   - Create appropriate policies for data access

3. **Use HTTPS in production**
   - Ensure your site is served over HTTPS

4. **Monitor authentication attempts**
   - Check the Supabase dashboard regularly for suspicious activity

5. **Set up rate limiting**
   - Supabase has built-in rate limiting, but monitor your usage

## Troubleshooting

### "Supabase is not configured" error

- Make sure you've updated `supabase-config.js` with your actual credentials
- Check that the Supabase JS library is loaded (check browser console for errors)

### Email verification not working

- Check your email spam folder
- Verify that the Site URL is correctly set in Supabase dashboard
- Check that redirect URLs include your domain

### Google sign-in not working

- Verify OAuth credentials are correct
- Check that authorized redirect URIs match exactly
- Ensure the Google+ API is enabled in Google Cloud Console

## Support

For issues with Supabase:
- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Discord Community](https://discord.supabase.com)

For issues with the Kenya Salary Calculator:
- Open an issue on the GitHub repository
- Contact: support@salarycalculator.co.ke

## Next Steps

Once authentication is working:
- Consider adding user profiles
- Store user preferences and saved calculations
- Implement premium features for authenticated users
- Add social sharing features

## Cost Considerations

Supabase Free Tier includes:
- Up to 50,000 monthly active users
- 500 MB database space
- 1 GB file storage
- 2 GB bandwidth

For most small to medium applications, the free tier is sufficient. Monitor your usage in the Supabase dashboard.
