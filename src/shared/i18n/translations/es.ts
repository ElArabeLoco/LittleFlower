/**
 * Spanish translations — source of truth for translation keys.
 * All other locale files must match this shape exactly.
 */
export const es = {
  // ---------------------------------------------------------------------------
  // Common
  // ---------------------------------------------------------------------------
  common: {
    cancel: 'Cancelar',
    save: 'Guardar',
    saving: 'Guardando...',
    create: 'Crear',
    creating: 'Creando...',
    delete: 'Eliminar',
    edit: 'Editar',
    back: 'Atrás',
    close: 'Cerrar',
    loading: 'Cargando...',
    unexpectedError: 'Error inesperado',
    new: 'Nuevo',
    optional: '(opcional)',
    from: 'desde',
    register: 'Registrar',
    registering: 'Registrando...',
  },

  // ---------------------------------------------------------------------------
  // Month names
  // ---------------------------------------------------------------------------
  months: {
    short: {
      '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr',
      '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago',
      '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic',
    } as Record<string, string>,
    shortLower: {
      '01': 'ene', '02': 'feb', '03': 'mar', '04': 'abr',
      '05': 'may', '06': 'jun', '07': 'jul', '08': 'ago',
      '09': 'sep', '10': 'oct', '11': 'nov', '12': 'dic',
    } as Record<string, string>,
    full: {
      '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
      '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
      '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre',
    } as Record<string, string>,
  },

  // ---------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------
  auth: {
    subtitle: 'Tu presupuesto familiar',
    checkEmail: 'Revisa tu correo',
    confirmationSent: 'Enviamos un enlace de confirmación a',
    clickToActivate: '. Haz clic en el enlace para activar tu cuenta.',
    backToLogin: 'Volver a iniciar sesión',
    name: 'Nombre',
    namePlaceholder: 'Tu nombre',
    email: 'Correo',
    emailPlaceholder: 'correo@ejemplo.com',
    password: 'Contraseña',
    signIn: 'Iniciar sesión',
    createAccount: 'Crear cuenta',
    noAccount: '¿No tienes cuenta?',
    hasAccount: '¿Ya tienes cuenta?',
    signUp: 'Regístrate',
    logIn: 'Inicia sesión',
    errors: {
      INVALID_CREDENTIALS: 'Correo o contraseña incorrectos.',
      USER_EXISTS: 'Ya existe una cuenta con ese correo.',
      NETWORK_ERROR: 'Sin conexión. Intenta de nuevo.',
      UNKNOWN: 'Error inesperado. Intenta de nuevo.',
    } as Record<string, string>,
  },

  // ---------------------------------------------------------------------------
  // Onboarding
  // ---------------------------------------------------------------------------
  onboarding: {
    title: 'Configura tu hogar',
    greeting: 'Hola',
    subtitle: '. Antes de continuar, crea un hogar o únete a uno existente.',
    createNew: 'Crear un hogar nuevo',
    joinExisting: 'Unirme a un hogar existente',
    householdName: 'Nombre del hogar',
    householdPlaceholder: 'Ej: Casa García',
    errorCreating: 'Error al crear el hogar',
    invalidCode: 'Código inválido. Intenta de nuevo.',
    createdSuccess: '¡Hogar creado! Código para invitar:',
    shareCode: 'Compártelo con tu familia. Redirigiendo...',
    createHousehold: 'Crear hogar',
    inviteCode: 'Código de invitación',
    askForCode: 'Pídele el código de 6 dígitos al administrador del hogar',
    joining: 'Uniéndome...',
    join: 'Unirme',
  },

  // ---------------------------------------------------------------------------
  // Join page
  // ---------------------------------------------------------------------------
  join: {
    noCode: 'No se proporcionó un código de invitación.',
    invalidCode: 'Código inválido o expirado.',
    joiningHousehold: 'Uniéndote al hogar...',
    joinedSuccess: '¡Te uniste al hogar!',
    redirecting: 'Redirigiendo...',
    alreadyInHousehold: 'Ya perteneces a un hogar',
    cannotJoinAnother: 'No puedes unirte a otro hogar.',
    goHome: 'Ir al inicio',
    couldNotJoin: 'No se pudo unir',
    goToOnboarding: 'Ir al onboarding',
  },

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------
  nav: {
    dashboard: 'Dashboard',
    budget: 'Presupuesto',
    finances: 'Finanzas',
    profile: 'Perfil',
  },

  // ---------------------------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------------------------
  dashboard: {
    realBalance: 'Balance real',
    available: 'Disponible',
    budgeted: 'Presupuestado',
    spent: 'Ejecutado',
    toSpend: 'Por ejecutar',
    totalOwed: 'Total adeudado',
    trend6m: 'Tendencia de los últimos 6 meses',
    budgetedVsSpent: 'Presupuestado vs. gastado real',
    budgetedLabel: 'Presupuestado',
    spentLabel: 'Gastado',
    balanceOverTime: 'Balance real mes a mes',
    availableMinusBudgeted: 'Disponible − Presupuestado (efectivo)',
    spendByCategory: 'Gasto por categoría',
    distributionThisMonth: 'Distribución este mes',
    noDataThisMonth: 'Sin datos este mes',
    noExpensesRecorded: 'Sin gastos registrados',
    cardVsCash: 'Tarjeta vs. Efectivo',
    paymentTypeDistribution: 'Distribución por tipo de pago',
    card: 'Tarjeta',
    cash: 'Efectivo',
    topBudgets: 'Top presupuestos este mes',
    executionLabel: 'Ejecución: gastado sobre presupuestado',
    exceededBudgets: 'Rubros excedidos',
    exceededDesc: (n: number) => `Presupuestos superados en los últimos 6 meses (${n} ocurrencia${n !== 1 ? 's' : ''})`,
    budgetedShort: 'Presup.',
    spentShort: 'Gastado',
    recentExpenses: 'Gastos recientes',
    recentExpensesDesc: 'Últimas transacciones registradas',
    debtProgress: 'Progreso de deudas',
    debtProgressDesc: 'Saldo pendiente por deuda',
    pctPaid: '% pagado',
    debtEvolution: 'Evolución de deudas',
    debtEvolutionDesc: 'Saldo total de deudas en los últimos 6 meses',
    debtBalanceLabel: 'Saldo deudas',
    restaurantsThisMonth: 'Domicilios este mes',
    restaurantsDailySpend: 'Gasto diario en domicilios',
    dayLabel: (d: string) => `Día ${d}`,
    groceriesThisMonth: 'Groceries este mes',
    groceriesDailySpend: 'Gasto diario en supermercado',
    burnUpIdeal: 'Ritmo ideal',
    burnUpPrevMonth: 'Mes anterior',
    burnUpCurrent: 'Acumulado',
    burnUpToday: 'Hoy',
    burnUpDomiciliosTitle: 'Domicilios',
    burnUpDomiciliosDesc: 'Gasto acumulado vs ritmo ideal',
    burnUpMercadoTitle: 'Mercado',
    burnUpMercadoDesc: 'Gasto acumulado vs ritmo ideal',
    burnUpSaludTitle: 'Cosas de Salud',
    burnUpSaludDesc: 'Gasto acumulado vs ritmo ideal',
    burnUpCreditCardTitle: '💳 Tarjeta de Crédito',
    burnUpCreditCardDesc: 'Total gastos en presupuestos de tarjeta vs ritmo ideal',
    noDataYet: 'Aún no hay datos',
    addBudgetsAndIncome: 'Agrega presupuestos e ingresos para ver tus estadísticas',
  },

  // ---------------------------------------------------------------------------
  // Month View
  // ---------------------------------------------------------------------------
  monthView: {
    title: 'Vista Mensual',
    unmarkExecuted: 'Desmarcar como ejecutado',
    markExecuted: 'Marcar como ejecutado',
    budgetLabel: 'Presupuesto',
    spentLabel: 'Gastado',
    remainingLabel: 'Restante',
    viewOrAddExpenses: 'Ver o registrar gastos',
    noBudgets: 'Sin presupuestos activos',
    addBudgetsHint: 'Agrega presupuestos desde la sección Presupuestos',
    creditCard: 'Tarjeta de Crédito',
    cashLabel: 'Efectivo',
    incomeLabel: 'Ingresos',
    noTrm: 'Sin TRM',
    fixed: 'Fijo',
    variable: 'Variable',
    edited: 'editado',
    balanceReal: 'Balance real',
    availableLabel: 'Disponible',
    budgetedLabel: 'Presupuest.',
    executedLabel: 'Ejecutado',
    toExecuteLabel: 'Por ejecutar',
    availableMinusBudgeted: 'Disponible − Presupuestado',
    usdExcludedNoTrm: 'Ingresos USD excluidos — ingresa la TRM en la sección Ingresos',
    prevMonth: 'Mes anterior',
    nextMonth: 'Mes siguiente',
  },

  // ---------------------------------------------------------------------------
  // Year View
  // ---------------------------------------------------------------------------
  yearView: {
    title: 'Vista Anual',
    budgetYear: (year: number) => `Presupuesto ${year}`,
    itemHeader: 'Rubro',
    budgetedRow: 'Presupuestado',
    executedRow: 'Ejecutado',
    toExecuteRow: 'Por ejecutar',
    creditCardGroup: 'Tarjeta de Crédito',
    cashGroup: 'Efectivo',
    availableRow: 'Disponible',
    totalBudgetedRow: 'Total presupuestado',
    realBalanceRow: 'Balance real',
    noItems: 'No hay ítems de presupuesto.',
    addFromSettings: 'Agrega presupuestos desde Configuración.',
    executedHint: 'Ejecutado ✓ — clic derecho para desmarcar',
    editHint: 'Clic para editar · clic derecho para marcar ejecutado',
    viewExpenses: 'Ver / registrar gastos',
  },

  // ---------------------------------------------------------------------------
  // Budget Management
  // ---------------------------------------------------------------------------
  budgets: {
    title: 'Presupuestos',
    subtitle: 'Gestiona tus categorías de gasto',
    newBudget: 'Nuevo presupuesto',
    editBudget: 'Editar presupuesto',
    nameLabel: 'Nombre *',
    namePlaceholder: 'Ej: Netflix, Cuota apartamento',
    descriptionLabel: 'Descripción (opcional)',
    descriptionPlaceholder: 'Nota adicional',
    categoryLabel: 'Categoría',
    categoryPlaceholder: 'Selecciona una categoría',
    amountLabel: 'Monto mensual por defecto (COP)',
    startMonth: 'Mes de inicio',
    endMonth: 'Mes de fin',
    removeEndDate: 'Quitar fecha de fin',
    paymentMethod: 'Forma de pago',
    cashMethod: 'Efectivo',
    cardMethod: 'Tarjeta',
    linkDebt: 'Vincular a deuda (opcional)',
    noLink: '— Sin vincular —',
    debtLinkHint: 'Al registrar un gasto aquí, se abona automáticamente a la deuda vinculada.',
    validationAmount: 'El monto debe ser un número válido en COP',
    validationName: 'El nombre es obligatorio',
    validationEndMonth: 'El mes de fin debe ser igual o posterior al mes de inicio',
    noBudgets: 'Sin presupuestos aún',
    createFirst: 'Crea el primero con el botón "Nuevo"',
    creditCardGroup: 'Tarjeta de Crédito',
    cashGroup: 'Efectivo',
    noCardItems: 'Sin ítems de tarjeta',
    noCashItems: 'Sin ítems de efectivo',
    confirmDelete: (name: string) => `¿Eliminar "${name}"? Los datos históricos se conservan.`,
  },

  // ---------------------------------------------------------------------------
  // Budget Hub
  // ---------------------------------------------------------------------------
  budgetHub: {
    title: 'Presupuesto',
    subtitle: 'Elige tu vista',
    description: 'Dos formas de ver tu presupuesto. Escoge la que mejor se adapte a lo que necesitas ahora.',
    monthlyTitle: 'Vista Mensual',
    monthlyDesc: 'Revisa y registra gastos del mes. Tarjetas por presupuesto con ejecución real y acceso a cada gasto.',
    yearlyTitle: 'Vista Anual',
    yearlyDesc: 'Spreadsheet de los 12 meses. Edita presupuestos por mes, ve totales y balance real del año completo.',
  },

  // ---------------------------------------------------------------------------
  // Expenses
  // ---------------------------------------------------------------------------
  expenses: {
    budgetLabel: 'Presupuesto',
    spentLabel: 'Gastado',
    remainingLabel: 'Restante',
    recordedExpenses: 'Gastos registrados',
    noExpensesThisMonth: 'Sin gastos este mes',
    deleteExpense: 'Eliminar gasto',
    quickPayFull: 'Pago completo',
    today: 'hoy',
    amountLabel: 'Monto (COP) *',
    dateLabel: 'Fecha',
    noteLabel: 'Nota (opcional)',
    notePlaceholder: 'Descripción breve',
    validationAmount: 'Ingresa un monto válido mayor a 0',
    closeButton: 'Cerrar',
    submitButton: 'Registrar',
    ctrlEnterHint: 'Ctrl+↵ sin cerrar',
  },

  // ---------------------------------------------------------------------------
  // Income
  // ---------------------------------------------------------------------------
  income: {
    title: 'Ingresos',
    categories: {
      Salario: 'Salario',
      Renta: 'Renta',
      Otro: 'Otro',
    } as Record<string, string>,
    newIncome: 'Nueva fuente de ingreso',
    editIncome: 'Editar ingreso',
    nameLabel: 'Nombre *',
    namePlaceholder: 'Ej: Salario Jaime',
    categoryLabel: 'Categoría',
    defaultAmount: 'Monto por defecto',
    currencyLabel: 'Moneda',
    startMonth: 'Mes de inicio',
    endMonth: 'Mes de fin',
    removeEndDate: 'Quitar fecha de fin',
    typeLabel: 'Tipo:',
    fixed: 'Fijo',
    variable: 'Variable',
    validationName: 'El nombre es obligatorio',
    validationAmount: 'Monto inválido',
    // TRM section
    trmTitle: 'TRM · USD → COP',
    trmEstimated: 'Estimado',
    noTrm: 'Sin TRM — los ingresos USD no se convierten',
    trmEdit: 'Editar',
    trmEnter: 'Ingresar',
    // Salary dialog
    salaryBreakdown: (name: string) => `Desglose salarial — ${name}`,
    noTrmForMonth: (month: string) => `Sin TRM para ${month} — ingresa la TRM primero`,
    baseSalary: 'Salario base',
    deductions: 'Deducciones',
    extraDays: 'Días extra',
    extraDaysFormula: 'días · (base × 12/260)',
    monthTotal: 'Total del mes',
    noTrmConversion: 'Sin TRM — conversión no disponible',
    validationBaseSalary: 'El salario base debe ser mayor a 0',
    validationTrmRequired: 'Ingresa la TRM del mes antes de guardar un salario en USD',
    // Income card
    edited: 'editado',
    noTrmCannotConvert: 'Sin TRM — no se puede convertir',
    clickSalaryBreakdown: 'Clic para desglosar el salario de este mes',
    clickEditAmount: 'Clic para editar el monto de este mes',
    // Page
    availableForMonth: (month: string) => `Disponible ${month}`,
    usdExcludedNoTrm: 'Ingresos USD excluidos — falta TRM',
    noIncomeSources: 'Sin fuentes de ingreso',
    addFirstHint: 'Agrega la primera con el botón "Nuevo"',
    confirmDelete: (name: string) => `¿Eliminar "${name}"?`,
  },

  // ---------------------------------------------------------------------------
  // Debts
  // ---------------------------------------------------------------------------
  debts: {
    title: 'Deudas',
    subtitle: 'Seguimiento de tus obligaciones financieras',
    newDebt: 'Nueva deuda',
    editDebt: 'Editar deuda',
    nameLabel: 'Nombre *',
    namePlaceholder: 'Ej: Banco Bogotá, Préstamo familiar',
    descriptionLabel: 'Descripción (opcional)',
    descriptionPlaceholder: 'Nota adicional',
    originalAmount: 'Monto original *',
    currencyLabel: 'Moneda',
    disbursedAt: 'Fecha de desembolso *',
    validationAmount: 'El monto inicial debe ser mayor a 0',
    validationName: 'El nombre es obligatorio',
    validationDate: 'La fecha de desembolso es obligatoria',
    // Transaction dialog
    registerTransaction: 'Registrar transacción',
    typeLabel: 'Tipo',
    payment: '↓ Abono',
    increase: '↑ Aumento',
    amountLabel: 'Monto *',
    trmLabel: 'TRM (USD → COP) *',
    dateLabel: 'Fecha',
    noteLabel: 'Nota (opcional)',
    notePlaceholder: 'Descripción breve',
    validationTxAmount: 'El monto debe ser mayor a 0',
    validationTrmRequired: 'Ingresa una TRM válida para convertir USD a COP',
    // Debt card
    paidOff: '✓ Saldada',
    since: (date: string) => `Desde ${date}`,
    originalLabel: 'Original',
    pendingBalance: 'Saldo pendiente',
    pctPaid: (pct: number) => `${pct}% pagado`,
    paidOf: (paid: string, total: string) => `${paid} abonado de ${total}`,
    transactions: (n: number) => `${n} transacción${n !== 1 ? 'es' : ''}`,
    addTransaction: 'Agregar transacción',
    noTransactions: 'Sin transacciones aún',
    fromExpense: 'Desde gasto',
    // Page KPIs
    totalOwed: 'Total adeudado',
    activeDebts: 'Deudas activas',
    ofTotal: (total: number) => `de ${total} total`,
    noDebts: 'Sin deudas registradas',
    noDebtsHint: 'Registra tus obligaciones financieras con el botón "Nueva deuda"',
    confirmDelete: (name: string) => `¿Eliminar "${name}"? El historial de transacciones se conservará.`,
  },

  // ---------------------------------------------------------------------------
  // Finances Hub
  // ---------------------------------------------------------------------------
  finances: {
    title: 'Finanzas',
    subtitle: 'Ingresos · Presupuestos · Deudas',
    description: 'Configura y gestiona el lado financiero del hogar: de dónde viene la plata y cómo la organizas.',
    incomeTitle: 'Ingresos',
    incomeDesc: 'Gestiona las fuentes de ingreso del hogar. Soporta salarios en COP y USD con conversión TRM automática.',
    budgetsTitle: 'Presupuestos',
    budgetsDesc: 'Define y gestiona las categorías de gasto del hogar. Crea, edita y organiza por tipo de pago.',
    debtsTitle: 'Deudas',
    debtsDesc: 'Registra y haz seguimiento de tus deudas. Vincula presupuestos para abonos automáticos.',
  },

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------
  settings: {
    profileTitle: 'Perfil',
    householdTitle: 'Hogar',
    householdNameLabel: 'Nombre del hogar',
    joinCodeLabel: 'Código de unión',
    shareText: (joinCode: string) => `Únete a nuestro hogar en LittleFlower. Tu código: ${joinCode}`,
    linkCopied: '¡Enlace copiado!',
    inviteFamily: 'Invitar a un familiar',
    defaultHousehold: 'Mi hogar',
    // Appearance
    appearanceTitle: 'Apariencia',
    themeLabel: 'Tema',
    themeDescription: 'Elige entre modo claro, oscuro o automático según el sistema',
    themeLight: 'Claro',
    themeDark: 'Oscuro',
    themeAuto: 'Automático',
    themeLightDesc: 'Siempre modo claro',
    themeDarkDesc: 'Siempre modo oscuro',
    themeAutoDesc: 'Sigue el sistema',
    // Language
    languageTitle: 'Idioma',
    languageLabel: 'Idioma de la app',
    languageDescription: 'Cambia el idioma de toda la interfaz',
    // Numbers
    numbersTitle: 'Números',
    numberFormatLabel: 'Formato de montos',
    numberFormatDescription: 'Afecta todos los valores mostrados (no los campos de entrada)',
    abbreviated: 'Abreviado',
    abbreviatedDesc: 'Compacto, ideal para el spreadsheet',
    full: 'Completo',
    fullDesc: 'Cifra exacta en pesos',
    // Version
    versionTitle: 'Versión',
    // Session
    sessionTitle: 'Sesión',
    signOut: 'Cerrar sesión',
  },

  // ---------------------------------------------------------------------------
  // Landing page
  // ---------------------------------------------------------------------------
  landing: {
    pill: 'Para parejas colombianas',
    heroTitle1: 'Tu presupuesto',
    heroTitle2: 'siempre en orden.',
    heroDesc: 'LittleFlower es la app de presupuesto familiar para parejas. Planea, registra gastos y analiza tus finanzas — en pesos colombianos, con soporte para ingresos en dólares.',
    startFree: 'Empezar gratis',
    signIn: 'Iniciar sesión',
    socialProof: 'Gratis · Sin tarjeta de crédito · Privacidad total',
    featuresTitle: 'Todo lo que necesitas para controlar tu plata',
    featuresSubtitle: 'Sin complicaciones, sin suscripciones, sin datos en la nube de terceros.',
    feature1Title: 'Ve en qué gastas',
    feature1Desc: 'Dashboard con gráficas de categorías, tendencias mensuales y comparativas de presupuesto vs. gasto real.',
    feature2Title: 'Siempre sincronizado',
    feature2Desc: 'Funciona offline. Tus datos se guardan localmente y se sincronizan en segundo plano cuando hay conexión.',
    feature3Title: 'Hecho para dos',
    feature3Desc: 'Comparte el hogar con tu pareja. Los dos ven y editan el mismo presupuesto en tiempo real.',
    feature4Title: 'USD y COP sin drama',
    feature4Desc: 'Registra ingresos en dólares. La TRM se aplica automáticamente para convertir todo a pesos colombianos.',
    feature5Title: 'Vista anual y mensual',
    feature5Desc: 'Planea el año entero en el spreadsheet anual, o enfócate en el mes con la vista de tarjetas detallada.',
    feature6Title: 'Tus datos, tu control',
    feature6Desc: 'Arquitectura local-first: tus finanzas viven en tu dispositivo. Sin acceso de terceros a tu información.',
    ctaTitle: 'Empieza hoy, gratis.',
    ctaDesc: 'Invita a tu familia, configura el hogar en minutos y toma el control de sus finanzas juntos.',
    ctaButton: 'Crear mi cuenta gratis',
    footer: 'Hecho con amor para parejas colombianas',
    // Preview mock
    previewDashboard: 'Dashboard',
    previewMonth: 'Febrero 2026',
    previewBalance: 'Balance',
    previewAvailable: 'Disponible',
    previewBudgeted: 'Presupuestado',
    previewSpent: 'Gastado',
    previewTrend: 'Tendencia 6 meses',
    previewCategory: 'Gasto por categoría',
    previewSynced: 'Sincronizado',
    previewOffline: 'Funciona offline',
  },

  // ---------------------------------------------------------------------------
  // Sync
  // ---------------------------------------------------------------------------
  sync: {
    offline: 'Sin conexión',
    error: 'Error sync',
    uploading: (n: number) => n > 0 ? `Subiendo (${n})` : 'Subiendo...',
    pending: (n: number) => `${n} pendiente${n !== 1 ? 's' : ''}`,
    synced: 'Sync',
    syncErrorTitle: 'Error de sincronización:',
    syncErrorBody: 'los cambios recientes no se están guardando en el servidor. Evita ingresar datos nuevos hasta que esto se resuelva. Si el problema persiste, recarga la página o verifica tu conexión.',
  },

  // ---------------------------------------------------------------------------
  // AppShell (legacy)
  // ---------------------------------------------------------------------------
  appShell: {
    synced: 'Sincronizado',
    offline: 'Sin conexión',
    signOut: 'Cerrar sesión',
    availableIncome: 'Ingresos disponibles',
    totalBudgeted: 'Total presupuestado',
    budgetBalance: 'Balance presupuestado',
    realBalance: 'Balance real',
    creditCardGroup: 'Tarjeta de Crédito',
    cashGroup: 'Efectivo',
    itemHeader: 'Ítem',
    budgetHeader: 'Presupuesto',
    executedHeader: 'Ejecutado',
    pendingHeader: 'Pendiente',
    noItems: 'No hay ítems de presupuesto aún.',
    addFromSettings: 'Agrega presupuestos desde la configuración.',
    noTrmWarning: (month: string) => `No hay TRM registrada para ${month}. Los ingresos en USD no se incluyen en los cálculos.`,
  },
} as const;

// Recursively widen string literals to `string` so other locales can provide
// different values while keeping function signatures intact.
type DeepStringify<T> =
  T extends (...args: infer A) => infer R ? (...args: A) => R :
  T extends Record<string, unknown> ? { [K in keyof T]: DeepStringify<T[K]> } :
  T extends string ? string :
  T;

export type Translations = DeepStringify<typeof es>;
