# Deployment Guide

This guide explains how to deploy the Kenya Salary Calculator with Supabase authentication to various hosting platforms.

## Prerequisites

Before deploying:
1. ✅ Complete the Supabase setup (see [SUPABASE_SETUP.md](SUPABASE_SETUP.md))
2. ✅ Update `supabase-config.js` with your credentials
3. ✅ Test locally to ensure everything works

## Deployment Options

### Option 1: GitHub Pages (Recommended for Static Sites)

GitHub Pages is free and perfect for static sites like this one.

#### Steps:

1. **Push your code to GitHub** (if not already done):
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Enable GitHub Pages**:
   - Go to your repository on GitHub
   - Click **Settings** → **Pages**
   - Under "Source", select your branch (usually `main`)
   - Select `/root` as the folder
   - Click **Save**

3. **Update Supabase Redirect URLs**:
   - In Supabase dashboard, go to **Authentication** → **URL Configuration**
   - Add your GitHub Pages URL (e.g., `https://username.github.io/Ke-Salary-Calculator/`)

4. **Access your site**:
   - Your site will be available at: `https://username.github.io/repository-name/`
   - GitHub Pages typically takes 1-2 minutes to build and deploy

**Important Notes:**
- GitHub Pages URLs use HTTPS by default ✅
- Free for public repositories
- Supports custom domains

### Option 2: Netlify

Netlify offers excellent performance and easy deployment.

#### Steps:

1. **Sign up at [Netlify](https://www.netlify.com/)**

2. **Deploy via Git** (Recommended):
   - Click "Add new site" → "Import an existing project"
   - Connect to GitHub and select your repository
   - Build settings:
     - Build command: (leave empty for static sites)
     - Publish directory: `/`
   - Click "Deploy site"

3. **Or deploy via drag-and-drop**:
   - Zip your project folder
   - Drag and drop to Netlify dashboard

4. **Update Supabase URLs**:
   - Copy your Netlify URL (e.g., `https://your-site.netlify.app`)
   - Add it to Supabase redirect URLs

5. **Optional: Custom Domain**:
   - Go to Domain settings in Netlify
   - Add your custom domain (e.g., `salarycalculator.co.ke`)
   - Update DNS records as instructed
   - Update Supabase redirect URLs with custom domain

**Advantages:**
- ✅ Automatic deployments from Git
- ✅ Free SSL certificates
- ✅ CDN included
- ✅ Easy custom domain setup

### Option 3: Vercel

Vercel is optimized for modern web projects.

#### Steps:

1. **Sign up at [Vercel](https://vercel.com/)**

2. **Deploy**:
   - Click "Add New" → "Project"
   - Import your GitHub repository
   - Framework Preset: Other (static site)
   - Click "Deploy"

3. **Update Supabase URLs**:
   - Copy your Vercel URL (e.g., `https://your-project.vercel.app`)
   - Add to Supabase redirect URLs

4. **Custom Domain** (Optional):
   - Go to project Settings → Domains
   - Add custom domain
   - Follow DNS configuration instructions
   - Update Supabase accordingly

### Option 4: Traditional Web Hosting (cPanel, etc.)

For traditional shared hosting with cPanel or FTP access.

#### Steps:

1. **Prepare files**:
   - Ensure `supabase-config.js` has correct credentials
   - All files should be ready for production

2. **Upload via FTP/SFTP**:
   - Connect to your hosting via FTP client (FileZilla, etc.)
   - Upload all files to `public_html` or your web root directory
   - Maintain file structure

3. **Or upload via cPanel File Manager**:
   - Login to cPanel
   - Open File Manager
   - Navigate to public_html
   - Upload all project files
   - Extract if uploaded as ZIP

4. **Configure domain**:
   - Ensure your domain points to the hosting
   - SSL certificate should be installed (Let's Encrypt is free)

5. **Update Supabase URLs**:
   - Add your domain to Supabase redirect URLs
   - Test authentication flows

## Post-Deployment Configuration

### 1. Update Supabase Settings

After deploying, always update your Supabase project:

```
Authentication → URL Configuration:
- Site URL: https://your-production-domain.com
- Redirect URLs:
  - https://your-production-domain.com
  - https://your-production-domain.com/auth.html
  - https://your-production-domain.com/index.html
```

### 2. Test Authentication

After deployment, test:
- ✅ Sign up with new account
- ✅ Email verification works
- ✅ Login with credentials
- ✅ Google OAuth (if configured)
- ✅ Password reset
- ✅ Logout functionality

### 3. Enable Custom Domain (Optional)

For `salarycalculator.co.ke`:

1. **Get DNS settings** from your hosting provider
2. **Update DNS records** at your domain registrar:
   ```
   Type: A
   Name: @
   Value: [Your hosting IP]
   
   Type: CNAME
   Name: www
   Value: your-domain.com
   ```
3. **Wait for DNS propagation** (can take up to 48 hours)
4. **Enable SSL certificate** (Let's Encrypt via hosting control panel)
5. **Update Supabase redirect URLs** with custom domain

## Security Best Practices

### Before Production:

1. **Never commit real credentials**:
   ```bash
   # Add to .gitignore
   supabase-config.production.js
   ```

2. **Use environment variables** (for advanced deployments):
   - Create separate config for production
   - Use hosting platform's environment variable features
   - Keep credentials secure

3. **Enable HTTPS**:
   - All hosting options above support free SSL
   - Force HTTPS redirects in hosting settings

4. **Monitor usage**:
   - Check Supabase dashboard regularly
   - Monitor for unusual authentication attempts
   - Set up rate limiting if needed

## Troubleshooting

### Issue: Authentication not working after deployment

**Solution:**
- Verify Supabase URLs are updated with production domain
- Check browser console for errors
- Ensure `supabase-config.js` has correct credentials
- Verify site is served over HTTPS

### Issue: CORS errors

**Solution:**
- Supabase automatically handles CORS for configured redirect URLs
- Ensure your production URL is added to Supabase redirect URLs
- Check that Site URL matches your actual domain

### Issue: Email verification not working

**Solution:**
- Check Supabase email templates have correct redirect URLs
- Verify Site URL in Supabase matches your production domain
- Check spam folder
- Test with different email providers

### Issue: Google OAuth not working

**Solution:**
- Verify Google OAuth credentials in Supabase
- Update authorized redirect URIs in Google Cloud Console
- Ensure redirect URI matches: `https://YOUR-PROJECT.supabase.co/auth/v1/callback`

## Performance Optimization

### 1. Enable Caching

For Netlify:
```toml
# netlify.toml
[[headers]]
  for = "/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "*.html"
  [headers.values]
    Cache-Control = "public, max-age=0, must-revalidate"
```

### 2. Compress Images

Images in the project are large. Consider:
- Using WebP format
- Compressing with TinyPNG or similar
- Using responsive images with srcset

### 3. Minify Resources

For production:
- Minify CSS files
- Minify JavaScript files
- Consider using a build tool

## Monitoring and Analytics

### Set up monitoring:

1. **Google Analytics** (Optional):
   - Add tracking code to all pages
   - Monitor user behavior

2. **Supabase Dashboard**:
   - Monitor authentication metrics
   - Check API usage
   - Review error logs

3. **Uptime Monitoring**:
   - Use services like UptimeRobot (free)
   - Get alerts if site goes down

## Scaling Considerations

As your site grows:

### Free Tier Limits (Supabase):
- 50,000 monthly active users
- 500 MB database space
- 1 GB file storage
- 2 GB bandwidth

### When to upgrade:
- Consider paid tier when approaching limits
- Monitor usage in Supabase dashboard
- Supabase Pro tier: $25/month (unlimited)

## Backup and Maintenance

### Regular Tasks:

1. **Weekly**:
   - Check Supabase dashboard for unusual activity
   - Review error logs

2. **Monthly**:
   - Backup user data (if storing additional data)
   - Review and update dependencies
   - Test all authentication flows

3. **Quarterly**:
   - Review security settings
   - Update documentation
   - Check for Supabase updates/announcements

## Support

For deployment issues:
- **GitHub Issues**: [Repository Issues](https://github.com/MonarCat/Ke-Salary-Calculator/issues)
- **Supabase Support**: [Discord](https://discord.supabase.com)
- **Hosting Support**: Check your hosting provider's documentation

## Next Steps

After successful deployment:
1. ✅ Test thoroughly on production
2. ✅ Share with users
3. ✅ Monitor feedback
4. ✅ Consider adding premium features for authenticated users
5. ✅ Set up user data storage (profiles, saved calculations)

---

**Congratulations!** Your Kenya Salary Calculator with authentication is now live! 🎉🇰🇪
