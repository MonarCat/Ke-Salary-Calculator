(function () {
  const PLAN_FEATURES = {
    free: {
      label: 'Free Plan',
      calculators: true,
      payslipGenerator: true,
      payslipDownloadsPerMonth: 2,
      maxEmployees: 2,
      bulkPayslips: false,
      payrollHistory: false,
      payrollReport: false,
      csvExport: false,
      pdfExport: false,
      p9aGenerator: false,
      payrollImport: false,
      orgProfile: false,
      personalPayslipHistory: false,
      p9aPersonal: false,
      budgetPlanner: false,
    },
    premium_personal: {
      label: 'Premium — Personal',
      calculators: true,
      payslipGenerator: true,
      payslipDownloadsPerMonth: Infinity,
      personalPayslipHistory: true,
      p9aPersonal: true,
      budgetPlanner: true,
      csvExport: true,
      maxEmployees: 0,
      bulkPayslips: false,
      payrollHistory: false,
      payrollReport: false,
      orgProfile: false,
      payrollImport: false,
      p9aGenerator: false,
      pdfExport: false,
    },
    premium_org: {
      label: 'Premium — Organisation',
      calculators: true,
      payslipGenerator: true,
      payslipDownloadsPerMonth: Infinity,
      maxEmployees: 1000,
      bulkPayslips: true,
      payrollHistory: true,
      payrollReport: true,
      csvExport: true,
      pdfExport: true,
      p9aGenerator: true,
      payrollImport: true,
      orgProfile: true,
      multipleDepts: true,
      kraComplianceReports: true,
      personalPayslipHistory: true,
      p9aPersonal: true,
      budgetPlanner: true,
    },
  };

  let cachedPlan = null;

  function normalizeAccountType(accountType) {
    const t = String(accountType || '').toLowerCase();
    if (t === 'personal' || t === 'employee') return 'personal';
    return 'organisation';
  }

  async function getCurrentUserPlan() {
    if (cachedPlan) return cachedPlan;
    if (typeof window.supabaseClient === 'undefined' || !window.supabaseClient || typeof window.isSupabaseConfigured !== 'function' || !window.isSupabaseConfigured()) {
      cachedPlan = 'free';
      return cachedPlan;
    }

    try {
      const { data: authData } = await window.supabaseClient.auth.getUser();
      const user = authData && authData.user;
      if (!user) {
        cachedPlan = 'free';
        return cachedPlan;
      }

      const { data: profile } = await window.supabaseClient
        .from('user_profiles')
        .select('premium, premium_expires_at, account_type')
        .eq('id', user.id)
        .maybeSingle();

      const activePremium = !!profile?.premium && (!profile?.premium_expires_at || new Date(profile.premium_expires_at) > new Date());
      if (!activePremium) {
        cachedPlan = 'free';
        return cachedPlan;
      }

      cachedPlan = normalizeAccountType(profile?.account_type) === 'personal' ? 'premium_personal' : 'premium_org';
      return cachedPlan;
    } catch (_) {
      cachedPlan = 'free';
      return cachedPlan;
    }
  }

  function canAccess(feature, planOverride) {
    const plan = planOverride || cachedPlan || 'free';
    return !!PLAN_FEATURES[plan]?.[feature];
  }

  window.PLAN_FEATURES = PLAN_FEATURES;
  window.getCurrentUserPlan = getCurrentUserPlan;
  window.canAccess = canAccess;
})();
