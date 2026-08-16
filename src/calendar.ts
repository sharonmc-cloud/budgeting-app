import {
  getAllocationForDate,
  getConfigurationForDate,
  type BudgetConfigurationHistory,
} from './budget.ts'

export type DatedTransaction = {
  id: string
  date: string
  category: string
  amountCents: number
  note?: string
}

export type DayBalance = {
  date: string
  allocationCents: number
  priorBalanceCents: number
  spentCents: number
  endingBalanceCents: number
}

export type MonthlySummary = {
  monthKey: string
  budgetedCents: number
  spentCents: number
  balanceCents: number
  categoryTotals: Record<string, number>
}

export function dateRange(start: string, end: string) {
  if (start > end) return []
  const result: string[] = []
  const cursor = new Date(`${start}T12:00:00`)
  while (true) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
    if (key > end) break
    result.push(key)
    cursor.setDate(cursor.getDate() + 1)
  }
  return result
}

export function calculateDayBalances(
  startDate: string,
  endDate: string,
  configurations: BudgetConfigurationHistory,
  transactions: DatedTransaction[],
) {
  let priorBalanceCents = 0
  let previousMonth = ''
  return dateRange(startDate, endDate).map<DayBalance>((date) => {
    const month = date.slice(0, 7)
    if (month !== previousMonth) priorBalanceCents = 0
    previousMonth = month
    const configuration = getConfigurationForDate(configurations[month] ?? [], date)
    const allocationCents = configuration
      ? getAllocationForDate(configuration, date)
      : 0
    const spentCents = transactions
      .filter((transaction) => transaction.date === date)
      .reduce((sum, transaction) => sum + transaction.amountCents, 0)
    const endingBalanceCents = priorBalanceCents + allocationCents - spentCents
    const balance = { date, allocationCents, priorBalanceCents, spentCents, endingBalanceCents }
    priorBalanceCents = endingBalanceCents
    return balance
  })
}

export function calculateMonthlySummary(
  monthKey: string,
  balances: DayBalance[],
  transactions: DatedTransaction[],
  categories: readonly string[],
): MonthlySummary {
  const monthDays = balances.filter((day) => day.date.slice(0, 7) === monthKey)
  const trackedDates = new Set(monthDays.map((day) => day.date))
  const monthTransactions = transactions.filter((transaction) => trackedDates.has(transaction.date))
  const categoryTotals = Object.fromEntries(categories.map((category) => [category, 0]))

  monthTransactions.forEach((transaction) => {
    if (transaction.category in categoryTotals) categoryTotals[transaction.category] += transaction.amountCents
  })

  return {
    monthKey,
    budgetedCents: monthDays.reduce((sum, day) => sum + day.allocationCents, 0),
    spentCents: monthTransactions.reduce((sum, transaction) => sum + transaction.amountCents, 0),
    balanceCents: monthDays.at(-1)?.endingBalanceCents ?? 0,
    categoryTotals,
  }
}
