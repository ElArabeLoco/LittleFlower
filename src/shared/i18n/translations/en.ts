/**
 * English translations — must match the shape of es.ts exactly.
 */
import type { Translations } from './es';

export const en: Translations = {
  // ---------------------------------------------------------------------------
  // Common
  // ---------------------------------------------------------------------------
  common: {
    cancel: 'Cancel',
    save: 'Save',
    saving: 'Saving...',
    create: 'Create',
    creating: 'Creating...',
    delete: 'Delete',
    edit: 'Edit',
    back: 'Back',
    close: 'Close',
    loading: 'Loading...',
    unexpectedError: 'Unexpected error',
    new: 'New',
    optional: '(optional)',
    from: 'from',
    register: 'Record',
    registering: 'Recording...',
  },

  // ---------------------------------------------------------------------------
  // Month names
  // ---------------------------------------------------------------------------
  months: {
    short: {
      '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
      '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug',
      '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec',
    },
    shortLower: {
      '01': 'jan', '02': 'feb', '03': 'mar', '04': 'apr',
      '05': 'may', '06': 'jun', '07': 'jul', '08': 'aug',
      '09': 'sep', '10': 'oct', '11': 'nov', '12': 'dec',
    },
    full: {
      '01': 'January', '02': 'February', '03': 'March', '04': 'April',
      '05': 'May', '06': 'June', '07': 'July', '08': 'August',
      '09': 'September', '10': 'October', '11': 'November', '12': 'December',
    },
  },

  // ---------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------
  auth: {
    subtitle: 'Your family budget',
    checkEmail: 'Check your email',
    confirmationSent: 'We sent a confirmation link to',
    clickToActivate: '. Click the link to activate your account.',
    backToLogin: 'Back to sign in',
    name: 'Name',
    namePlaceholder: 'Your name',
    email: 'Email',
    emailPlaceholder: 'email@example.com',
    password: 'Password',
    signIn: 'Sign in',
    createAccount: 'Create account',
    noAccount: "Don't have an account?",
    hasAccount: 'Already have an account?',
    signUp: 'Sign up',
    logIn: 'Sign in',
    errors: {
      INVALID_CREDENTIALS: 'Incorrect email or password.',
      USER_EXISTS: 'An account with that email already exists.',
      NETWORK_ERROR: 'No connection. Try again.',
      UNKNOWN: 'Unexpected error. Try again.',
    },
  },

  // ---------------------------------------------------------------------------
  // Onboarding
  // ---------------------------------------------------------------------------
  onboarding: {
    title: 'Set up your household',
    greeting: 'Hi',
    subtitle: '. Before continuing, create a household or join an existing one.',
    createNew: 'Create a new household',
    joinExisting: 'Join an existing household',
    householdName: 'Household name',
    householdPlaceholder: "E.g.: Garcia's Home",
    errorCreating: 'Error creating household',
    invalidCode: 'Invalid code. Try again.',
    createdSuccess: 'Household created! Invite code:',
    shareCode: 'Share it with your family. Redirecting...',
    createHousehold: 'Create household',
    inviteCode: 'Invite code',
    askForCode: 'Ask the household admin for the 6-digit code',
    joining: 'Joining...',
    join: 'Join',
  },

  // ---------------------------------------------------------------------------
  // Join page
  // ---------------------------------------------------------------------------
  join: {
    noCode: 'No invite code was provided.',
    invalidCode: 'Invalid or expired code.',
    joiningHousehold: 'Joining household...',
    joinedSuccess: 'You joined the household!',
    redirecting: 'Redirecting...',
    alreadyInHousehold: 'You already belong to a household',
    cannotJoinAnother: 'You cannot join another household.',
    goHome: 'Go to home',
    couldNotJoin: 'Could not join',
    goToOnboarding: 'Go to onboarding',
  },

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------
  nav: {
    dashboard: 'Dashboard',
    budget: 'Budget',
    finances: 'Finances',
    profile: 'Profile',
  },

  // ---------------------------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------------------------
  dashboard: {
    realBalance: 'Real balance',
    available: 'Available',
    budgeted: 'Budgeted',
    spent: 'Spent',
    toSpend: 'To spend',
    totalOwed: 'Total owed',
    trend6m: 'Last 6 months trend',
    budgetedVsSpent: 'Budgeted vs. actual spending',
    budgetedLabel: 'Budgeted',
    spentLabel: 'Spent',
    balanceOverTime: 'Real balance month by month',
    availableMinusBudgeted: 'Available − Budgeted (cash)',
    spendByCategory: 'Spending by category',
    distributionThisMonth: 'Distribution this month',
    noDataThisMonth: 'No data this month',
    noExpensesRecorded: 'No expenses recorded',
    cardVsCash: 'Card vs. Cash',
    paymentTypeDistribution: 'Distribution by payment type',
    card: 'Card',
    cash: 'Cash',
    topBudgets: 'Top budgets this month',
    executionLabel: 'Execution: spent over budgeted',
    exceededBudgets: 'Exceeded budgets',
    exceededDesc: (n: number) => `Budgets exceeded in the last 6 months (${n} occurrence${n !== 1 ? 's' : ''})`,
    budgetedShort: 'Budget',
    spentShort: 'Spent',
    recentExpenses: 'Recent expenses',
    recentExpensesDesc: 'Latest recorded transactions',
    debtProgress: 'Debt progress',
    debtProgressDesc: 'Pending balance per debt',
    pctPaid: '% paid',
    debtEvolution: 'Debt evolution',
    debtEvolutionDesc: 'Total debt balance over the last 6 months',
    debtBalanceLabel: 'Debt balance',
    restaurantsThisMonth: 'Delivery this month',
    restaurantsDailySpend: 'Daily delivery spending',
    dayLabel: (d: string) => `Day ${d}`,
    groceriesThisMonth: 'Groceries this month',
    groceriesDailySpend: 'Daily grocery spending',
    burnUpIdeal: 'Ideal pace',
    burnUpPrevMonth: 'Prev. month',
    burnUpCurrent: 'Cumulative',
    burnUpToday: 'Today',
    burnUpDomiciliosTitle: '🛵 Delivery',
    burnUpDomiciliosDesc: 'Cumulative spend vs ideal pace',
    burnUpMercadoTitle: '🛒 Groceries',
    burnUpMercadoDesc: 'Cumulative spend vs ideal pace',
    burnUpSaludTitle: '💊 Health',
    burnUpSaludDesc: 'Cumulative spend vs ideal pace',
    noDataYet: 'No data yet',
    addBudgetsAndIncome: 'Add budgets and income to see your stats',
  },

  // ---------------------------------------------------------------------------
  // Month View
  // ---------------------------------------------------------------------------
  monthView: {
    title: 'Monthly View',
    unmarkExecuted: 'Unmark as executed',
    markExecuted: 'Mark as executed',
    budgetLabel: 'Budget',
    spentLabel: 'Spent',
    remainingLabel: 'Remaining',
    viewOrAddExpenses: 'View or record expenses',
    noBudgets: 'No active budgets',
    addBudgetsHint: 'Add budgets from the Budgets section',
    creditCard: 'Credit Card',
    cashLabel: 'Cash',
    incomeLabel: 'Income',
    noTrm: 'No TRM',
    fixed: 'Fixed',
    variable: 'Variable',
    edited: 'edited',
    balanceReal: 'Real balance',
    availableLabel: 'Available',
    budgetedLabel: 'Budgeted',
    executedLabel: 'Spent',
    toExecuteLabel: 'To spend',
    availableMinusBudgeted: 'Available − Budgeted',
    usdExcludedNoTrm: 'USD income excluded — enter TRM in the Income section',
    prevMonth: 'Previous month',
    nextMonth: 'Next month',
  },

  // ---------------------------------------------------------------------------
  // Year View
  // ---------------------------------------------------------------------------
  yearView: {
    title: 'Yearly View',
    budgetYear: (year: number) => `Budget ${year}`,
    itemHeader: 'Item',
    budgetedRow: 'Budgeted',
    executedRow: 'Spent',
    toExecuteRow: 'To spend',
    creditCardGroup: 'Credit Card',
    cashGroup: 'Cash',
    availableRow: 'Available',
    totalBudgetedRow: 'Total budgeted',
    realBalanceRow: 'Real balance',
    noItems: 'No budget items.',
    addFromSettings: 'Add budgets from Settings.',
    executedHint: 'Executed ✓ — right-click to unmark',
    editHint: 'Click to edit · right-click to mark executed',
    viewExpenses: 'View / record expenses',
  },

  // ---------------------------------------------------------------------------
  // Budget Management
  // ---------------------------------------------------------------------------
  budgets: {
    title: 'Budgets',
    subtitle: 'Manage your spending categories',
    newBudget: 'New budget',
    editBudget: 'Edit budget',
    nameLabel: 'Name *',
    namePlaceholder: 'E.g.: Netflix, Rent',
    descriptionLabel: 'Description (optional)',
    descriptionPlaceholder: 'Additional note',
    categoryLabel: 'Category',
    categoryPlaceholder: 'Select a category',
    amountLabel: 'Default monthly amount (COP)',
    startMonth: 'Start month',
    endMonth: 'End month',
    removeEndDate: 'Remove end date',
    paymentMethod: 'Payment method',
    cashMethod: 'Cash',
    cardMethod: 'Card',
    linkDebt: 'Link to debt (optional)',
    noLink: '— No link —',
    debtLinkHint: 'When recording an expense here, it will automatically debit the linked debt.',
    validationAmount: 'Amount must be a valid COP number',
    validationName: 'Name is required',
    validationEndMonth: 'End month must be equal to or after start month',
    noBudgets: 'No budgets yet',
    createFirst: 'Create the first one with the "New" button',
    creditCardGroup: 'Credit Card',
    cashGroup: 'Cash',
    noCardItems: 'No card items',
    noCashItems: 'No cash items',
    confirmDelete: (name: string) => `Delete "${name}"? Historical data will be preserved.`,
  },

  // ---------------------------------------------------------------------------
  // Budget Hub
  // ---------------------------------------------------------------------------
  budgetHub: {
    title: 'Budget',
    subtitle: 'Choose your view',
    description: 'Two ways to view your budget. Choose the one that best fits what you need right now.',
    monthlyTitle: 'Monthly View',
    monthlyDesc: 'Review and record monthly expenses. Cards per budget with real execution and access to each expense.',
    yearlyTitle: 'Yearly View',
    yearlyDesc: 'Spreadsheet of all 12 months. Edit budgets by month, see totals and real balance for the full year.',
  },

  // ---------------------------------------------------------------------------
  // Expenses
  // ---------------------------------------------------------------------------
  expenses: {
    budgetLabel: 'Budget',
    spentLabel: 'Spent',
    remainingLabel: 'Remaining',
    recordedExpenses: 'Recorded expenses',
    noExpensesThisMonth: 'No expenses this month',
    deleteExpense: 'Delete expense',
    quickPayFull: 'Full payment',
    today: 'today',
    amountLabel: 'Amount (COP) *',
    dateLabel: 'Date',
    noteLabel: 'Note (optional)',
    notePlaceholder: 'Short description',
    validationAmount: 'Enter a valid amount greater than 0',
    closeButton: 'Close',
    submitButton: 'Record',
    ctrlEnterHint: 'Ctrl+↵ keep open',
  },

  // ---------------------------------------------------------------------------
  // Income
  // ---------------------------------------------------------------------------
  income: {
    title: 'Income',
    categories: {
      Salario: 'Salary',
      Renta: 'Rent',
      Otro: 'Other',
    },
    newIncome: 'New income source',
    editIncome: 'Edit income',
    nameLabel: 'Name *',
    namePlaceholder: 'E.g.: Salary',
    categoryLabel: 'Category',
    defaultAmount: 'Default amount',
    currencyLabel: 'Currency',
    startMonth: 'Start month',
    endMonth: 'End month',
    removeEndDate: 'Remove end date',
    typeLabel: 'Type:',
    fixed: 'Fixed',
    variable: 'Variable',
    validationName: 'Name is required',
    validationAmount: 'Invalid amount',
    // TRM section
    trmTitle: 'TRM · USD → COP',
    trmEstimated: 'Estimated',
    noTrm: 'No TRM — USD income is not converted',
    trmEdit: 'Edit',
    trmEnter: 'Enter',
    // Salary dialog
    salaryBreakdown: (name: string) => `Salary breakdown — ${name}`,
    noTrmForMonth: (month: string) => `No TRM for ${month} — enter TRM first`,
    baseSalary: 'Base salary',
    deductions: 'Deductions',
    extraDays: 'Extra days',
    extraDaysFormula: 'days · (base × 12/260)',
    monthTotal: 'Month total',
    noTrmConversion: 'No TRM — conversion unavailable',
    validationBaseSalary: 'Base salary must be greater than 0',
    validationTrmRequired: 'Enter the TRM for this month before saving a USD salary',
    // Income card
    edited: 'edited',
    noTrmCannotConvert: 'No TRM — cannot convert',
    clickSalaryBreakdown: 'Click to break down this month\'s salary',
    clickEditAmount: 'Click to edit this month\'s amount',
    // Page
    availableForMonth: (month: string) => `Available ${month}`,
    usdExcludedNoTrm: 'USD income excluded — TRM missing',
    noIncomeSources: 'No income sources',
    addFirstHint: 'Add the first one with the "New" button',
    confirmDelete: (name: string) => `Delete "${name}"?`,
  },

  // ---------------------------------------------------------------------------
  // Debts
  // ---------------------------------------------------------------------------
  debts: {
    title: 'Debts',
    subtitle: 'Track your financial obligations',
    newDebt: 'New debt',
    editDebt: 'Edit debt',
    nameLabel: 'Name *',
    namePlaceholder: 'E.g.: Bank loan, Family loan',
    descriptionLabel: 'Description (optional)',
    descriptionPlaceholder: 'Additional note',
    originalAmount: 'Original amount *',
    currencyLabel: 'Currency',
    disbursedAt: 'Disbursement date *',
    validationAmount: 'Initial amount must be greater than 0',
    validationName: 'Name is required',
    validationDate: 'Disbursement date is required',
    // Transaction dialog
    registerTransaction: 'Record transaction',
    typeLabel: 'Type',
    payment: '↓ Payment',
    increase: '↑ Increase',
    amountLabel: 'Amount *',
    trmLabel: 'TRM (USD → COP) *',
    dateLabel: 'Date',
    noteLabel: 'Note (optional)',
    notePlaceholder: 'Short description',
    validationTxAmount: 'Amount must be greater than 0',
    validationTrmRequired: 'Enter a valid TRM to convert USD to COP',
    // Debt card
    paidOff: '✓ Paid off',
    since: (date: string) => `Since ${date}`,
    originalLabel: 'Original',
    pendingBalance: 'Pending balance',
    pctPaid: (pct: number) => `${pct}% paid`,
    paidOf: (paid: string, total: string) => `${paid} paid of ${total}`,
    transactions: (n: number) => `${n} transaction${n !== 1 ? 's' : ''}`,
    addTransaction: 'Add transaction',
    noTransactions: 'No transactions yet',
    fromExpense: 'From expense',
    // Page KPIs
    totalOwed: 'Total owed',
    activeDebts: 'Active debts',
    ofTotal: (total: number) => `of ${total} total`,
    noDebts: 'No debts recorded',
    noDebtsHint: 'Record your financial obligations with the "New debt" button',
    confirmDelete: (name: string) => `Delete "${name}"? Transaction history will be preserved.`,
  },

  // ---------------------------------------------------------------------------
  // Finances Hub
  // ---------------------------------------------------------------------------
  finances: {
    title: 'Finances',
    subtitle: 'Income · Budgets · Debts',
    description: 'Set up and manage the financial side of your household: where the money comes from and how you organize it.',
    incomeTitle: 'Income',
    incomeDesc: 'Manage your household income sources. Supports COP and USD salaries with automatic TRM conversion.',
    budgetsTitle: 'Budgets',
    budgetsDesc: 'Define and manage your household spending categories. Create, edit, and organize by payment type.',
    debtsTitle: 'Debts',
    debtsDesc: 'Track your debts. Link budgets for automatic payments.',
  },

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------
  settings: {
    profileTitle: 'Profile',
    householdTitle: 'Household',
    householdNameLabel: 'Household name',
    joinCodeLabel: 'Join code',
    shareText: (joinCode: string) => `Join our household on LittleFlower. Your code: ${joinCode}`,
    linkCopied: 'Link copied!',
    inviteFamily: 'Invite a family member',
    defaultHousehold: 'My household',
    // Appearance
    appearanceTitle: 'Appearance',
    themeLabel: 'Theme',
    themeDescription: 'Choose between light, dark, or auto mode based on your system',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeAuto: 'Auto',
    themeLightDesc: 'Always light mode',
    themeDarkDesc: 'Always dark mode',
    themeAutoDesc: 'Follow system',
    // Language
    languageTitle: 'Language',
    languageLabel: 'App language',
    languageDescription: 'Change the language of the entire interface',
    // Numbers
    numbersTitle: 'Numbers',
    numberFormatLabel: 'Amount format',
    numberFormatDescription: 'Affects all displayed values (not input fields)',
    abbreviated: 'Abbreviated',
    abbreviatedDesc: 'Compact, great for the spreadsheet',
    full: 'Full',
    fullDesc: 'Exact amount in pesos',
    // Session
    sessionTitle: 'Session',
    signOut: 'Sign out',
  },

  // ---------------------------------------------------------------------------
  // Landing page
  // ---------------------------------------------------------------------------
  landing: {
    pill: 'For Colombian couples',
    heroTitle1: 'Your budget',
    heroTitle2: 'always in order.',
    heroDesc: 'LittleFlower is the family budget app for couples. Plan, track expenses, and analyze your finances — in Colombian pesos, with support for dollar income.',
    startFree: 'Start free',
    signIn: 'Sign in',
    socialProof: 'Free · No credit card · Full privacy',
    featuresTitle: 'Everything you need to manage your money',
    featuresSubtitle: 'No complications, no subscriptions, no third-party cloud data.',
    feature1Title: 'See where you spend',
    feature1Desc: 'Dashboard with category charts, monthly trends, and budget vs. actual spending comparisons.',
    feature2Title: 'Always in sync',
    feature2Desc: 'Works offline. Your data is stored locally and syncs in the background when connected.',
    feature3Title: 'Made for two',
    feature3Desc: 'Share your household with your partner. Both of you see and edit the same budget in real time.',
    feature4Title: 'USD and COP hassle-free',
    feature4Desc: 'Record income in dollars. The exchange rate is automatically applied to convert everything to Colombian pesos.',
    feature5Title: 'Yearly and monthly views',
    feature5Desc: 'Plan the whole year in the yearly spreadsheet, or focus on the month with the detailed card view.',
    feature6Title: 'Your data, your control',
    feature6Desc: 'Local-first architecture: your finances live on your device. No third-party access to your information.',
    ctaTitle: 'Start today, for free.',
    ctaDesc: 'Invite your family, set up your household in minutes, and take control of your finances together.',
    ctaButton: 'Create my free account',
    footer: 'Made with love for Colombian couples',
    // Preview mock
    previewDashboard: 'Dashboard',
    previewMonth: 'February 2026',
    previewBalance: 'Balance',
    previewAvailable: 'Available',
    previewBudgeted: 'Budgeted',
    previewSpent: 'Spent',
    previewTrend: '6-month trend',
    previewCategory: 'Spending by category',
    previewSynced: 'Synced',
    previewOffline: 'Works offline',
  },

  // ---------------------------------------------------------------------------
  // Sync
  // ---------------------------------------------------------------------------
  sync: {
    offline: 'Offline',
    error: 'Sync error',
    uploading: (n: number) => n > 0 ? `Uploading (${n})` : 'Uploading...',
    pending: (n: number) => `${n} pending`,
    synced: 'Sync',
    syncErrorTitle: 'Sync error:',
    syncErrorBody: 'recent changes are not being saved to the server. Avoid entering new data until this is resolved. If the problem persists, reload the page or check your connection.',
  },

  // ---------------------------------------------------------------------------
  // AppShell (legacy)
  // ---------------------------------------------------------------------------
  appShell: {
    synced: 'Synced',
    offline: 'Offline',
    signOut: 'Sign out',
    availableIncome: 'Available income',
    totalBudgeted: 'Total budgeted',
    budgetBalance: 'Budget balance',
    realBalance: 'Real balance',
    creditCardGroup: 'Credit Card',
    cashGroup: 'Cash',
    itemHeader: 'Item',
    budgetHeader: 'Budget',
    executedHeader: 'Spent',
    pendingHeader: 'Pending',
    noItems: 'No budget items yet.',
    addFromSettings: 'Add budgets from settings.',
    noTrmWarning: (month: string) => `No TRM registered for ${month}. USD income is not included in calculations.`,
  },
};
