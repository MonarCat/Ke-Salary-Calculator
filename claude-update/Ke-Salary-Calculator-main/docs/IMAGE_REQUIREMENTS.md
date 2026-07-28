# Blog Post Images - Action Required

## Critical: CS Mbadi Image Needed

### Post Requiring Update
**Title:** "Proposed PAYE Exemption for Earnings Below KSh 30,000: A Game-Changer for Low-Income Kenyans?"
**Slug:** `paye-exemption-below-30000-proposal`
**Current Image:** `kenyan-economy-coins.jpg` (generic)
**Required:** Photo of Treasury Cabinet Secretary John Mbadi

### Why This Matters
The problem statement specifically mentions:
> "The post about Proposal to remove PAYE for persons earning less than KES 30,000, should have a picture of the CS national Treasury, Mr Mbadi talking about it."

### Action Items

#### 1. Source the Image
Find an appropriate photo from:
- **Government Sources:**
  - Kenya National Treasury official website
  - Government press releases
  - Official government social media accounts
  
- **News Sources (with proper licensing):**
  - Nation Media Group
  - Standard Media Group
  - Kenya News Agency (KNA)
  
- **Alternative Sources:**
  - Wikimedia Commons (if available)
  - Creative Commons licensed images
  - Contact Treasury press office for official photos

#### 2. Image Requirements
- **Subject:** CS John Mbadi speaking at a podium/press conference about tax policy
- **Quality:** High resolution (minimum 1200x630px)
- **Format:** JPG or PNG
- **Context:** Should show him in official capacity (at Treasury, press conference, etc.)
- **License:** Must have proper rights to use the image

#### 3. Add to Repository
```bash
# Save image file to repository root
# Recommended filename: cs-mbadi-treasury.jpg or cs-john-mbadi.jpg
```

#### 4. Update Database
Once image is added, update the database:

```sql
-- Update the blog post with new image
UPDATE blog_posts
SET featured_image_url = 'cs-mbadi-treasury.jpg',
    updated_at = NOW()
WHERE slug = 'paye-exemption-below-30000-proposal';
```

#### 5. Update Fallback Data
Edit `blog.js` around line 155:

```javascript
{
    id: 'post-6',
    title: 'Proposed PAYE Exemption for Earnings Below KSh 30,000...',
    slug: 'paye-exemption-below-30000-proposal',
    // ... other fields ...
    featured_image_url: 'cs-mbadi-treasury.jpg', // ← Update this line
    // ... rest of post ...
}
```

### Current Blog Post Image Status

| Post | Title | Current Image | Status |
|------|-------|---------------|--------|
| 1 | Understanding PAYE in Kenya | kenyan-economy-coins.jpg | ✅ Appropriate |
| 2 | Maximize Your Take-Home Pay | by wirestock on Freepik.jpg | ✅ Updated |
| 3 | 2026 Tax Law Updates | nairobi_wh10.jpg | ✅ Updated |
| 4 | Salary Negotiation Tips | JT Banner Gemini_Generated_Image_.png | ✅ Updated |
| 5 | Why Businesses Need Payslip Generator | kenyan-economy-coins.jpg | ✅ Appropriate |
| 6 | PAYE Exemption Below KSh 30,000 | National Treasury CS John Mbadi.jpeg | ✅ Updated |

### Alternative If Image Cannot Be Sourced

If an official CS Mbadi photo cannot be obtained with proper licensing:

**Option 1: Treasury Building**
- Use a photo of the National Treasury building
- Update to show the institution rather than individual

**Option 2: Generic Government/Parliament Image**
- Use an image of Parliament buildings or government in session
- Less ideal but better than coins image

**Option 3: Kenyan Economic Activity**
- Use an image showing Kenyan workers/marketplace
- Focuses on the people who benefit from the policy

### Testing After Update

After adding the image:
1. View the blog post at `/blog-post.html?slug=paye-exemption-below-30000-proposal`
2. Verify image loads correctly
3. Check image appears on blog listing at `/blog.html`
4. Test responsive display on mobile devices
5. Verify image has proper alt text for accessibility

### Licensing Best Practices

When sourcing images:
- ✅ Get written permission if using from news outlets
- ✅ Check Creative Commons licenses (prefer CC0, CC BY)
- ✅ Attribute photographers when required
- ✅ Keep records of image sources and licenses
- ❌ Don't use copyrighted images without permission
- ❌ Don't scrape images from social media without rights
- ❌ Don't use watermarked images

### Contact Information

For official government photos:
- **National Treasury Communications**
  - Phone: +254 20 2252299
  - Email: info@treasury.go.ke
  - Location: Treasury Building, Harambee Avenue, Nairobi

- **Government Spokesperson Office**
  - Can provide official photos from government events
  - Often have press kits with approved images

### Timeline

**Priority:** High
**Deadline:** Before production deployment
**Estimated Time:** 1-2 hours to source and implement

### Notes

- The blog system is fully functional without this image
- However, it addresses a specific requirement in the problem statement
- Using generic images for all posts is explicitly discouraged
- A relevant, diverse image improves user engagement and SEO
