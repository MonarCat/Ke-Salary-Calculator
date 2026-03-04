# Logo Upload Instructions

## Overview
A logo container has been added to all pages of the Kenya Salary Calculator website. Currently, it displays a placeholder with the site name and calculator icon.

## Current Status
The logo container is implemented with:
- Professional styling matching the site's green color scheme
- Responsive design for mobile and desktop
- Hover effects for better user experience
- Placeholder text: "🧮 Kenya Salary Calculator"

## How to Add Your Logo

### Step 1: Prepare Your Logo Image
1. **Format**: PNG or SVG recommended (JPG acceptable)
2. **Dimensions**: 
   - Recommended: 300px height, width proportional
   - Maximum height displayed: 60px (auto-scaled)
3. **Background**: Transparent background recommended
4. **File size**: Keep under 100KB for fast loading

### Step 2: Upload Logo to Repository
1. Add your logo file to the root directory of the repository
2. Recommended filename: `logo.png` or `logo.svg`

### Step 3: Update HTML Files
Replace the logo placeholder in these files:

**Files to update:**
- `index.html`
- `blog.html`
- `blog-post.html`
- `admin.html`
- `calculator.html` (if it exists)
- `auth.html` (if it exists)
- Any other HTML pages

**Find this code:**
```html
<!-- Logo Container -->
<div class="logo-container">
    <!-- TODO: Replace with actual logo image when ready -->
    <!-- Example: <a href="/"><img src="logo.png" alt="Kenya Salary Calculator Logo"></a> -->
    <a href="/" class="logo-placeholder">
        <i class="fas fa-calculator"></i>
        Kenya Salary Calculator
    </a>
</div>
```

**Replace with:**
```html
<!-- Logo Container -->
<div class="logo-container">
    <a href="/">
        <img src="logo.png" alt="Kenya Salary Calculator Logo">
    </a>
</div>
```

### Step 4: Verify the Changes
1. Test on desktop browsers (Chrome, Firefox, Safari)
2. Test on mobile devices
3. Check that the logo appears on all pages
4. Verify the logo is clickable and links to homepage
5. Ensure the logo loads quickly

## CSS Styling
The logo container is already styled in `styles.css`:

```css
.logo-container {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 10px 0;
    margin-bottom: 10px;
}

.logo-container img {
    max-height: 60px;
    width: auto;
    object-fit: contain;
}
```

## Customization Options

### Adjust Logo Size
To change the logo size, modify the `max-height` in `styles.css`:

```css
.logo-container img {
    max-height: 80px;  /* Change from 60px to desired height */
    width: auto;
    object-fit: contain;
}
```

### Add Shadow or Border
Add visual effects to your logo:

```css
.logo-container img {
    max-height: 60px;
    width: auto;
    object-fit: contain;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    border-radius: 8px;
    padding: 10px;
    background: white;
}
```

### Center or Align Differently
Modify the container alignment:

```css
.logo-container {
    justify-content: flex-start;  /* Left align */
    /* OR */
    justify-content: flex-end;    /* Right align */
    /* OR */
    justify-content: center;      /* Center (current) */
}
```

## Responsive Design
The logo is already responsive. On mobile devices (below 768px), the logo will:
- Remain centered
- Maintain aspect ratio
- Scale down if needed

## SEO Considerations
When adding your logo:
1. Use descriptive alt text: `alt="Kenya Salary Calculator Logo"`
2. Ensure fast loading (compress image if needed)
3. Use modern image formats (WebP with PNG fallback)

## Troubleshooting

### Logo Not Showing
1. Check file path is correct
2. Verify file is uploaded to correct directory
3. Clear browser cache
4. Check browser console for errors

### Logo Too Large/Small
Adjust the `max-height` value in CSS

### Logo Looks Blurry
1. Use higher resolution image
2. Try SVG format instead of PNG
3. Ensure image dimensions are sufficient

### Logo Not Clickable
Verify the `<a>` tag is wrapping the `<img>` tag:
```html
<a href="/">
    <img src="logo.png" alt="Kenya Salary Calculator Logo">
</a>
```

## Future Enhancements
Consider these optional improvements:
- Add animated logo on hover
- Implement dark/light mode logo variants
- Add loading placeholder while logo loads
- Create favicon from logo
- Add logo to Open Graph meta tags for social sharing

## Support
If you need help with logo implementation, check:
1. Browser developer console for errors
2. File paths and names are correct
3. CSS is loading properly
4. Image file is not corrupted
