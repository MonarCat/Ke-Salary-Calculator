# Database Schema for User Profiles and Subscriptions

This document outlines the database schema needed for user profiles, subscription management, and employee data.

## Tables

### 1. user_profiles

Extends Supabase auth.users with additional profile information.

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  account_type TEXT CHECK (account_type IN ('individual', 'employer')),
  organization_name TEXT,
  organization_kra TEXT,
  phone_number TEXT,
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'premium', 'enterprise')),
  subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'cancelled', 'expired')),
  subscription_start_date TIMESTAMPTZ,
  subscription_end_date TIMESTAMPTZ,
  payslip_downloads_count INTEGER DEFAULT 0,
  downloads_reset_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Policy: Users can insert their own profile
CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
```

### 2. employees

Stores employee data for employer accounts (Premium feature).

```sql
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  kra_pin TEXT,
  email TEXT,
  phone_number TEXT,
  department TEXT,
  position TEXT,
  gross_salary NUMERIC(10, 2),
  allowances NUMERIC(10, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employer_id, employee_id)
);

-- Enable Row Level Security
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Policy: Employers can view their own employees
CREATE POLICY "Employers can view own employees" ON employees
  FOR SELECT USING (auth.uid() = employer_id);

-- Policy: Employers can insert their own employees
CREATE POLICY "Employers can insert own employees" ON employees
  FOR INSERT WITH CHECK (auth.uid() = employer_id);

-- Policy: Employers can update their own employees
CREATE POLICY "Employers can update own employees" ON employees
  FOR UPDATE USING (auth.uid() = employer_id);

-- Policy: Employers can delete their own employees
CREATE POLICY "Employers can delete own employees" ON employees
  FOR DELETE USING (auth.uid() = employer_id);
```

### 3. payslip_history

Stores generated payslips for tracking and download limits.

```sql
CREATE TABLE payslip_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  employee_name TEXT NOT NULL,
  pay_period TEXT NOT NULL,
  gross_salary NUMERIC(10, 2),
  net_salary NUMERIC(10, 2),
  paye NUMERIC(10, 2),
  nssf NUMERIC(10, 2),
  shif NUMERIC(10, 2),
  housing_levy NUMERIC(10, 2),
  downloaded BOOLEAN DEFAULT FALSE,
  download_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE payslip_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own payslip history
CREATE POLICY "Users can view own payslip history" ON payslip_history
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own payslip history
CREATE POLICY "Users can insert own payslip history" ON payslip_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own payslip history
CREATE POLICY "Users can update own payslip history" ON payslip_history
  FOR UPDATE USING (auth.uid() = user_id);
```

### 4. subscription_transactions

Stores payment transaction history.

```sql
CREATE TABLE subscription_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_reference TEXT UNIQUE NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'KES',
  payment_method TEXT,
  payment_status TEXT CHECK (payment_status IN ('pending', 'success', 'failed', 'refunded')),
  subscription_tier TEXT CHECK (subscription_tier IN ('premium', 'enterprise')),
  subscription_period INTEGER DEFAULT 1, -- in months
  paystack_reference TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE subscription_transactions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own transactions
CREATE POLICY "Users can view own transactions" ON subscription_transactions
  FOR SELECT USING (auth.uid() = user_id);
```

### 5. saved_calculations

Stores saved salary calculations for users.

```sql
CREATE TABLE saved_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  calculation_name TEXT,
  gross_salary NUMERIC(10, 2),
  allowances NUMERIC(10, 2),
  benefits NUMERIC(10, 2),
  net_salary NUMERIC(10, 2),
  paye NUMERIC(10, 2),
  nssf NUMERIC(10, 2),
  shif NUMERIC(10, 2),
  housing_levy NUMERIC(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE saved_calculations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own saved calculations
CREATE POLICY "Users can view own calculations" ON saved_calculations
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own calculations
CREATE POLICY "Users can insert own calculations" ON saved_calculations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own calculations
CREATE POLICY "Users can update own calculations" ON saved_calculations
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete their own calculations
CREATE POLICY "Users can delete own calculations" ON saved_calculations
  FOR DELETE USING (auth.uid() = user_id);
```

## Functions

### Function: Reset monthly download count

```sql
CREATE OR REPLACE FUNCTION reset_monthly_downloads()
RETURNS void AS $$
BEGIN
  UPDATE user_profiles
  SET payslip_downloads_count = 0,
      downloads_reset_date = NOW()
  WHERE downloads_reset_date < NOW() - INTERVAL '1 month'
    AND subscription_tier = 'free';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Function: Check download limit

```sql
CREATE OR REPLACE FUNCTION check_download_limit(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_subscription_tier TEXT;
  v_downloads_count INTEGER;
  v_reset_date TIMESTAMPTZ;
BEGIN
  SELECT subscription_tier, payslip_downloads_count, downloads_reset_date
  INTO v_subscription_tier, v_downloads_count, v_reset_date
  FROM user_profiles
  WHERE id = p_user_id;

  -- Premium and enterprise users have unlimited downloads
  IF v_subscription_tier IN ('premium', 'enterprise') THEN
    RETURN TRUE;
  END IF;

  -- Reset count if a month has passed
  IF v_reset_date < NOW() - INTERVAL '1 month' THEN
    UPDATE user_profiles
    SET payslip_downloads_count = 0,
        downloads_reset_date = NOW()
    WHERE id = p_user_id;
    
    RETURN TRUE;
  END IF;

  -- Check if free user has reached limit (2 downloads per month)
  RETURN v_downloads_count < 2;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Function: Increment download count

```sql
CREATE OR REPLACE FUNCTION increment_download_count(p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE user_profiles
  SET payslip_downloads_count = payslip_downloads_count + 1
  WHERE id = p_user_id
    AND subscription_tier = 'free';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Indexes

```sql
-- Optimize queries by user_id
CREATE INDEX idx_employees_employer_id ON employees(employer_id);
CREATE INDEX idx_payslip_history_user_id ON payslip_history(user_id);
CREATE INDEX idx_saved_calculations_user_id ON saved_calculations(user_id);
CREATE INDEX idx_subscription_transactions_user_id ON subscription_transactions(user_id);

-- Optimize subscription queries
CREATE INDEX idx_user_profiles_subscription ON user_profiles(subscription_tier, subscription_status);
```

## Triggers

### Auto-update timestamp

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_saved_calculations_updated_at
  BEFORE UPDATE ON saved_calculations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

## Initial Setup

To set up the database, run these SQL commands in order in your Supabase SQL editor:

1. Create all tables
2. Enable RLS policies
3. Create functions
4. Create indexes
5. Create triggers

## Notes

- All monetary values use NUMERIC(10, 2) for precision
- Row Level Security (RLS) is enabled on all tables to ensure users can only access their own data
- The `check_download_limit` function should be called before allowing payslip downloads
- The `increment_download_count` function should be called after a successful download
- Premium and enterprise users bypass download limits
