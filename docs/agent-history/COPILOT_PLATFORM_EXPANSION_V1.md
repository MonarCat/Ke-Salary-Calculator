# COPILOT_PLATFORM_EXPANSION_V1.md
# SalaryCalculator.co.ke — Autonomous Platform Expansion
# Role: GitHub Copilot Implementation Agent

---

## CRITICAL RULES — READ BEFORE ANY ACTION

```
YOU ARE ENHANCING A LIVE PRODUCTION PLATFORM.
NEVER break, remove, rename, or rewrite any existing system.
NEVER touch existing: auth flows, Paystack integration, PAYE calculator logic,
  employee management, payslip generation, salary comparison pages, blog/news pages.
ALL new features are ADDITIVE and MODULAR.
ALL new pages/routes must have meta tags, Open Graph, and FAQ schema.
ALL components must be mobile-first and match the existing green (#1a6b3c / #e8830a) brand.
DO NOT implement WhatsApp bots, live chat, or human-support workflows.
```

---

## PROJECT CONTEXT

- **Live URL:** https://salarycalculator.co.ke/
- **Stack:** Static HTML/CSS/JS on Vercel · Supabase backend (project: `wznopthjoaqusalqoyru`) · Paystack payments · Node.js 24.x
- **GitHub:** MonarCat/Ke-Salary-Calculator
- **Brand colors:** Green `#1a6b3c`, Orange `#e8830a`
- **Premium:** KES 499/month · KES 4,999/year (Paystack)
- **Existing key tables:** `user_profiles`, `employees`, `payslips`
- **Auth:** Supabase Auth (JWT, `verify_jwt: false` on browser-called Edge Functions)

---

## WHAT IS ALREADY DONE (DATABASE)

The database migrations in **SECTION A** below have already been executed in Supabase.
You do NOT need to run any SQL. All tables, enums, indexes, RLS policies,
triggers, functions, and seed data are live and ready to use.

Your job (SECTION B) is FRONTEND ONLY — HTML pages, CSS, and JavaScript.

---

# ═══════════════════════════════════════════════════════════
# SECTION A — COMPLETED DATABASE MIGRATIONS (REFERENCE ONLY)
# ═══════════════════════════════════════════════════════════

> These SQL blocks are provided for your reference so you know
> exact column names, types, and constraints to use in your JS.
> DO NOT re-execute them.

---

## A1 — ENUMS

```sql
-- Account type distinction
DO $$ BEGIN
  CREATE TYPE account_type_enum AS ENUM ('personal', 'organization');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Import batch lifecycle
DO $$ BEGIN
  CREATE TYPE import_status_enum AS ENUM (
    'pending', 'processing', 'previewing', 'completed', 'failed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Import template types
DO $$ BEGIN
  CREATE TYPE import_template_enum AS ENUM (
    'employee_import', 'monthly_payroll', 'p9a_annual'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Row-level import status
DO $$ BEGIN
  CREATE TYPE import_row_status_enum AS ENUM (
    'pending', 'valid', 'invalid', 'imported', 'skipped'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Budget category groups
DO $$ BEGIN
  CREATE TYPE budget_group_enum AS ENUM (
    'essentials', 'family_social', 'vehicle_mobility',
    'savings_security', 'lifestyle', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Insight severity
DO $$ BEGIN
  CREATE TYPE insight_type_enum AS ENUM ('warning', 'tip', 'achievement', 'alert');
  CREATE TYPE severity_enum AS ENUM ('low', 'medium', 'high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Financial health grade
DO $$ BEGIN
  CREATE TYPE health_grade_enum AS ENUM ('A', 'B', 'C', 'D', 'F');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
```

---

## A2 — USER_PROFILES EXTENSION

```sql
-- Add account_type to existing user_profiles (safe, defaults to 'personal')
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS account_type account_type_enum NOT NULL DEFAULT 'personal',
  ADD COLUMN IF NOT EXISTS organization_name text,
  ADD COLUMN IF NOT EXISTS kra_pin text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Index for fast account type lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_account_type
  ON user_profiles(account_type);
```

---

## A3 — PAYROLL IMPORT SYSTEM

```sql
-- ── IMPORT BATCHES ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_import_batches (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  batch_name          text        NOT NULL,
  template_type       import_template_enum NOT NULL,
  status              import_status_enum NOT NULL DEFAULT 'pending',
  total_rows          int         NOT NULL DEFAULT 0,
  successful_rows     int         NOT NULL DEFAULT 0,
  failed_rows         int         NOT NULL DEFAULT 0,
  file_name           text,
  file_size_bytes     bigint,
  column_mapping      jsonb       NOT NULL DEFAULT '{}',
  preview_data        jsonb,          -- first 5 rows for preview screen
  error_summary       text,
  processed_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ── IMPORT ROWS (individual parsed rows) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_import_rows (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id    uuid        NOT NULL REFERENCES payroll_import_batches(id) ON DELETE CASCADE,
  row_number  int         NOT NULL,
  raw_data    jsonb       NOT NULL,
  mapped_data jsonb,
  status      import_row_status_enum NOT NULL DEFAULT 'pending',
  errors      jsonb       NOT NULL DEFAULT '[]',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(batch_id, row_number)
);

-- ── IMPORT ERRORS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_import_errors (
  id            uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id      uuid  NOT NULL REFERENCES payroll_import_batches(id) ON DELETE CASCADE,
  row_number    int,
  field_name    text,
  error_type    text  NOT NULL,   -- 'missing_required', 'invalid_format', 'duplicate', 'out_of_range'
  error_message text  NOT NULL,
  raw_value     text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── PAYROLL SNAPSHOTS (post-import payroll records) ───────────────────────────
CREATE TABLE IF NOT EXISTS payroll_snapshots (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  batch_id            uuid        REFERENCES payroll_import_batches(id) ON DELETE SET NULL,
  employee_id         uuid        REFERENCES employees(id) ON DELETE SET NULL,
  payroll_month       date        NOT NULL,   -- first of month e.g. 2026-05-01
  employee_name       text        NOT NULL,
  employee_kra_pin    text,
  employee_nssf_no    text,
  employee_shif_no    text,
  gross_salary        numeric(15,2) NOT NULL,
  basic_salary        numeric(15,2),
  house_allowance     numeric(15,2) DEFAULT 0,
  transport_allowance numeric(15,2) DEFAULT 0,
  other_allowances    numeric(15,2) DEFAULT 0,
  taxable_allowances  numeric(15,2) DEFAULT 0,
  non_taxable_allowances numeric(15,2) DEFAULT 0,
  -- Deductions
  nssf_tier1          numeric(15,2) DEFAULT 0,
  nssf_tier2          numeric(15,2) DEFAULT 0,
  nssf_total          numeric(15,2) DEFAULT 0,
  shif                numeric(15,2) DEFAULT 0,
  housing_levy        numeric(15,2) DEFAULT 0,
  paye                numeric(15,2) DEFAULT 0,
  personal_relief     numeric(15,2) DEFAULT 2400,
  insurance_relief    numeric(15,2) DEFAULT 0,
  pension_contribution numeric(15,2) DEFAULT 0,
  helb_deduction      numeric(15,2) DEFAULT 0,
  sacco_deduction     numeric(15,2) DEFAULT 0,
  mortgage_interest   numeric(15,2) DEFAULT 0,
  other_deductions    numeric(15,2) DEFAULT 0,
  total_deductions    numeric(15,2) NOT NULL DEFAULT 0,
  net_pay             numeric(15,2) NOT NULL,
  -- Meta
  employer_name       text,
  employer_kra_pin    text,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, employee_id, payroll_month)
);

-- ── INDEXES ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_import_batches_user_id
  ON payroll_import_batches(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_rows_batch_id
  ON payroll_import_rows(batch_id, row_number);
CREATE INDEX IF NOT EXISTS idx_import_errors_batch_id
  ON payroll_import_errors(batch_id);
CREATE INDEX IF NOT EXISTS idx_payroll_snapshots_user_month
  ON payroll_snapshots(user_id, payroll_month DESC);
CREATE INDEX IF NOT EXISTS idx_payroll_snapshots_employee
  ON payroll_snapshots(employee_id, payroll_month DESC);
```

---

## A4 — ANNUAL TAX RECORDS (P9A)

```sql
CREATE TABLE IF NOT EXISTS annual_tax_records (
  id                    uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id           uuid    REFERENCES employees(id) ON DELETE SET NULL,
  tax_year              smallint NOT NULL CHECK (tax_year BETWEEN 2020 AND 2035),
  -- Employee details (denormalized for permanence)
  employee_name         text    NOT NULL,
  employee_kra_pin      text,
  employee_nssf_no      text,
  employee_id_number    text,
  employer_name         text,
  employer_kra_pin      text,
  employer_nssf_no      text,
  -- Monthly breakdown: array of 12 objects
  -- Each: { month, gross, taxable_pay, paye_before_relief, personal_relief,
  --         insurance_relief, net_paye, nssf, shif, housing_levy, pension,
  --         net_pay, notes }
  monthly_records       jsonb   NOT NULL DEFAULT '[]',
  -- Annual totals (auto-computed by trigger)
  total_gross_pay       numeric(15,2) NOT NULL DEFAULT 0,
  total_taxable_pay     numeric(15,2) NOT NULL DEFAULT 0,
  total_paye_before_relief numeric(15,2) NOT NULL DEFAULT 0,
  total_personal_relief  numeric(15,2) NOT NULL DEFAULT 0,
  total_insurance_relief numeric(15,2) NOT NULL DEFAULT 0,
  total_net_paye         numeric(15,2) NOT NULL DEFAULT 0,
  total_nssf             numeric(15,2) NOT NULL DEFAULT 0,
  total_shif             numeric(15,2) NOT NULL DEFAULT 0,
  total_housing_levy     numeric(15,2) NOT NULL DEFAULT 0,
  total_pension          numeric(15,2) NOT NULL DEFAULT 0,
  total_net_pay          numeric(15,2) NOT NULL DEFAULT 0,
  -- Status
  is_finalized          boolean NOT NULL DEFAULT false,
  generated_at          timestamptz,
  pdf_url               text,   -- optional: stored PDF reference
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, employee_id, tax_year)
);

CREATE INDEX IF NOT EXISTS idx_annual_tax_user_year
  ON annual_tax_records(user_id, tax_year DESC);
CREATE INDEX IF NOT EXISTS idx_annual_tax_employee
  ON annual_tax_records(employee_id, tax_year DESC);
```

---

## A5 — PERSONAL BUDGET SYSTEM

```sql
-- ── BUDGET CATEGORIES (system defaults + user custom) ─────────────────────────
CREATE TABLE IF NOT EXISTS budget_categories (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid    REFERENCES auth.users(id) ON DELETE CASCADE,
  -- NULL user_id = system default visible to all users
  name            text    NOT NULL,
  slug            text    NOT NULL,
  category_group  budget_group_enum NOT NULL,
  is_system       boolean NOT NULL DEFAULT false,
  icon            text    DEFAULT 'ti-circle',   -- Tabler icon name
  default_pct     numeric(5,2),  -- suggested % of net pay
  sort_order      int     NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, slug)
);

-- ── USER BUDGETS (one per user per month) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_budgets (
  id               uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  budget_month     date    NOT NULL,  -- always first of month: 2026-05-01
  -- Income
  gross_salary     numeric(15,2) NOT NULL,
  net_salary       numeric(15,2) NOT NULL,
  -- Cached deduction detail
  paye             numeric(15,2) NOT NULL DEFAULT 0,
  nssf             numeric(15,2) NOT NULL DEFAULT 0,
  shif             numeric(15,2) NOT NULL DEFAULT 0,
  housing_levy     numeric(15,2) NOT NULL DEFAULT 0,
  helb             numeric(15,2) NOT NULL DEFAULT 0,
  other_deductions numeric(15,2) NOT NULL DEFAULT 0,
  total_statutory  numeric(15,2) NOT NULL DEFAULT 0,
  -- Budget totals (auto-computed by trigger)
  total_budgeted   numeric(15,2) NOT NULL DEFAULT 0,
  total_essentials numeric(15,2) NOT NULL DEFAULT 0,
  total_savings    numeric(15,2) NOT NULL DEFAULT 0,
  unallocated      numeric(15,2) NOT NULL DEFAULT 0,
  -- Health
  health_score     smallint CHECK (health_score BETWEEN 0 AND 100),
  health_grade     health_grade_enum,
  -- State
  is_over_budget   boolean NOT NULL DEFAULT false,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, budget_month)
);

-- ── BUDGET LINE ITEMS (allocations inside a budget) ───────────────────────────
CREATE TABLE IF NOT EXISTS budget_line_items (
  id               uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id        uuid    NOT NULL REFERENCES user_budgets(id) ON DELETE CASCADE,
  category_id      uuid    REFERENCES budget_categories(id) ON DELETE SET NULL,
  category_name    text    NOT NULL,  -- denormalized
  category_group   budget_group_enum NOT NULL,
  icon             text    DEFAULT 'ti-circle',
  allocated_amount numeric(15,2) NOT NULL DEFAULT 0,
  percentage_of_net numeric(5,2),    -- auto-computed: (allocated/net)*100
  sort_order       int     NOT NULL DEFAULT 0,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ── BUDGET INSIGHTS (auto-generated alerts/tips) ──────────────────────────────
CREATE TABLE IF NOT EXISTS budget_insights (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id     uuid    NOT NULL REFERENCES user_budgets(id) ON DELETE CASCADE,
  insight_type  insight_type_enum NOT NULL,
  severity      severity_enum,
  category_group budget_group_enum,
  message       text    NOT NULL,
  action_label  text,   -- e.g. "Adjust rent"
  action_url    text,   -- e.g. "#essentials"
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── FINANCIAL HEALTH SCORES ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS financial_health_scores (
  id             uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  budget_id      uuid    REFERENCES user_budgets(id) ON DELETE SET NULL,
  score_month    date    NOT NULL,
  overall_score  smallint NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  -- Component scores out of 25 each
  savings_score  smallint CHECK (savings_score BETWEEN 0 AND 25),
  housing_score  smallint CHECK (housing_score BETWEEN 0 AND 25),
  debt_score     smallint CHECK (debt_score BETWEEN 0 AND 25),
  emergency_score smallint CHECK (emergency_score BETWEEN 0 AND 25),
  grade          health_grade_enum,
  summary        text,
  recommendations jsonb NOT NULL DEFAULT '[]',
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, score_month)
);

-- ── INDEXES ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_budgets_user_month
  ON user_budgets(user_id, budget_month DESC);
CREATE INDEX IF NOT EXISTS idx_budget_line_items_budget_id
  ON budget_line_items(budget_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_budget_insights_budget_id
  ON budget_insights(budget_id);
CREATE INDEX IF NOT EXISTS idx_health_scores_user_month
  ON financial_health_scores(user_id, score_month DESC);
CREATE INDEX IF NOT EXISTS idx_budget_categories_system
  ON budget_categories(is_system, category_group, sort_order) WHERE user_id IS NULL;
```

---

## A6 — ROW LEVEL SECURITY

```sql
-- payroll_import_batches
ALTER TABLE payroll_import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_only" ON payroll_import_batches
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- payroll_import_rows
ALTER TABLE payroll_import_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_via_batch" ON payroll_import_rows
  USING (batch_id IN (
    SELECT id FROM payroll_import_batches WHERE user_id = auth.uid()
  ));

-- payroll_import_errors
ALTER TABLE payroll_import_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_via_batch" ON payroll_import_errors
  USING (batch_id IN (
    SELECT id FROM payroll_import_batches WHERE user_id = auth.uid()
  ));

-- payroll_snapshots
ALTER TABLE payroll_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_only" ON payroll_snapshots
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- annual_tax_records
ALTER TABLE annual_tax_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_only" ON annual_tax_records
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- budget_categories: system rows readable by all authenticated, custom rows owner-only
ALTER TABLE budget_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "system_readable" ON budget_categories
  FOR SELECT USING (is_system = true OR auth.uid() = user_id);
CREATE POLICY "owner_write" ON budget_categories
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- user_budgets
ALTER TABLE user_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_only" ON user_budgets
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- budget_line_items
ALTER TABLE budget_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_via_budget" ON budget_line_items
  USING (budget_id IN (
    SELECT id FROM user_budgets WHERE user_id = auth.uid()
  ));

-- budget_insights
ALTER TABLE budget_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_via_budget" ON budget_insights
  USING (budget_id IN (
    SELECT id FROM user_budgets WHERE user_id = auth.uid()
  ));

-- financial_health_scores
ALTER TABLE financial_health_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_only" ON financial_health_scores
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

---

## A7 — TRIGGERS (updated_at + computed columns)

```sql
-- Generic updated_at trigger function (create once, reuse)
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Apply to all tables with updated_at
DO $$ DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'payroll_import_batches','payroll_snapshots',
    'annual_tax_records','user_budgets','budget_line_items'
  ] LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS tr_updated_at ON %I;
      CREATE TRIGGER tr_updated_at
        BEFORE UPDATE ON %I
        FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
    ', tbl, tbl);
  END LOOP;
END $$;

-- ── TRIGGER: auto-compute budget totals when line items change ────────────────
CREATE OR REPLACE FUNCTION fn_recompute_budget_totals()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_budget_id uuid;
  v_net       numeric;
  v_total     numeric;
  v_essentials numeric;
  v_savings   numeric;
BEGIN
  v_budget_id := COALESCE(NEW.budget_id, OLD.budget_id);

  SELECT net_salary INTO v_net
    FROM user_budgets WHERE id = v_budget_id;

  SELECT
    COALESCE(SUM(allocated_amount), 0),
    COALESCE(SUM(allocated_amount) FILTER (WHERE category_group = 'essentials'), 0),
    COALESCE(SUM(allocated_amount) FILTER (WHERE category_group = 'savings_security'), 0)
  INTO v_total, v_essentials, v_savings
  FROM budget_line_items WHERE budget_id = v_budget_id;

  UPDATE user_budgets SET
    total_budgeted   = v_total,
    total_essentials = v_essentials,
    total_savings    = v_savings,
    unallocated      = v_net - v_total,
    is_over_budget   = (v_total > v_net),
    updated_at       = now()
  WHERE id = v_budget_id;

  -- Auto-update percentage_of_net on the changed row
  IF TG_OP IN ('INSERT','UPDATE') AND v_net > 0 THEN
    NEW.percentage_of_net := ROUND((NEW.allocated_amount / v_net) * 100, 2);
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS tr_budget_line_items_totals ON budget_line_items;
CREATE TRIGGER tr_budget_line_items_totals
  BEFORE INSERT OR UPDATE ON budget_line_items
  FOR EACH ROW EXECUTE FUNCTION fn_recompute_budget_totals();

-- After delete, recalculate without NEW row
CREATE OR REPLACE FUNCTION fn_recompute_budget_totals_after_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_net numeric; v_total numeric; v_e numeric; v_s numeric;
BEGIN
  SELECT net_salary INTO v_net FROM user_budgets WHERE id = OLD.budget_id;
  SELECT COALESCE(SUM(allocated_amount),0),
         COALESCE(SUM(allocated_amount) FILTER (WHERE category_group='essentials'),0),
         COALESCE(SUM(allocated_amount) FILTER (WHERE category_group='savings_security'),0)
  INTO v_total, v_e, v_s FROM budget_line_items WHERE budget_id = OLD.budget_id;
  UPDATE user_budgets SET
    total_budgeted=v_total, total_essentials=v_e, total_savings=v_s,
    unallocated=v_net-v_total, is_over_budget=(v_total>v_net), updated_at=now()
  WHERE id = OLD.budget_id;
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS tr_budget_line_items_delete ON budget_line_items;
CREATE TRIGGER tr_budget_line_items_delete
  AFTER DELETE ON budget_line_items
  FOR EACH ROW EXECUTE FUNCTION fn_recompute_budget_totals_after_delete();
```

---

## A8 — DATABASE FUNCTIONS

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FN: Calculate financial health score from a budget_id
-- Returns JSONB: { overall, savings, housing, debt, emergency, grade, summary }
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_calculate_health_score(p_budget_id uuid)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_net         numeric;
  v_savings     numeric;
  v_housing     numeric;
  v_debt        numeric;  -- helb + sacco proxy
  v_emergency   numeric;
  -- Scores (each out of 25)
  s_savings     smallint := 0;
  s_housing     smallint := 0;
  s_debt        smallint := 0;
  s_emergency   smallint := 0;
  v_overall     smallint;
  v_grade       text;
  v_summary     text;
BEGIN
  -- Get net salary and deductions
  SELECT net_salary, helb, total_statutory
  INTO v_net, v_debt, v_debt
  FROM user_budgets WHERE id = p_budget_id;

  IF v_net IS NULL OR v_net = 0 THEN
    RETURN '{"overall":0,"savings":0,"housing":0,"debt":0,"emergency":0,"grade":"F"}'::jsonb;
  END IF;

  -- Savings allocation
  SELECT COALESCE(SUM(allocated_amount),0) INTO v_savings
  FROM budget_line_items
  WHERE budget_id = p_budget_id AND category_group = 'savings_security';

  -- Housing/rent allocation
  SELECT COALESCE(SUM(allocated_amount),0) INTO v_housing
  FROM budget_line_items
  WHERE budget_id = p_budget_id AND category_group = 'essentials'
    AND (lower(category_name) LIKE '%rent%' OR lower(category_name) LIKE '%housing%');

  -- Emergency savings (subset of savings_security)
  SELECT COALESCE(SUM(allocated_amount),0) INTO v_emergency
  FROM budget_line_items
  WHERE budget_id = p_budget_id
    AND (lower(category_name) LIKE '%emergency%' OR lower(category_name) LIKE '%kitty%');

  -- SAVINGS SCORE (target: ≥15% of net = 25 pts)
  s_savings := LEAST(25, FLOOR((v_savings / v_net) / 0.15 * 25))::smallint;

  -- HOUSING SCORE (target: ≤30% of net = 25 pts; 0% also bad = 10 pts)
  IF v_housing = 0 THEN s_housing := 10;
  ELSIF (v_housing / v_net) <= 0.30 THEN s_housing := 25;
  ELSIF (v_housing / v_net) <= 0.40 THEN s_housing := 18;
  ELSIF (v_housing / v_net) <= 0.50 THEN s_housing := 10;
  ELSE s_housing := 5; END IF;

  -- DEBT SCORE (target: HELB/loans ≤10% of net = 25 pts)
  SELECT COALESCE(helb + other_deductions, 0) INTO v_debt FROM user_budgets WHERE id = p_budget_id;
  IF v_net > 0 THEN
    s_debt := LEAST(25, GREATEST(0, FLOOR(25 - ((v_debt / v_net) / 0.10) * 15)))::smallint;
  ELSE s_debt := 0; END IF;

  -- EMERGENCY SCORE (target: ≥5% of net = 25 pts)
  s_emergency := LEAST(25, FLOOR((v_emergency / v_net) / 0.05 * 25))::smallint;

  v_overall := s_savings + s_housing + s_debt + s_emergency;

  v_grade := CASE
    WHEN v_overall >= 85 THEN 'A'
    WHEN v_overall >= 70 THEN 'B'
    WHEN v_overall >= 55 THEN 'C'
    WHEN v_overall >= 40 THEN 'D'
    ELSE 'F'
  END;

  v_summary := CASE v_grade
    WHEN 'A' THEN 'Excellent financial health. You are well-positioned for stability and growth.'
    WHEN 'B' THEN 'Good financial health. Minor improvements will strengthen your position.'
    WHEN 'C' THEN 'Fair health. Focus on growing savings and controlling housing costs.'
    WHEN 'D' THEN 'Needs attention. Prioritize emergency savings and debt reduction.'
    ELSE 'Critical. Your budget needs immediate restructuring to build financial resilience.'
  END;

  -- Upsert into financial_health_scores
  INSERT INTO financial_health_scores (
    user_id, budget_id, score_month, overall_score,
    savings_score, housing_score, debt_score, emergency_score,
    grade, summary
  )
  SELECT
    ub.user_id, p_budget_id, ub.budget_month,
    v_overall, s_savings, s_housing, s_debt, s_emergency,
    v_grade::health_grade_enum, v_summary
  FROM user_budgets ub WHERE ub.id = p_budget_id
  ON CONFLICT (user_id, score_month) DO UPDATE SET
    budget_id     = EXCLUDED.budget_id,
    overall_score = EXCLUDED.overall_score,
    savings_score = EXCLUDED.savings_score,
    housing_score = EXCLUDED.housing_score,
    debt_score    = EXCLUDED.debt_score,
    emergency_score = EXCLUDED.emergency_score,
    grade         = EXCLUDED.grade,
    summary       = EXCLUDED.summary;

  RETURN jsonb_build_object(
    'overall', v_overall, 'savings', s_savings,
    'housing', s_housing, 'debt', s_debt,
    'emergency', s_emergency, 'grade', v_grade, 'summary', v_summary
  );
END; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- FN: Aggregate monthly payroll snapshots into P9A totals
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_build_p9a(
  p_user_id     uuid,
  p_employee_id uuid,
  p_tax_year    int
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_record     annual_tax_records%ROWTYPE;
  v_monthly    jsonb := '[]';
  v_row        record;
  month_entry  jsonb;
BEGIN
  -- Aggregate from payroll_snapshots
  SELECT jsonb_agg(
    jsonb_build_object(
      'month',          EXTRACT(MONTH FROM payroll_month),
      'month_label',    TO_CHAR(payroll_month, 'Mon'),
      'gross',          gross_salary,
      'taxable_pay',    gross_salary - nssf_total - helb_deduction - mortgage_interest - pension_contribution,
      'paye',           paye,
      'personal_relief',personal_relief,
      'insurance_relief',insurance_relief,
      'net_paye',       paye,
      'nssf',           nssf_total,
      'shif',           shif,
      'housing_levy',   housing_levy,
      'pension',        pension_contribution,
      'net_pay',        net_pay
    ) ORDER BY payroll_month
  )
  INTO v_monthly
  FROM payroll_snapshots
  WHERE user_id = p_user_id
    AND employee_id = p_employee_id
    AND EXTRACT(YEAR FROM payroll_month) = p_tax_year;

  -- Upsert annual_tax_records
  INSERT INTO annual_tax_records (
    user_id, employee_id, tax_year,
    employee_name, employee_kra_pin, employee_nssf_no,
    monthly_records,
    total_gross_pay, total_taxable_pay, total_paye_before_relief,
    total_personal_relief, total_insurance_relief, total_net_paye,
    total_nssf, total_shif, total_housing_levy, total_pension, total_net_pay
  )
  SELECT
    p_user_id, p_employee_id, p_tax_year,
    MAX(employee_name), MAX(employee_kra_pin), MAX(employee_nssf_no),
    COALESCE(v_monthly, '[]'),
    SUM(gross_salary),
    SUM(gross_salary - nssf_total - helb_deduction - mortgage_interest - pension_contribution),
    SUM(paye),
    SUM(personal_relief),
    SUM(insurance_relief),
    SUM(paye),
    SUM(nssf_total),
    SUM(shif),
    SUM(housing_levy),
    SUM(pension_contribution),
    SUM(net_pay)
  FROM payroll_snapshots
  WHERE user_id = p_user_id
    AND employee_id = p_employee_id
    AND EXTRACT(YEAR FROM payroll_month) = p_tax_year
  ON CONFLICT (user_id, employee_id, tax_year) DO UPDATE SET
    monthly_records       = EXCLUDED.monthly_records,
    total_gross_pay       = EXCLUDED.total_gross_pay,
    total_taxable_pay     = EXCLUDED.total_taxable_pay,
    total_paye_before_relief = EXCLUDED.total_paye_before_relief,
    total_personal_relief = EXCLUDED.total_personal_relief,
    total_insurance_relief = EXCLUDED.total_insurance_relief,
    total_net_paye        = EXCLUDED.total_net_paye,
    total_nssf            = EXCLUDED.total_nssf,
    total_shif            = EXCLUDED.total_shif,
    total_housing_levy    = EXCLUDED.total_housing_levy,
    total_pension         = EXCLUDED.total_pension,
    total_net_pay         = EXCLUDED.total_net_pay,
    generated_at          = now(),
    updated_at            = now()
  RETURNING * INTO v_record;

  RETURN row_to_json(v_record)::jsonb;
END; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- FN: Generate budget insights for a given budget_id
-- Called after budget line items are saved
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_generate_budget_insights(p_budget_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_net      numeric;
  v_housing  numeric;
  v_savings  numeric;
  v_emergency numeric;
  v_total    numeric;
BEGIN
  SELECT net_salary, total_budgeted, total_savings
  INTO v_net, v_total, v_savings
  FROM user_budgets WHERE id = p_budget_id;

  SELECT COALESCE(SUM(allocated_amount), 0) INTO v_housing
  FROM budget_line_items
  WHERE budget_id = p_budget_id AND category_group = 'essentials'
    AND lower(category_name) LIKE '%rent%';

  SELECT COALESCE(SUM(allocated_amount), 0) INTO v_emergency
  FROM budget_line_items
  WHERE budget_id = p_budget_id
    AND lower(category_name) LIKE '%emergency%';

  -- Clear old insights for this budget
  DELETE FROM budget_insights WHERE budget_id = p_budget_id;

  -- Over budget alert
  IF v_total > v_net THEN
    INSERT INTO budget_insights(budget_id, insight_type, severity, message, action_label)
    VALUES (p_budget_id, 'alert', 'high',
      'Your total allocations exceed your net salary by KES ' ||
      TO_CHAR(v_total - v_net, 'FM999,999,999') || '. Reduce some categories to balance.',
      'Fix allocations');
  END IF;

  -- Rent ratio warning
  IF v_net > 0 AND v_housing / v_net > 0.40 THEN
    INSERT INTO budget_insights(budget_id, insight_type, severity, category_group, message)
    VALUES (p_budget_id, 'warning', 'high', 'essentials',
      'Your rent is ' || ROUND((v_housing/v_net)*100) ||
      '% of your net pay. Financial advisors recommend keeping housing below 30%.');
  END IF;

  -- Low savings warning
  IF v_net > 0 AND v_savings / v_net < 0.10 THEN
    INSERT INTO budget_insights(budget_id, insight_type, severity, category_group, message)
    VALUES (p_budget_id, 'warning', 'medium', 'savings_security',
      'You are saving less than 10% of your net income. Target at least 15–20% for financial resilience.');
  END IF;

  -- No emergency fund
  IF v_emergency = 0 THEN
    INSERT INTO budget_insights(budget_id, insight_type, severity, category_group, message, action_label)
    VALUES (p_budget_id, 'tip', 'medium', 'savings_security',
      'You have no emergency kitty allocation. Experts recommend 3–6 months of expenses in an accessible fund.',
      'Add emergency fund');
  END IF;

  -- Healthy budget tip
  IF v_total <= v_net AND v_savings / v_net >= 0.15 AND v_housing / v_net <= 0.30 THEN
    INSERT INTO budget_insights(budget_id, insight_type, severity, message)
    VALUES (p_budget_id, 'achievement', 'low',
      'Great budget! Your savings rate and housing ratio are within healthy ranges.');
  END IF;
END; $$;
```

---

## A9 — SEED DATA (System Budget Categories)

```sql
INSERT INTO budget_categories
  (user_id, name, slug, category_group, is_system, icon, default_pct, sort_order)
VALUES
  -- ESSENTIALS
  (NULL,'Rent / Housing','rent','essentials',true,'ti-home-2',28,1),
  (NULL,'Electricity','electricity','essentials',true,'ti-bolt',3,2),
  (NULL,'Water Bill','water','essentials',true,'ti-droplet',1,3),
  (NULL,'Food & Groceries','food','essentials',true,'ti-basket',12,4),
  (NULL,'Transport','transport','essentials',true,'ti-bus',6,5),
  (NULL,'Airtime & Internet','airtime','essentials',true,'ti-wifi',2,6),
  (NULL,'Insurance Premiums','insurance','essentials',true,'ti-shield-check',3,7),
  (NULL,'Garbage / Rates','garbage','essentials',true,'ti-trash',1,8),
  -- FAMILY & SOCIAL
  (NULL,'Parents / Family Support','family_support','family_social',true,'ti-heart',5,10),
  (NULL,'School Fees Support','school_fees','family_social',true,'ti-school',5,11),
  (NULL,'Family Emergencies','family_emergency','family_social',true,'ti-first-aid-kit',2,12),
  -- VEHICLE & MOBILITY
  (NULL,'Fuel','fuel','vehicle_mobility',true,'ti-gas-station',4,20),
  (NULL,'Vehicle Maintenance','car_maintenance','vehicle_mobility',true,'ti-tool',2,21),
  (NULL,'Parking','parking','vehicle_mobility',true,'ti-parking',1,22),
  -- SAVINGS & SECURITY
  (NULL,'Emergency Kitty','emergency','savings_security',true,'ti-pig-money',5,30),
  (NULL,'Savings','savings','savings_security',true,'ti-piggy-bank',10,31),
  (NULL,'Investments','investments','savings_security',true,'ti-trending-up',5,32),
  -- LIFESTYLE
  (NULL,'Clothing','clothing','lifestyle',true,'ti-shirt',3,40),
  (NULL,'Entertainment','entertainment','lifestyle',true,'ti-device-tv',2,41),
  (NULL,'Dining Out','dining_out','lifestyle',true,'ti-tools-kitchen-2',2,42),
  (NULL,'Gym / Fitness','gym','lifestyle',true,'ti-barbell',1,43),
  -- OTHER
  (NULL,'Miscellaneous','misc','other',true,'ti-dots-circle-horizontal',2,50)
ON CONFLICT (user_id, slug) DO NOTHING;
```

---

# ═══════════════════════════════════════════════════════════
# SECTION B — COPILOT FRONTEND IMPLEMENTATION TASKS
# ═══════════════════════════════════════════════════════════

> All tasks below are YOUR responsibility as GitHub Copilot.
> Database is live. Write HTML, CSS, and JavaScript only.
> Every page must be mobile-first, match existing branding,
> and preserve all existing SEO/routes.

---

## SHARED UTILITIES TO CREATE FIRST

### `assets/js/supabase-client.js` (if not already modular)
Ensure a singleton Supabase client is exported:
```js
// Use existing Supabase CDN client or ESM import
// Export as: window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
```

### `assets/js/salary-engine.js`
Extract existing PAYE/NSSF/SHIF/Housing Levy calculation logic into a reusable module:
```js
// Export: calculateDeductions(grossSalary, options = {})
// options: { helb, pension, mortgageInterest, insurancePremium, pwdExempt, sacco }
// Returns: { paye, nssf, shif, housingLevy, totalDeductions, netSalary, effectiveRate }
// DO NOT change the existing calculation logic — wrap it.
```

### `assets/js/format-utils.js`
```js
// formatKES(amount)  → "KES 45,231"
// formatPct(value)   → "23.4%"
// monthLabel(date)   → "May 2026"
// firstOfMonth(y, m) → Date object
```

---

## TASK 1 — PAYROLL IMPORT SYSTEM

**New page:** `/payroll-import.html`
**Nav location:** Under "Calculators" dropdown → "Payroll Import"
**Premium gate:** YES — show upgrade prompt to free users

### Page Structure

```
Header (existing nav)
  ↓
Hero: "Bulk Payroll Import" — brief description + premium badge
  ↓
STEP INDICATOR: [1. Download Template] → [2. Fill & Upload] → [3. Preview] → [4. Import]
  ↓
STEP 1 PANEL — Template Download
STEP 2 PANEL — File Upload
STEP 3 PANEL — Preview & Validation
STEP 4 PANEL — Confirmation
  ↓
BATCH HISTORY TABLE (past imports)
  ↓
Footer (existing)
```

### STEP 1 — Template Download Panel (`#step-download`)

Render three download cards side by side (responsive grid):

| Card | Title | Description | Button |
|---|---|---|---|
| Employee Import | "Onboard employees in bulk" | Fields: name, national_id, kra_pin, nssf_no, shif_no, department, position, bank_details, employment_date | Download CSV / Download XLSX |
| Monthly Payroll | "Upload monthly salary run" | Fields: employee_id_or_name, basic_salary, house_allowance, transport_allowance, bonuses, overtime, helb, sacco, insurance, mortgage_relief, pension | Download CSV / Download XLSX |
| P9A Annual | "Annual tax record prefill" | Fields: employee_name, kra_pin, and 12 monthly columns (gross, paye, relief, nssf, shif, housing_levy, pension, net_pay) | Download CSV / Download XLSX |

**JS:** Generate CSV files in-browser using Blob API — no server needed.
Each template should include one example row with placeholder data.
After download, auto-advance step indicator to Step 2.

### STEP 2 — File Upload Panel (`#step-upload`)

```html
<!-- Template type selector (radio buttons styled as cards) -->
<div id="template-type-selector">
  [ Employee Import ] [ Monthly Payroll ] [ P9A Annual ]
</div>

<!-- Drop zone -->
<div id="drop-zone" class="drop-zone">
  Drag & drop your CSV or XLSX file here, or click to browse
  Supported: .csv, .xlsx — Max 5MB
</div>

<!-- File info row (shown after selection) -->
<div id="file-info" hidden>
  [file icon] filename.csv — 2.3 KB — 45 rows detected
  [Change file ×]
</div>

<!-- Upload button -->
<button id="btn-upload" disabled>Upload & Validate →</button>
```

**JS requirements:**
- Parse CSV using PapaParse (CDN) and XLSX using SheetJS (CDN)
- Validate: file size ≤ 5MB, correct extension, at least 2 rows (header + 1 data)
- Auto-detect column mapping (fuzzy match: "Basic Pay" → `basic_salary`, "Full Name" → `employee_name`, etc.)
- Show a column mapping confirmation UI if headers don't exactly match expected names
- On upload, POST parsed data to Supabase Edge Function `/parse-import` (or insert directly to `payroll_import_batches` + `payroll_import_rows` via Supabase JS client)
- Insert batch record first → get `batch_id` → insert rows in chunks of 50

### STEP 3 — Preview Panel (`#step-preview`)

```
SUMMARY BAR:
  Total rows: 45  |  Valid: 43 (green)  |  Errors: 2 (red)  |  Warnings: 1 (amber)

ERROR PANEL (collapsible, shown if errors > 0):
  Row 12: "KRA PIN" — Invalid format (must be A-Z + 9 digits)
  Row 31: "Basic Salary" — Missing required field

PREVIEW TABLE:
  Show first 10 valid rows with mapped column names
  Highlight error rows in red, warning rows in amber
  Allow inline edit of individual cells before confirming

ACTION BUTTONS:
  [← Re-upload]  [Download Error Report]  [Confirm & Import →]
```

**JS:** Fetch rows from `payroll_import_rows` for this `batch_id`.
Validate KRA PIN format: `/^[A-Z]\d{9}[A-Z]$/`
Validate salary: positive number, max KES 5,000,000
Validate national ID: 8 digits
Inline edits update the row's `mapped_data` in Supabase before final confirm.

### STEP 4 — Confirmation Panel (`#step-done`)

```
✓ Import Successful

  43 employees processed
  43 payslips queued for generation  [Generate Payslips →]
  2 rows skipped (see error report)  [Download Errors ↓]

  [View Payroll Dashboard →]  [Import Another File →]
```

On confirm, update `payroll_import_batches.status` → `'completed'` and copy
validated `payroll_import_rows` data into `payroll_snapshots` for each valid row.

### BATCH HISTORY TABLE

Below the stepper, show past imports from `payroll_import_batches`:

| Date | Template | File | Rows | Status | Actions |
|---|---|---|---|---|---|
| 01 May 2026 | Monthly Payroll | may_payroll.csv | 45 rows | Completed | View / Re-import |

Fetch with:
```js
supabase.from('payroll_import_batches')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(20)
```

---

## TASK 2 — P9A ANNUAL TAX FORM GENERATOR

**New page:** `/p9a-generator.html`
**Nav location:** Under "Calculators" → "P9A Generator"
**Premium gate:** YES

### Page Structure

```
Header
  ↓
Hero: "P9A Annual Tax Form Generator" — KRA-compliant, instant download
  ↓
EMPLOYEE SELECTOR — dropdown of employees from `employees` table
   OR manual entry for individual users without employee records
  ↓
YEAR SELECTOR — 2020 → current year (default: previous year)
  ↓
MONTHLY PAYROLL TABLE — 12 editable rows
  ↓
TOTALS ROW — auto-computed
  ↓
EMPLOYER DETAILS FORM
  ↓
ACTION BUTTONS: [Save Draft] [Generate PDF] [Email to Employee]
  ↓
PAST P9A RECORDS TABLE
Footer
```

### Monthly Payroll Table

12 rows, one per month. Columns:

| Month | Gross Pay | Taxable Pay | PAYE (Gross) | Personal Relief | Insurance Relief | Net PAYE | NSSF | SHIF | Housing Levy | Pension | Net Pay |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Jan | — | auto | auto | 2,400 | — | auto | auto | auto | auto | — | auto |

**JS behaviour:**
- On page load: call `fn_build_p9a(userId, employeeId, year)` via Supabase RPC
  ```js
  const { data } = await supabase.rpc('fn_build_p9a', {
    p_user_id: userId,
    p_employee_id: employeeId,
    p_tax_year: year
  })
  ```
  This auto-populates rows from `payroll_snapshots` if they exist.
- If no snapshots exist: render empty editable table
- Each row: entering `Gross Pay` auto-fills Taxable Pay, Net PAYE, NSSF, SHIF, Housing Levy using `salary-engine.js`
- Manual overrides allowed — mark row as `manually_edited`
- Totals row: live sum of all 12 months

### PDF Generation

Use the existing **jsPDF** library (already in the project or add via CDN).

**P9A PDF layout** (A4 portrait, KRA format):
```
─────────────────────────────────────────────────
KRA P9A — EMPLOYEE TAX DEDUCTION CARD
Tax Year: [YEAR]
─────────────────────────────────────────────────
EMPLOYEE DETAILS
Name:          [employee_name]
KRA PIN:       [kra_pin]
NSSF No.:      [nssf_no]
National ID:   [national_id]

EMPLOYER DETAILS
Name:          [employer_name]
KRA PIN:       [employer_kra_pin]

─────────────────────────────────────────────────
MONTHLY BREAKDOWN
Month | Gross | Taxable Pay | PAYE (Gross) | Personal Relief | Insurance Relief | Net PAYE | NSSF | SHIF | Housing Levy | Pension | Net Pay
Jan   | ...
Feb   | ...
...   | ...
─────────────────────────────────────────────────
ANNUAL TOTALS
Total Gross:        KES [x]
Total Net PAYE:     KES [x]
Total NSSF:         KES [x]
Total SHIF:         KES [x]
Total Housing Levy: KES [x]
Total Pension:      KES [x]
Total Net Pay:      KES [x]
─────────────────────────────────────────────────
Prepared by SalaryCalculator.co.ke | salarycalculator.co.ke
```

**Save record** to `annual_tax_records` via Supabase before PDF download.

### Past P9A Records Table

Fetch from `annual_tax_records` for the logged-in user, show:
| Employee | Tax Year | Last Generated | Status | Actions |
|---|---|---|---|---|
| John Kamau | 2025 | 01 May 2026 | Finalized | Download PDF / Regenerate |

---

## TASK 3 — PERSONAL BUDGET PLANNER

**New page:** `/budget-planner.html`
**Nav location:** Top nav → "Budget Planner" (NEW item — for personal users only)
**Premium gate:** PARTIAL — free users get 1 saved budget, premium get unlimited + history + health score
**Account gate:** Personal accounts only. If `account_type === 'organization'`, show a message: "Budget Planner is designed for individual employees. Switch to your personal account to use this feature."

### Page Layout (3-panel desktop, stacked mobile)

```
┌─────────────────────────────────────────────────────────┐
│  HEADER                                                   │
├───────────────┬────────────────────────┬─────────────────┤
│  LEFT PANEL   │    CENTRE PANEL        │   RIGHT PANEL   │
│  Salary       │    Budget Allocations  │   Summary &     │
│  Input        │    (line items)        │   Health Score  │
│  (300px)      │    (flex-grow)         │   (280px)       │
└───────────────┴────────────────────────┴─────────────────┘
```

On mobile: Left → Centre → Right stacked vertically with sticky "Save Budget" button at bottom.

### LEFT PANEL — Salary & Deductions (`#panel-salary`)

```html
<label>Monthly Gross Salary (KES)</label>
<input type="number" id="gross-input" placeholder="e.g. 80000" min="0" step="100">

<label>Month</label>
<input type="month" id="budget-month">

<!-- Optional deductions (collapsible) -->
<details>
  <summary>Add extra deductions (optional)</summary>
  <label>HELB Repayment</label>    <input type="number" id="helb-input">
  <label>SACCO Deduction</label>   <input type="number" id="sacco-input">
  <label>Other Deductions</label>  <input type="number" id="other-input">
</details>

<!-- Live net pay display -->
<div id="net-pay-card">
  <span class="label">Estimated Net Pay</span>
  <span class="amount" id="net-pay-display">—</span>
  <div class="deduction-mini">
    PAYE <span id="d-paye">—</span> ·
    NSSF <span id="d-nssf">—</span> ·
    SHIF <span id="d-shif">—</span> ·
    Housing <span id="d-housing">—</span>
  </div>
</div>

<button id="btn-auto-budget">Auto-generate budget →</button>
```

**JS:** On gross input change, call `calculateDeductions()` from `salary-engine.js`, update all displays. `btn-auto-budget` populates the centre panel with recommended allocations from system `budget_categories` using `default_pct` values.

### CENTRE PANEL — Budget Allocations (`#panel-allocations`)

```html
<!-- Group accordion sections -->
<div class="budget-group" data-group="essentials">
  <div class="group-header">
    <span class="group-title">Essentials</span>
    <span class="group-total" id="total-essentials">KES 0</span>
    <button class="btn-add-item">+ Add item</button>
  </div>
  <div class="group-items" id="items-essentials">
    <!-- Line items rendered here -->
  </div>
</div>
<!-- Repeat for: family_social, vehicle_mobility, savings_security, lifestyle, other -->

<!-- Bottom: unallocated display -->
<div id="unallocated-bar">
  <span>Unallocated: <strong id="unallocated-amount">KES 0</strong></span>
  <div class="progress-bar">
    <div id="progress-fill" class="progress-fill"></div>
  </div>
</div>
```

**Each line item row:**
```html
<div class="line-item" data-id="[category_id]">
  <i class="ti [icon]"></i>
  <span class="item-name">[name]</span>
  <input type="number" class="item-amount" value="[amount]" min="0">
  <span class="item-pct">[x]%</span>
  <button class="btn-remove-item" title="Remove">×</button>
</div>
```

**JS behaviour:**
- Amount input `oninput`: update `item-pct` = `(amount / netSalary * 100).toFixed(1)`, update group total, update unallocated bar, update right panel
- Progress bar: green when ≤ 95% allocated, amber 95–100%, red > 100%
- `btn-add-item`: show modal with remaining system categories for that group + free-text custom name
- `btn-remove-item`: remove row, recompute
- Over-budget state: show red warning banner "You are over budget by KES X"
- On auto-generate: populate all groups with `default_pct` values from system categories; scale to net salary; round to nearest 100 KES

### RIGHT PANEL — Summary & Health Score (`#panel-summary`)

```html
<!-- Income summary card -->
<div class="summary-card">
  <div class="row"><span>Gross Salary</span><span id="s-gross">—</span></div>
  <div class="row deductions"><span>Total Deductions</span><span id="s-deductions">—</span></div>
  <div class="row net"><span>Net Pay</span><span id="s-net">—</span></div>
  <div class="divider"></div>
  <div class="row"><span>Total Budgeted</span><span id="s-budgeted">—</span></div>
  <div class="row highlight"><span>Unallocated</span><span id="s-unallocated">—</span></div>
</div>

<!-- Donut chart (Chart.js) -->
<canvas id="budget-donut" width="220" height="220"></canvas>
<!-- Legend auto-generated per group -->

<!-- Health Score (shown after save — premium) -->
<div id="health-score-card" hidden>
  <div class="score-ring" data-score="0">
    <span class="score-number">—</span>
    <span class="score-grade">—</span>
  </div>
  <p class="score-summary">—</p>
  <div class="score-components">
    <div>Savings <span id="sc-savings">—/25</span></div>
    <div>Housing <span id="sc-housing">—/25</span></div>
    <div>Debt    <span id="sc-debt">—/25</span></div>
    <div>Emergency <span id="sc-emergency">—/25</span></div>
  </div>
</div>

<!-- Insights (shown after save) -->
<div id="insights-panel" hidden>
  <!-- Rendered from budget_insights rows -->
</div>

<!-- Save button -->
<button id="btn-save-budget" class="btn-primary btn-full" disabled>
  Save Budget
</button>
<!-- Free users: "You have used 1/1 free budget saves. Upgrade for unlimited." -->
```

**Health score ring:** SVG circle with `stroke-dasharray` animation, colored by grade (green A/B, amber C, red D/F).

**JS — Save budget flow:**
```js
async function saveBudget() {
  // 1. Upsert user_budgets (UNIQUE on user_id + budget_month)
  const { data: budget } = await supabase
    .from('user_budgets')
    .upsert({ user_id, budget_month, gross_salary, net_salary, paye, nssf, shif, housing_levy, helb, ... })
    .select().single()

  // 2. Delete existing line items for this budget (clean slate)
  await supabase.from('budget_line_items').delete().eq('budget_id', budget.id)

  // 3. Insert all line items
  await supabase.from('budget_line_items').insert(lineItems.map(item => ({
    budget_id: budget.id,
    category_id: item.categoryId,
    category_name: item.name,
    category_group: item.group,
    icon: item.icon,
    allocated_amount: item.amount,
    sort_order: item.sortOrder
  })))

  // 4. Call health score function (premium only)
  if (isPremium) {
    const { data: score } = await supabase.rpc('fn_calculate_health_score', { p_budget_id: budget.id })
    renderHealthScore(score)
  }

  // 5. Fetch and render insights
  const { data: insights } = await supabase
    .from('budget_insights')
    .select('*')
    .eq('budget_id', budget.id)
  renderInsights(insights)
}
```

### Budget History Page (premium)

**New page:** `/budget-history.html`
Show past months as cards:

```
May 2026  |  KES 80,000 gross  |  Score: 72 (B)  |  Saved KES 12,000  |  [View] [Copy to this month]
Apr 2026  |  KES 78,000 gross  |  Score: 68 (C)  |  Saved KES 9,500   |  [View] [Copy to this month]
```

Also include a line chart (Chart.js) showing health score trend over past 12 months.

---

## TASK 4 — REVERSE SALARY CALCULATOR

**New page:** `/reverse-salary-calculator.html` (also: `/net-to-gross-kenya.html` as canonical alias)
**Nav location:** Under "Calculators" → "Reverse Calculator"
**Premium gate:** NO — free feature (high SEO value)

### Page structure

Minimal, fast-loading — match existing calculator page style.

```html
<h1>Reverse Salary Calculator — Net to Gross Kenya</h1>
<p>Enter your desired take-home pay. We'll calculate the gross salary you need.</p>

<label>Desired Net Monthly Pay (KES)</label>
<input type="number" id="desired-net" placeholder="e.g. 50000">

<label>Include HELB deduction?</label>
<input type="number" id="helb" placeholder="0">

<label>Include pension contribution?</label>
<input type="number" id="pension" placeholder="0">

<button id="btn-reverse">Calculate Required Gross →</button>

<!-- Results card -->
<div id="reverse-result" hidden>
  <h2>Required Gross Salary</h2>
  <div class="big-number" id="result-gross">KES —</div>
  <table id="reverse-breakdown">
    <!-- PAYE, NSSF, SHIF, Housing Levy rows -->
  </table>
  <p class="cta-note">
    Heading into a job negotiation?
    <a href="/salary-comparison.html">Compare with Kenya salary benchmarks →</a>
  </p>
</div>
```

**JS — Binary search approach (efficient, no closed-form for progressive PAYE):**
```js
function reverseCalculate(targetNet, options = {}) {
  let low = targetNet, high = targetNet * 3, mid, result
  for (let i = 0; i < 50; i++) {  // max 50 iterations
    mid = (low + high) / 2
    result = calculateDeductions(mid, options)
    if (Math.abs(result.netSalary - targetNet) < 1) break
    if (result.netSalary < targetNet) low = mid
    else high = mid
  }
  return { gross: Math.ceil(mid), ...result }
}
```

**SEO requirements for this page:**
```html
<title>Reverse Salary Calculator Kenya 2026 | Net to Gross PAYE Calculator</title>
<meta name="description" content="Calculate what gross salary you need to earn your desired net take-home pay in Kenya. Updated for FY 2025/2026 PAYE, NSSF, SHIF and Housing Levy rates.">
<!-- FAQ Schema -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How do I calculate gross salary from net pay in Kenya?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Use our reverse salary calculator: enter your desired net pay and we compute the required gross salary after PAYE, NSSF (6%), SHIF (2.75%), and Housing Levy (1.5%) deductions."
      }
    },
    {
      "@type": "Question",
      "name": "What gross salary gives KES 50,000 net pay in Kenya?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "To earn KES 50,000 net in Kenya for FY 2025/2026, you need approximately KES 64,100 gross salary, after PAYE of KES 8,985, NSSF of KES 3,846, SHIF of KES 1,763, and Housing Levy of KES 961."
      }
    }
  ]
}
</script>
```

---

## TASK 5 — ADVANCED ALLOWANCE INPUTS (UPGRADE EXISTING CALCULATOR)

**Target file:** `/calculator.html` (and the underlying `assets/js/calculator.js`)
**Change type:** ADDITIVE — add a collapsible "Advanced Deductions & Allowances" panel

**DO NOT change existing basic calculation flow.**

Add below the existing gross salary input:

```html
<details id="advanced-deductions" class="advanced-panel">
  <summary>
    <i class="ti ti-adjustments-horizontal"></i>
    Advanced: Allowances & Deductions
    <span class="badge-optional">Optional</span>
  </summary>

  <div class="adv-section">
    <h4>Taxable Allowances</h4>
    <div class="input-row">
      <label>House Allowance</label>
      <input type="number" id="adv-house-allowance" placeholder="0" min="0">
    </div>
    <div class="input-row">
      <label>Transport Allowance</label>
      <input type="number" id="adv-transport-allowance" placeholder="0" min="0">
    </div>
    <div class="input-row">
      <label>Other Taxable Allowances</label>
      <input type="number" id="adv-other-taxable" placeholder="0" min="0">
    </div>
  </div>

  <div class="adv-section">
    <h4>Allowable Deductions (reduce taxable income)</h4>
    <div class="input-row">
      <label>HELB Repayment</label>
      <input type="number" id="adv-helb" placeholder="0" min="0">
    </div>
    <div class="input-row">
      <label>Pension Contribution</label>
      <input type="number" id="adv-pension" placeholder="0 (max KES 30,000/mo)" min="0" max="30000">
    </div>
    <div class="input-row">
      <label>Mortgage Interest</label>
      <input type="number" id="adv-mortgage" placeholder="0 (max KES 30,000/mo)" min="0" max="30000">
    </div>
    <div class="input-row">
      <label>SACCO Contribution</label>
      <input type="number" id="adv-sacco" placeholder="0" min="0">
    </div>
  </div>

  <div class="adv-section">
    <h4>Tax Relief (reduce PAYE directly)</h4>
    <div class="input-row">
      <label>Health Insurance Premium</label>
      <input type="number" id="adv-health-ins" placeholder="0">
      <small>15% relief, max KES 5,000/mo</small>
    </div>
    <div class="input-row">
      <label>Life Insurance Premium</label>
      <input type="number" id="adv-life-ins" placeholder="0">
      <small>15% relief, max KES 5,000/mo combined</small>
    </div>
  </div>

  <div class="adv-section">
    <h4>Special</h4>
    <div class="input-row checkbox-row">
      <label>
        <input type="checkbox" id="adv-pwd">
        PWD Tax Exemption (Persons with Disability)
      </label>
    </div>
  </div>
</details>
```

**In `calculator.js`:** Read all advanced fields when present and pass to `calculateDeductions()` options. If field is empty/0, behaviour is identical to current calculator.

**Add to results section:** A "Tax Savings" line showing how much the advanced deductions reduced the PAYE vs the basic calculation (colour it green, e.g. "You saved KES 2,300 in PAYE through allowable deductions").

---

## SEO REQUIREMENTS FOR ALL NEW PAGES

Each new `.html` page must include in `<head>`:

```html
<!-- Primary meta -->
<title>[Page-specific title] | Kenya Salary Calculator 2026</title>
<meta name="description" content="[150 char description]">
<meta name="keywords" content="[relevant keywords]">
<link rel="canonical" href="https://salarycalculator.co.ke/[page].html">

<!-- Open Graph -->
<meta property="og:title" content="[title]">
<meta property="og:description" content="[description]">
<meta property="og:url" content="https://salarycalculator.co.ke/[page].html">
<meta property="og:type" content="website">
<meta property="og:image" content="https://salarycalculator.co.ke/kenyan-economy-coins.jpg">

<!-- Schema: WebApplication -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "[Feature Name] — Kenya Salary Calculator",
  "url": "https://salarycalculator.co.ke/[page].html",
  "applicationCategory": "FinanceApplication",
  "operatingSystem": "Web",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "KES" }
}
</script>
```

---

## PREMIUM GATE PATTERN

Reuse this exact pattern for gating premium features:

```js
async function checkPremiumAndRender(renderFn) {
  const { data: { user } } = await supabaseClient.auth.getUser()
  if (!user) { showAuthPrompt(); return; }

  const { data: profile } = await supabaseClient
    .from('user_profiles')
    .select('is_premium, premium_expires_at')
    .eq('id', user.id)
    .single()

  const isPremium = profile?.is_premium &&
    new Date(profile.premium_expires_at) > new Date()

  if (!isPremium) {
    showUpgradePrompt({
      feature: 'Payroll Import',
      monthlyPrice: 'KES 499',
      annualPrice: 'KES 4,999',
      upgradeUrl: '/account.html#upgrade'
    })
    return
  }

  renderFn(user, profile)
}
```

---

## NAVIGATION UPDATES

Update the existing nav in all pages to add new links:

```html
<!-- Under "Calculators" dropdown — add: -->
<a href="/reverse-salary-calculator.html">Reverse Calculator</a>
<a href="/payroll-import.html">Payroll Import <span class="badge-premium">Premium</span></a>
<a href="/p9a-generator.html">P9A Generator <span class="badge-premium">Premium</span></a>

<!-- New top-level nav item (between "Calculators" and "Salaries"): -->
<a href="/budget-planner.html">Budget Planner</a>
```

---

## PERFORMANCE RULES

- All charts: lazy-load `Chart.js` only on pages that use it
- PapaParse + SheetJS: load on `/payroll-import.html` only, not globally
- jsPDF: load on `/p9a-generator.html` only
- All Supabase queries: add `.abortSignal()` on navigation
- Budget line items render: use `DocumentFragment` to batch DOM inserts
- Target Lighthouse score: ≥ 90 on all new pages

---

## FILE DELIVERY CHECKLIST

Before finishing, confirm:

- [ ] `/reverse-salary-calculator.html` — complete with FAQ schema
- [ ] `/payroll-import.html` — all 4 steps functional, batch history
- [ ] `/p9a-generator.html` — editable table, PDF export, history
- [ ] `/budget-planner.html` — 3-panel layout, donut chart, health score
- [ ] `/budget-history.html` — history cards + trend chart (premium)
- [ ] `/calculator.html` — advanced deductions panel added (non-breaking)
- [ ] `assets/js/salary-engine.js` — reusable calculation module
- [ ] `assets/js/format-utils.js` — utility functions
- [ ] Nav updated in all pages
- [ ] All pages mobile-responsive
- [ ] All pages include correct meta/OG/schema tags
- [ ] Premium gates applied to gated features
- [ ] No existing functionality broken
