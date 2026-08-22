import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createNewMonthBudget,
  getDailyAllocationCents,
  getMonthDetails,
  getPeriodDays,
  getTodayAllocationCents,
  loadBudgetForMonth,
  loadBudgetConfigurations,
  parseMoneyToCents,
  saveBudget,
  type BudgetConfiguration,
} from './budget.ts'

const august16 = new Date(2026, 7, 16, 12)

test('remaining month includes today', () => {
  assert.equal(getMonthDetails(august16).remainingDays, 16)
  assert.equal(getPeriodDays('remaining-month', august16), 16)
  assert.equal(getDailyAllocationCents(150_000, 16, 'exact'), 9_375)
})

test('full month uses every calendar day', () => {
  assert.equal(getMonthDetails(august16).totalDays, 31)
  assert.equal(getPeriodDays('full-month', august16), 31)
  assert.equal(getDailyAllocationCents(150_000, 31, 'exact'), 4_839)
})

test('rounding modes preserve total cents using the final day', () => {
  assert.equal(getDailyAllocationCents(150_000, 16, 'exact'), 9_375)
  assert.equal(getDailyAllocationCents(150_000, 16, 'down'), 9_300)
  assert.equal(getDailyAllocationCents(150_000, 16, 'up'), 9_400)

  for (const rounding of ['exact', 'down', 'up'] as const) {
    const allocations = Array.from({ length: 16 }, (_, index) =>
      getDailyAllocationCents(150_000, 16, rounding, index + 1),
    )
    assert.equal(allocations.reduce((total, value) => total + value, 0), 150_000)
  }
})

test('today allocation uses the saved setup period', () => {
  const configuration: BudgetConfiguration = {
    version: 1,
    amountCents: 150_000,
    monthKey: '2026-08',
    setupDate: '2026-08-16',
    interpretation: 'remaining-month',
    rounding: 'down',
  }
  assert.equal(getTodayAllocationCents(configuration, august16), 9_300)
  assert.equal(getTodayAllocationCents(configuration, new Date(2026, 7, 31, 12)), 10_500)
})

test('money parsing is cents-safe', () => {
  assert.equal(parseMoneyToCents('$1,500.25'), 150_025)
  assert.equal(parseMoneyToCents('10.999'), null)
  assert.equal(parseMoneyToCents('0'), null)
})

test('storage persists by month and does not apply an outdated month', () => {
  const values = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  })
  const configuration: BudgetConfiguration = {
    version: 1,
    amountCents: 150_000,
    monthKey: '2026-08',
    setupDate: '2026-08-16',
    interpretation: 'full-month',
    rounding: 'up',
  }
  saveBudget(configuration)
  assert.deepEqual(loadBudgetForMonth('2026-08'), configuration)
  assert.deepEqual(loadBudgetConfigurations()['2026-08'], [configuration])
  assert.equal(loadBudgetForMonth('2026-09'), null)
})

test('a failed budget storage write is reported without throwing', () => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => null,
      setItem: () => { throw new Error('Storage unavailable') },
    },
  })
  const configuration: BudgetConfiguration = {
    version: 1,
    amountCents: 150_000,
    monthKey: '2026-08',
    setupDate: '2026-08-16',
    interpretation: 'remaining-month',
    rounding: 'exact',
  }
  assert.equal(saveBudget(configuration), false)
})

test('legacy single-month configurations migrate once and same-day updates replace', () => {
  const values = new Map<string, string>()
  const original: BudgetConfiguration = { version: 1, amountCents: 10000, monthKey: '2026-08', setupDate: '2026-08-01', interpretation: 'full-month', rounding: 'exact' }
  values.set('budgetConfigurations', JSON.stringify({ '2026-08': original }))
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) } })
  assert.deepEqual(loadBudgetConfigurations()['2026-08'], [original])
  saveBudget({ ...original, amountCents: 12000 })
  assert.equal(loadBudgetConfigurations()['2026-08'].length, 1)
  assert.equal(loadBudgetForMonth('2026-08')?.amountCents, 12000)
})

test('new month keeps the proposed amount and rounding without carrying prior state', () => {
  const previous: BudgetConfiguration = { version: 1, amountCents: 12345, monthKey: '2026-08', setupDate: '2026-08-10', interpretation: 'remaining-month', rounding: 'down' }
  assert.deepEqual(createNewMonthBudget(previous, '2026-09', '2026-09-01'), {
    version: 1,
    amountCents: 12345,
    monthKey: '2026-09',
    setupDate: '2026-09-01',
    interpretation: 'full-month',
    rounding: 'down',
  })
  assert.equal(previous.monthKey, '2026-08')
})

test('new month edits only the new amount and rounding', () => {
  const previous: BudgetConfiguration = { version: 1, amountCents: 12345, monthKey: '2026-08', setupDate: '2026-08-10', interpretation: 'remaining-month', rounding: 'down' }
  const next = createNewMonthBudget(previous, '2026-09', '2026-09-01', 20000, 'up')
  assert.equal(next.amountCents, 20000)
  assert.equal(next.rounding, 'up')
  assert.equal(previous.amountCents, 12345)
})
