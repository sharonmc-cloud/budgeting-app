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
}

export type DayBalance = {
  date: string
  allocationCents: number
  priorBalanceCents: number
  spentCents: number
  endingBalanceCents: number
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
