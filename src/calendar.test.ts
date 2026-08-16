import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateDayBalances, calculateMonthlySummary, dateRange, type DatedTransaction } from './calendar.ts'
import type { BudgetConfiguration } from './budget.ts'

const config: BudgetConfiguration = { version: 1, amountCents: 15000, monthKey: '2026-08', setupDate: '2026-08-01', interpretation: 'full-month', rounding: 'down' }

test('date range includes skipped local calendar days', () => {
  assert.deepEqual(dateRange('2026-08-29', '2026-09-02'), ['2026-08-29', '2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02'])
})

test('balances roll through skipped days and historical changes', () => {
  const transactions: DatedTransaction[] = [{ id: '1', date: '2026-08-01', category: 'Food', amountCents: 500 }]
  const before = calculateDayBalances('2026-08-01', '2026-08-03', { '2026-08': [config] }, transactions)
  assert.equal(before[2].endingBalanceCents, 700)
  transactions[0].amountCents = 200
  const after = calculateDayBalances('2026-08-01', '2026-08-03', { '2026-08': [config] }, transactions)
  assert.equal(after[2].endingBalanceCents, 1000)
})

test('a new month resets rollover', () => {
  const september = { ...config, monthKey: '2026-09', setupDate: '2026-09-01' }
  const balances = calculateDayBalances('2026-08-31', '2026-09-01', { '2026-08': [config], '2026-09': [september] }, [])
  assert.equal(balances[1].priorBalanceCents, 0)
})

test('effective-dated configurations preserve earlier allocations and rollover', () => {
  const change = { ...config, amountCents: 12000, setupDate: '2026-08-16', interpretation: 'remaining-month' as const, rounding: 'exact' as const }
  const balances = calculateDayBalances('2026-08-01', '2026-08-17', { '2026-08': [config, change] }, [{ id: '1', date: '2026-08-10', category: 'Food', amountCents: 250 }])
  assert.equal(balances[14].allocationCents, 400)
  assert.equal(balances[15].allocationCents, 750)
  assert.equal(balances[15].priorBalanceCents, balances[14].endingBalanceCents)
  assert.equal(balances[16].allocationCents, 750)
})

test('a second change and a historical edit retain each dated rule', () => {
  const firstChange: BudgetConfiguration = { ...config, amountCents: 16000, setupDate: '2026-08-16', interpretation: 'remaining-month', rounding: 'exact' }
  const secondChange: BudgetConfiguration = { ...config, amountCents: 2400, setupDate: '2026-08-20', interpretation: 'remaining-month', rounding: 'up' }
  const configurations = { '2026-08': [config, firstChange, secondChange] }
  const transactions = [{ id: '1', date: '2026-08-10', category: 'Life', amountCents: 100 }]
  const before = calculateDayBalances('2026-08-01', '2026-08-21', configurations, transactions)
  assert.equal(before[14].allocationCents, 400)
  assert.equal(before[15].allocationCents, 1000)
  assert.equal(before[19].allocationCents, 200)
  transactions[0].amountCents = 350
  const after = calculateDayBalances('2026-08-01', '2026-08-21', configurations, transactions)
  assert.equal(after[9].endingBalanceCents, before[9].endingBalanceCents - 250)
  assert.equal(after[19].endingBalanceCents, before[19].endingBalanceCents - 250)
  assert.equal(after[14].allocationCents, 400)
  assert.equal(after[15].allocationCents, 1000)
  assert.equal(after[19].allocationCents, 200)
})

test('monthly summary totals effective-dated allocations and category spending', () => {
  const change: BudgetConfiguration = { ...config, amountCents: 12000, setupDate: '2026-08-16', interpretation: 'remaining-month', rounding: 'exact' }
  const transactions: DatedTransaction[] = [
    { id: '1', date: '2026-08-10', category: 'Food', amountCents: 250 },
    { id: '2', date: '2026-08-16', category: 'Fun', amountCents: 750, note: 'Movie' },
  ]
  const balances = calculateDayBalances('2026-08-10', '2026-08-17', { '2026-08': [config, change] }, transactions)
  const summary = calculateMonthlySummary('2026-08', balances, transactions, ['Food', 'Shopping', 'Fun', 'Life'])

  assert.equal(summary.budgetedCents, 3900) // Six $4 days, then two $7.50 days.
  assert.equal(summary.spentCents, 1000)
  assert.deepEqual(summary.categoryTotals, { Food: 250, Shopping: 0, Fun: 750, Life: 0 })
  assert.equal(Object.values(summary.categoryTotals).reduce((sum, value) => sum + value, 0), summary.spentCents)
  assert.equal(summary.balanceCents, 2900)
})

test('monthly summary has a neutral zero-spending state', () => {
  const balances = calculateDayBalances('2026-08-16', '2026-08-16', { '2026-08': [config] }, [])
  const summary = calculateMonthlySummary('2026-08', balances, [], ['Food', 'Shopping', 'Fun', 'Life'])
  assert.equal(summary.spentCents, 0)
  assert.deepEqual(summary.categoryTotals, { Food: 0, Shopping: 0, Fun: 0, Life: 0 })
})

test('monthly category totals react to add, edit, recategorize, and delete changes', () => {
  const balancesFor = (transactions: DatedTransaction[]) => calculateDayBalances('2026-08-01', '2026-08-02', { '2026-08': [config] }, transactions)
  const summarize = (transactions: DatedTransaction[]) => calculateMonthlySummary('2026-08', balancesFor(transactions), transactions, ['Food', 'Shopping', 'Fun', 'Life'])
  let transactions: DatedTransaction[] = [{ id: '1', date: '2026-08-01', category: 'Food', amountCents: 500, note: 'Lunch' }]
  assert.deepEqual(summarize(transactions).categoryTotals, { Food: 500, Shopping: 0, Fun: 0, Life: 0 })

  transactions = [{ ...transactions[0], amountCents: 700, category: 'Shopping', note: undefined }]
  const edited = summarize(transactions)
  assert.equal(edited.spentCents, 700)
  assert.deepEqual(edited.categoryTotals, { Food: 0, Shopping: 700, Fun: 0, Life: 0 })

  transactions = []
  assert.equal(summarize(transactions).spentCents, 0)
})
