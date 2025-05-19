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
- 🔧 **Customizable Settings**: Adjust tax rates, allowances, and deductions as per company policies.  
- 📊 **Employee Management**: Store and manage employee details for quick access.  

## Installation  

### Prerequisites  
- Node.js (v14 or later)  
- npm or yarn  
- MongoDB (for storing employee data)  

### Setup  
1. Clone the repository:  
   ```bash  
   git clone https://github.com/yourusername/ke-salary-calculator.git  
   cd ke-salary-calculator  
   ```  
2. Install dependencies:  
   ```bash  
   npm install  
   ```  
3. Set up environment variables (create a `.env` file):  
   ```env  
   MONGODB_URI=your_mongodb_connection_string  
   PORT=3000  
   ```  
4. Run the application:  
   ```bash  
   npm start  
   ```  
   The app will be available at `http://localhost:3000`.  

## Usage  

1. **Add an Employee**:  
   - Navigate to the "Employees" section and fill in the employee details (name, ID, basic salary, allowances).  

2. **Calculate Salary**:  
   - Enter the month and year, then click "Calculate Salary" to see the breakdown (PAYE, NHIF, NSSF, net pay).  

3. **Generate Payslip**:  
   - Click "Generate Payslip" to download a PDF payslip for the selected employee.  

## Configuration  

Modify tax rates, NHIF, and NSSF deductions in `config/deductions.js`:  

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