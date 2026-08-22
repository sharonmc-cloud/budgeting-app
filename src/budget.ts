export type BudgetInterpretation = 'remaining-month' | 'full-month'
export type RoundingPreference = 'exact' | 'down' | 'up'

export type BudgetConfiguration = {
  version: 1
  amountCents: number
  monthKey: string
  setupDate: string
  interpretation: BudgetInterpretation
  rounding: RoundingPreference
}

export type BudgetConfigurationHistory = Record<string, BudgetConfiguration[]>

export const budgetStorageKey = 'budgetConfigurations'

export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getMonthKey(date = new Date()) {
  return getLocalDateKey(date).slice(0, 7)
}

export function getMonthDetails(date = new Date()) {
  const totalDays = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  return {
    monthKey: getMonthKey(date),
    monthName: new Intl.DateTimeFormat(undefined, { month: 'long' }).format(date),
    totalDays,
    remainingDays: totalDays - date.getDate() + 1,
  }
}

export function parseMoneyToCents(value: string) {
  const normalized = value.trim().replace(/[$,\s]/g, '')
  if (!/^\d+(?:\.\d{0,2})?$/.test(normalized)) return null
  const [dollars, fraction = ''] = normalized.split('.')
  const cents = Number(dollars) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null
}

export function getPeriodDays(
  interpretation: BudgetInterpretation,
  date = new Date(),
) {
  const details = getMonthDetails(date)
  return interpretation === 'remaining-month'
    ? details.remainingDays
    : details.totalDays
}

export function getDailyAllocationCents(
  amountCents: number,
  days: number,
  rounding: RoundingPreference,
  dayNumber = 1,
) {
  if (days < 1 || dayNumber < 1 || dayNumber > days) return 0

  let normalAllocation: number
  if (rounding === 'down') normalAllocation = Math.floor(amountCents / days / 100) * 100
  else if (rounding === 'up') normalAllocation = Math.ceil(amountCents / days / 100) * 100
  else normalAllocation = Math.round(amountCents / days)

  return dayNumber === days
    ? amountCents - normalAllocation * (days - 1)
    : normalAllocation
}

export function getTodayAllocationCents(
  configuration: BudgetConfiguration,
  date = new Date(),
) {
  const setupDay = Number(configuration.setupDate.slice(-2))
  const totalDays = getMonthDetails(date).totalDays
  const days =
    configuration.interpretation === 'remaining-month'
      ? totalDays - setupDay + 1
      : totalDays
  const dayNumber =
    configuration.interpretation === 'remaining-month'
      ? date.getDate() - setupDay + 1
      : date.getDate()
  return getDailyAllocationCents(
    configuration.amountCents,
    days,
    configuration.rounding,
    dayNumber,
  )
}

function isBudgetConfiguration(value: unknown): value is BudgetConfiguration {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<BudgetConfiguration>
  return (
    item.version === 1 &&
    Number.isSafeInteger(item.amountCents) &&
    (item.amountCents ?? 0) > 0 &&
    typeof item.monthKey === 'string' &&
    /^\d{4}-\d{2}$/.test(item.monthKey) &&
    typeof item.setupDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(item.setupDate) &&
    (item.interpretation === 'remaining-month' || item.interpretation === 'full-month') &&
    (item.rounding === 'exact' || item.rounding === 'down' || item.rounding === 'up')
  )
}

function normalizeMonth(value: unknown): BudgetConfiguration[] {
  const values = Array.isArray(value) ? value : [value]
  const byDate = new Map<string, BudgetConfiguration>()
  values.forEach((item) => {
    if (isBudgetConfiguration(item)) byDate.set(item.setupDate, item)
  })
  return [...byDate.values()].sort((a, b) => a.setupDate.localeCompare(b.setupDate))
}

export function loadBudgetForMonth(monthKey: string) {
  const history = loadBudgetConfigurations()[monthKey] ?? []
  return history.at(-1) ?? null
}

export function loadBudgetConfigurations(): BudgetConfigurationHistory {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(budgetStorageKey) ?? '{}')
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return {}
    const normalized = Object.entries(stored).reduce<BudgetConfigurationHistory>(
      (result, [key, value]) => {
        const configurations = normalizeMonth(value).filter((item) => item.monthKey === key)
        if (configurations.length) result[key] = configurations
        return result
      },
      {},
    )
    // Legacy storage used a single object per month. Writing the normalized
    // shape here makes migration deterministic and safe to repeat.
    if (JSON.stringify(stored) !== JSON.stringify(normalized)) {
      localStorage.setItem(budgetStorageKey, JSON.stringify(normalized))
    }
    return normalized
  } catch {
    return {}
  }
}

export function getConfigurationForDate(
  configurations: BudgetConfiguration[],
  dateKey: string,
) {
  return configurations.filter((item) => item.setupDate <= dateKey).at(-1) ?? null
}

export function getAllocationForDate(
  configuration: BudgetConfiguration,
  dateKey: string,
) {
  const date = new Date(`${dateKey}T12:00:00`)
  const setupDay = Number(configuration.setupDate.slice(-2))
  const totalDays = getMonthDetails(date).totalDays
  const days = configuration.interpretation === 'remaining-month'
    ? totalDays - setupDay + 1
    : totalDays
  const dayNumber = configuration.interpretation === 'remaining-month'
    ? date.getDate() - setupDay + 1
    : date.getDate()
  return getDailyAllocationCents(
    configuration.amountCents,
    days,
    configuration.rounding,
    dayNumber,
  )
}

export function saveBudget(configuration: BudgetConfiguration) {
  const configurations = loadBudgetConfigurations()
  const month = configurations[configuration.monthKey] ?? []
  configurations[configuration.monthKey] = [...month.filter((item) => item.setupDate !== configuration.setupDate), configuration]
    .sort((a, b) => a.setupDate.localeCompare(b.setupDate))
  try {
    localStorage.setItem(budgetStorageKey, JSON.stringify(configurations))
    return true
  } catch {
    return false
  }
}

/** Creates the confirmed hard-reset configuration for a new calendar month. */
export function createNewMonthBudget(
  previous: BudgetConfiguration,
  monthKey: string,
  setupDate: string,
  amountCents = previous.amountCents,
  rounding = previous.rounding,
): BudgetConfiguration {
  return { version: 1, amountCents, monthKey, setupDate, interpretation: 'full-month', rounding }
}
