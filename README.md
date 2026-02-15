# KE Salary Calculator & Payslip Generator  

A web-based tool for calculating salaries and generating payslips for employees. This project helps HR departments and employees quickly compute net pay, deductions, and taxes while generating professional payslips.  

## Table of Contents  

- [Features](#features)  
- [Installation](#installation)  
- [Usage](#usage)  
- [Configuration](#configuration)  
- [Contributing](#contributing)  
- [License](#license)  

## Features  

- 🧮 **Salary Calculation**: Automatically computes gross pay, deductions (tax, NHIF, NSSF), and net salary.  
- 📄 **Payslip Generation**: Generates downloadable and printable payslips in PDF format.  
- 🔐 **User Authentication**: Secure sign up and login with Supabase authentication.
- 👤 **User Profiles**: Save calculations and access personalized features.
- 🔧 **Customizable Settings**: Adjust tax rates, allowances, and deductions as per company policies.  

## Installation  

### Prerequisites  
- A web browser (Chrome, Firefox, Safari, or Edge)
- A Supabase account (free tier available at [supabase.com](https://supabase.com))

### Setup  
1. Clone the repository:  
   ```bash  
   git clone https://github.com/MonarCat/Ke-Salary-Calculator.git  
   cd Ke-Salary-Calculator  
   ```  
2. Configure Supabase authentication:
   - Follow the detailed setup guide in [SUPABASE_SETUP.md](SUPABASE_SETUP.md)
   - Update `supabase-config.js` with your Supabase credentials

3. Deploy or run locally:
   - For local testing: Open `index.html` in your browser or use a local server
   - For production: Deploy to your hosting service (Netlify, Vercel, GitHub Pages, etc.)

   Using a local server (recommended):
   ```bash
   # Using Python 3
   python -m http.server 8000
   
   # Using Node.js http-server
   npx http-server -p 8000
   ```
   Then visit `http://localhost:8000` in your browser.  

## Usage  

1. **Sign Up / Sign In**:
   - Navigate to the authentication page via the "Sign In" link in the navigation
   - Create a new account or log in with existing credentials
   - Optional: Use Google OAuth for quick authentication

2. **Calculate Salary**:  
   - Enter the month and year, then click "Calculate Salary" to see the breakdown (PAYE, NHIF, NSSF, net pay).  

3. **Generate Payslip**:  
   - Click "Generate Payslip" to download a PDF payslip for the selected employee.  

## Configuration  

### Supabase Authentication Setup

See [SUPABASE_SETUP.md](SUPABASE_SETUP.md) for detailed instructions on setting up authentication.

Quick steps:
1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Get your Project URL and anon key from the API settings
3. Update `supabase-config.js` with your credentials

### Tax Rates and Deductions

Modify tax rates, NHIF, and NSSF deductions in `script.js`:  

```javascript  
module.exports = {  
  PAYE_RATES: [  
    { min: 0, max: 24000, rate: 0.1 },  
    { min: 24001, max: 32333, rate: 0.25 },  
    // ...  
  ],  
  NHIF_RATES: {  
    6000: 150,  
    8000: 300,  
    // ...  
  },  
  NSSF_RATE: 0.06  
};  
```  

## Contributing  

We welcome contributions! Follow these steps:  

1. Fork the repository.  
2. Create a new branch (`git checkout -b feature/new-feature`).  
3. Commit your changes (`git commit -m "Add new feature"`).  
4. Push to the branch (`git push origin feature/new-feature`).  
5. Open a Pull Request.  

### Guidelines:  
- Follow consistent code style (ESLint enforced).  
- Write tests for new features.  
- Update documentation if needed.  

## License  

This project is licensed under the **MIT License** – see [LICENSE](LICENSE) for details.  

---  

💡 **Need Help?** Open an issue or contact us at `support@kesalarycalculator.com`.  

🚀 **Live Demo**: [https://kesalarycalculator.demo](https://kesalarycalculator.demo) *(if applicable)*  

---  

Feel free to customize further based on your tech stack (e.g., React, Django) or additional features like email notifications!