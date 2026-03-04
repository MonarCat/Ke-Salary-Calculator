# Blog Admin Setup and Image Requirements

## Admin User Setup

### Step 1: Create Admin Account
The admin user **kesalarycalculator@gmail.com** needs to be created and granted admin access.

1. Navigate to `/auth.html`
2. Sign up with:
   - Email: `kesalarycalculator@gmail.com`
   - Password: (Set a strong password)
   - Name: Admin
   - Account Type: Individual

### Step 2: Run Database Setup Scripts

#### Run Admin Setup SQL
Execute the `admin-setup.sql` script in Supabase SQL Editor to:
- Create `admin_users` table
- Add admin-specific RLS policies
- Create helper functions for admin operations
- Setup real-time view tracking

#### Grant Admin Access
After the user signs up, run this SQL to grant admin privileges:

```sql
INSERT INTO admin_users (user_id, email, is_super_admin)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'kesalarycalculator@gmail.com'),
  'kesalarycalculator@gmail.com',
  TRUE
)
ON CONFLICT (email) DO NOTHING;
```

### Step 3: Access Admin Dashboard
Once admin access is granted:
1. Sign in at `/auth.html` with kesalarycalculator@gmail.com
2. Navigate to `/admin.html`
3. You should see the admin dashboard with:
   - Analytics overview
   - Post management
   - Create/edit post interface
   - Comment moderation

## Admin Dashboard Features

### Dashboard Tab
- View statistics: Total posts, views, comments, reactions
- See recent posts at a glance

### Manage Posts Tab
- View all blog posts in a table
- Edit any post
- Delete posts
- Filter by status

### Create Post Tab
- Rich form for creating/editing posts
- Auto-generate URL slugs from titles
- Set post status (draft, published, archived)
- Add featured images
- HTML content editor

### Comments Tab
- View all comments
- Approve pending comments
- Delete inappropriate comments
- See which post each comment belongs to

## Image Diversity Requirements

### Current Status
Currently, many blog posts use the same image (`kenyan-economy-coins.jpg`). This has been partially addressed:

### Updated Images
1. **Post 1** (Understanding PAYE): `kenyan-economy-coins.jpg` ✓
2. **Post 2** (Maximize Take-Home Pay): `by wirestock on Freepika.jpg` ✓
3. **Post 3** (2026 Tax Law Updates): `nairobi_wh10.jpg` ✓
4. **Post 4** (Salary Negotiation): `JT Banner Gemini_Generated_Image_.png` ✓
5. **Post 5** (Payslip Generator): `kenyan-economy-coins.jpg` (OK - business/finance)
6. **Post 6** (PAYE Exemption - CS Mbadi): `kenyan-economy-coins.jpg` ⚠️ **NEEDS UPDATING**

### Required Image: CS Mbadi Photo

**Post:** "Proposed PAYE Exemption for Earnings Below KSh 30,000"
**Current:** Generic coins image
**Required:** Photo of Treasury Cabinet Secretary John Mbadi speaking about tax policy

#### How to Add CS Mbadi Image

1. **Source the Image:**
   - Find an appropriate photo from government press releases
   - Use Creative Commons or properly licensed images
   - Recommended sources:
     - Kenya Government official website
     - Treasury website press photos
     - Licensed news agency photos
     - Creative Commons platforms (with proper attribution)

2. **Add to Repository:**
   ```bash
   # Upload image file to root directory
   # Example filename: cs-mbadi-treasury.jpg
   ```

3. **Update Database:**
   ```sql
   UPDATE blog_posts
   SET featured_image_url = 'cs-mbadi-treasury.jpg',
       updated_at = NOW()
   WHERE slug = 'paye-exemption-below-30000-proposal';
   ```

4. **Update Fallback in blog.js:**
   Edit `blog.js` around line 155 to change:
   ```javascript
   featured_image_url: 'cs-mbadi-treasury.jpg',
   ```

### Image Guidelines for Future Posts

When creating new blog posts, follow these guidelines:

1. **Relevance:** Choose images directly related to the post topic
2. **Diversity:** Use different images for each post
3. **Quality:** High-resolution images (1200x630px recommended)
4. **Licensing:** Use only properly licensed images
5. **Context:** Images should add context and visual interest

**Good Examples:**
- Tax policy post → Government official or Treasury building
- Salary negotiation → Business meeting or handshake
- Economic news → Kenyan currency, markets, or economic activity
- Technology tools → Screenshots or illustrations of the tools

**Avoid:**
- Using the same image for multiple posts
- Generic stock photos unrelated to content
- Low-quality or blurry images
- Copyrighted images without permission

## Social Sharing Features

The blog includes comprehensive social sharing:

### Available Platforms
- **Facebook:** Share with Open Graph meta tags
- **Twitter:** Tweet with article title and URL
- **LinkedIn:** Professional network sharing
- **WhatsApp:** Direct messaging with link
- **Copy Link:** One-click URL copy

### How It Works
- Share buttons appear on each blog post
- Uses native platform APIs for best experience
- Includes proper meta tags for rich previews
- Mobile-optimized for all platforms

## Real-Time View Tracking

### Implementation
The blog now includes real-time view count updates using Supabase Realtime:

1. **View Increment:** Every page visit increments the view count
2. **Real-Time Updates:** Other visitors see the updated count instantly
3. **Subscription:** Uses PostgreSQL change data capture (CDC)
4. **Performance:** Efficient with automatic cleanup on page unload

### How to Enable in Supabase

1. Go to Supabase Dashboard → Database → Replication
2. Enable replication for `blog_posts` table
3. Enable the `UPDATE` event for the table

### Testing Real-Time Views
1. Open a blog post in one browser window
2. Open the same post in another browser/incognito window
3. Refresh one window and see the view count update in the other

## AdSense Integration

The blog is already configured for Google AdSense:

### Ad Placements
- **Header Banner:** Top of blog pages
- **In-Content:** Between blog post listings
- **Mid-Article:** Within individual blog posts

### Account
- AdSense account: `ca-pub-6832553346534070`
- Already integrated in all blog pages
- Responsive ad units

## Maintenance Tasks

### Regular Admin Duties
1. **Content Management**
   - Create new posts regularly (at least weekly)
   - Update old posts with current information
   - Archive outdated content

2. **Comment Moderation**
   - Review new comments daily
   - Approve legitimate comments
   - Delete spam or inappropriate content

3. **Image Management**
   - Replace duplicate images with relevant ones
   - Add new images for new posts
   - Ensure all images are properly licensed

4. **Analytics Monitoring**
   - Check view counts weekly
   - Identify popular posts
   - Create more content on popular topics

5. **SEO Optimization**
   - Update meta descriptions
   - Improve internal linking
   - Optimize for target keywords

## Security Best Practices

### Admin Account Security
1. Use a strong, unique password
2. Enable 2FA if available in Supabase
3. Don't share admin credentials
4. Regularly review admin access logs

### Content Security
1. Sanitize HTML content before publishing
2. Review user-generated comments
3. Monitor for spam or malicious content
4. Keep Supabase RLS policies enabled

## Troubleshooting

### "Access Denied" on Admin Dashboard
- Verify user is signed in
- Check if admin access was granted via SQL
- Confirm `admin_users` table exists
- Check browser console for errors

### Images Not Showing
- Verify image file exists in root directory
- Check file name matches database entry
- Ensure proper file permissions
- Test with full URL path

### Real-Time Views Not Updating
- Enable replication in Supabase
- Check browser console for websocket errors
- Verify `blog_posts` table has replication enabled
- Test with different browsers

### Social Sharing Not Working
- Check if using HTTPS (required for some platforms)
- Verify meta tags are present in page source
- Test each platform individually
- Check browser console for JavaScript errors

## Next Steps

1. ✅ Create admin account (kesalarycalculator@gmail.com)
2. ✅ Run `admin-setup.sql` in Supabase
3. ✅ Grant admin access via SQL
4. ⚠️ Source and add CS Mbadi photo
5. ⚠️ Update Post 6 with CS Mbadi image
6. ✅ Test admin dashboard functionality
7. ✅ Test real-time view updates
8. ✅ Verify social sharing on all platforms
9. ✅ Start creating regular blog content

## Support

For technical issues or questions:
- Check Supabase logs for database errors
- Review browser console for JavaScript errors
- Verify all SQL scripts were executed successfully
- Ensure Supabase URL and keys are correct in `supabase-config.js`
