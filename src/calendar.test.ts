import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateDayBalances, dateRange, type DatedTransaction } from './calendar.ts'
import type { BudgetConfiguration } from './budget.ts'

const config: BudgetConfiguration = { version: 1, amountCents: 15000, monthKey: '2026-08', setupDate: '2026-08-01', interpretation: 'full-month', rounding: 'down' }

test('date range includes skipped local calendar days', () => {
  assert.deepEqual(dateRange('2026-08-29', '2026-09-02'), ['2026-08-29', '2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02'])
})

test('balances roll through skipped days and historical changes', () => {
  const transactions: DatedTransaction[] = [{ id: '1', date: '2026-08-01', category: 'Food', amountCents: 500 }]
  const before = calculateDayBalances('2026-08-01', '2026-08-03', { '2026-08': config }, transactions)
  assert.equal(before[2].endingBalanceCents, 700)
  transactions[0].amountCents = 200
  const after = calculateDayBalances('2026-08-01', '2026-08-03', { '2026-08': config }, transactions)
  assert.equal(after[2].endingBalanceCents, 1000)
})

test('a new month resets rollover', () => {
  const september = { ...config, monthKey: '2026-09', setupDate: '2026-09-01' }
  const balances = calculateDayBalances('2026-08-31', '2026-09-01', { '2026-08': config, '2026-09': september }, [])
  assert.equal(balances[1].priorBalanceCents, 0)
})
