# KE Salary Calculator & Payslip Generator  

A comprehensive web-based tool for calculating salaries and generating payslips for Kenyan employees. This project helps HR departments, employers, and employees quickly compute net pay, statutory deductions, and generate professional payslips with customizable branding.

## Table of Contents  

- [Features](#features)  
- [Installation](#installation)  
- [Usage](#usage)  
- [Configuration](#configuration)  
- [Database Setup](#database-setup)
- [Contributing](#contributing)  
- [License](#license)  

## Features  

### Core Features
- 🧮 **Salary Calculator**: Accurately computes gross pay, PAYE, NSSF, SHIF, Housing Levy, and net salary
- 📄 **Payslip Generator**: Creates professional, customizable payslips with company branding
- 🔐 **User Authentication**: Secure sign-up and login with Supabase (email/password and Google OAuth)
- 👤 **User Profiles**: Save calculations and track usage
- 🏢 **Account Types**: 
  - Individual accounts for personal salary calculations
  - Employer/Organization accounts for employee management
- 👥 **Employee Management**: Add unlimited employees with full CRUD operations
- 📧 **Email Distribution**: Send payslips directly to employee emails
- 📊 **Bulk Generation**: Generate multiple payslips at once
- 🎨 **Custom Branding**: Add company logo and details to payslips
- ♾️ **Unlimited Downloads**: No download limits

### Blog Features
- 📰 **Financial News Blog**: Keep up with Kenya's latest tax and salary news
- ✍️ **Admin Dashboard**: Full-featured content management for kesalarycalculator@gmail.com
- 💬 **User Comments**: Authenticated users can comment on blog posts
- ❤️ **Reactions**: Five reaction types (Like, Love, Insightful, Celebrate, Support)
- 👁️ **Real-Time View Tracking**: Live view count updates using Supabase Realtime
- 🔗 **Social Sharing**: Share articles on Facebook, Twitter, LinkedIn, WhatsApp
- 🎯 **Google AdSense**: Monetize blog content with strategically placed ads
- 📱 **Responsive Design**: Optimized for all devices

## Installation  

### Prerequisites  
- A web browser (Chrome, Firefox, Safari, or Edge)
- A Supabase account (free tier available at [supabase.com](https://supabase.com))

### Setup  

1. **Clone the repository:**  
   ```bash  
   git clone https://github.com/MonarCat/Ke-Salary-Calculator.git  
   cd Ke-Salary-Calculator  
   ```  

2. **Configure Supabase authentication:**
   - Follow the detailed setup guide in [SUPABASE_SETUP.md](SUPABASE_SETUP.md)
   - Update `supabase-config.js` with your Supabase credentials
   - Set up the database schema using [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)

3. **Deploy or run locally:**
   
   For local testing, use a local server:
   ```bash
   # Using Python 3
   python -m http.server 8000
   
   # Using Node.js http-server
   npx http-server -p 8000
   ```
   Then visit `http://localhost:8000/` in your browser to see the landing page.
   The calculator is available at `http://localhost:8000/calculator.html`.  

   For production deployment:
   - **Netlify**: Connect your GitHub repo and deploy
   - **Vercel**: Import your GitHub project
   - **GitHub Pages**: Enable in repository settings

## Usage  

### Getting Started

1. **Visit the Landing Page:**
   - Navigate to the home page `/` (index.html) to see the feature overview
   - Click "Try Free Calculator" or "Sign Up Free"

2. **Create an Account:**
   - Choose account type (Individual or Employer/Organization)
   - Sign up with email/password or Google OAuth
   - Verify your email address

3. **Calculate Salary:**  
   - Enter gross salary, allowances, and benefits
   - Click "Calculate Net Pay" to see detailed breakdown
   - View PAYE, NSSF, SHIF, Housing Levy, and net salary

4. **Generate Payslips:**  
   - Switch to "Payslip Generator" tab
   - Enter employee details and salary information
   - Customize with company branding
   - Print or download payslips

### For Employers

1. **Manage Employees:**
   - Navigate to the Employees page
   - Add employee details (name, ID, KRA PIN, salary, etc.)
   - Edit or delete employee records as needed

2. **Bulk Payslip Generation:**
   - Select multiple employees
   - Generate payslips for all at once
   - Email directly to employees

## Configuration  

### Supabase Authentication Setup

See [SUPABASE_SETUP.md](SUPABASE_SETUP.md) for detailed instructions.

Quick steps:
1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Get your Project URL and anon key from the API settings
3. Update `supabase-config.js` with your credentials

### Database Setup

The application requires the following database tables:
- `user_profiles` - User account information
- `employees` - Employee records for employer accounts
- `payslip_history` - Track generated payslips and downloads
- `saved_calculations` - User's saved salary calculations
- `blog_posts` - Blog articles with images and metadata
- `post_comments` - User comments on blog posts
- `post_reactions` - User reactions to blog posts
- `comment_reactions` - User reactions to individual comments
- `admin_users` - Admin access control for blog management

Follow the complete schema and setup instructions:
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - Core application database
- [BLOG_SCHEMA.md](BLOG_SCHEMA.md) - Blog feature database
- [ADMIN_SETUP_GUIDE.md](ADMIN_SETUP_GUIDE.md) - Admin dashboard setup

### Blog Admin Dashboard

Admin user (kesalarycalculator@gmail.com) has access to:
1. **Post Management**: Create, edit, delete blog posts
2. **Analytics Dashboard**: View statistics (posts, views, comments, reactions)
3. **Comment Moderation**: Approve or delete user comments
4. **Real-Time Monitoring**: See live view counts and engagement

To set up admin access:
```bash
# 1. Sign up at /auth.html with kesalarycalculator@gmail.com
# 2. Run admin-setup.sql in Supabase SQL Editor
# 3. Grant admin privileges via SQL (see ADMIN_SETUP_GUIDE.md)
# 4. Access dashboard at /admin.html
```

See [ADMIN_SETUP_GUIDE.md](ADMIN_SETUP_GUIDE.md) for complete instructions.

### Tax Rates and Deductions

Current tax rates are configured in `script.js` based on Kenyan law:

- **PAYE**: Progressive tax from 10% to 35%
- **NSSF**: 6% (Tier I & II combined, capped)
- **SHIF**: 2.75% of gross salary
- **Housing Levy**: 1.5% of gross salary
- **Personal Relief**: KES 2,400

## Monetization with Google AdSense

The site is integrated with Google AdSense for monetization. Ads are strategically placed to generate revenue while maintaining excellent user experience.

### Documentation:
- [ADSENSE_VERIFICATION.md](ADSENSE_VERIFICATION.md) - **START HERE**: Site verification setup guide
- [ADSENSE_VERIFICATION_QUICKSTART.md](ADSENSE_VERIFICATION_QUICKSTART.md) - Quick reference for verification
- [ADSENSE_SETUP.md](ADSENSE_SETUP.md) - Complete ad implementation guide
- [ADSENSE_QUICKSTART.md](ADSENSE_QUICKSTART.md) - Quick setup for ads

### Key Files:
- `ads.txt` - Declares authorized digital sellers (required by Google)
- `robots.txt` - Allows AdSense crawlers to access the site
- All HTML files include AdSense verification meta tag

## Legal Pages

The application includes comprehensive legal documentation:
- `/privacy-policy.html` - Data protection and privacy practices
- `/terms-of-service.html` - Terms and conditions
- `/cookie-policy.html` - Cookie usage and tracking

## Contributing  

We welcome contributions! Follow these steps:  

1. Fork the repository
2. Create a new branch (`git checkout -b feature/new-feature`)
3. Commit your changes (`git commit -m "Add new feature"`)
4. Push to the branch (`git push origin feature/new-feature`)
5. Open a Pull Request

### Guidelines:  
- Follow consistent code style
- Test your changes thoroughly
- Update documentation as needed
- Ensure mobile responsiveness
- Follow accessibility best practices

## Security

- All user data is encrypted in transit and at rest
- Passwords are hashed using Supabase Auth
- Row Level Security (RLS) enabled on all database tables
- Regular security audits and updates

## Support

- 📧 **Email**: kesalarycalculator@gmail.com
- 🐛 **Bug Reports**: [Open an issue](https://github.com/MonarCat/Ke-Salary-Calculator/issues)
- 💬 **Feature Requests**: [Submit a request](https://github.com/MonarCat/Ke-Salary-Calculator/issues)

## License  

This project is licensed under the **MIT License** – see [LICENSE](LICENSE) for details.  

---  

## Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Authentication**: Supabase Auth
- **Database**: Supabase (PostgreSQL)
- **Hosting**: Netlify / Vercel / GitHub Pages

## Roadmap

- [ ] Mobile app (iOS & Android)
- [ ] Excel export for bulk data
- [ ] Advanced reporting and analytics
- [ ] Integration with accounting software
- [ ] API for third-party integrations
- [ ] Multi-language support

---

Built with ❤️ in Kenya 🇰🇪 for Kenyan businesses and employees.
