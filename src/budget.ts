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

export function loadBudgetForMonth(monthKey: string) {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(budgetStorageKey) ?? '{}')
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return null
    const configuration = (stored as Record<string, unknown>)[monthKey]
    return isBudgetConfiguration(configuration) ? configuration : null
  } catch {
    return null
  }
}

export function saveBudget(configuration: BudgetConfiguration) {
  let configurations: Record<string, unknown> = {}
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(budgetStorageKey) ?? '{}')
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
      configurations = stored as Record<string, unknown>
    }
  } catch {
    // Replace only malformed budget setup data; transaction data is stored separately.
  }
  localStorage.setItem(
    budgetStorageKey,
    JSON.stringify({ ...configurations, [configuration.monthKey]: configuration }),
  )
}
