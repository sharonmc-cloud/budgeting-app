import { useEffect, useRef, useState } from 'react'
import './App.css'
import CategoryButton from './components/CategoryButton'
import BudgetSetup from './components/BudgetSetup'
import {
  getMonthKey,
  getTodayAllocationCents,
  loadBudgetForMonth,
  saveBudget,
  type BudgetConfiguration,
} from './budget'

type Transaction = {
  id: string
  category: string
  amount: number
}

const transactionsStorageKey = 'transactions'
const dayCompletionsStorageKey = 'dayCompletions'

type DayCompletions = Record<string, boolean>

function getTodayKey() {
  const today = new Date()
  const offsetDate = new Date(
    today.getTime() - today.getTimezoneOffset() * 60 * 1000,
  )

  return offsetDate.toISOString().slice(0, 10)
}

function loadDayCompletions(): DayCompletions {
  try {
    const storedCompletions = JSON.parse(
      localStorage.getItem(dayCompletionsStorageKey) ?? '{}',
    )

    if (
      typeof storedCompletions !== 'object' ||
      storedCompletions === null ||
      Array.isArray(storedCompletions)
    ) {
      return {}
    }

    return Object.entries(storedCompletions).reduce<DayCompletions>(
      (completions, [date, completed]) => {
        if (/^\d{4}-\d{2}-\d{2}$/.test(date) && completed === true) {
          completions[date] = true
        }

        return completions
      },
      {},
    )
  } catch {
    return {}
  }
}

function formatRollover(amount: number) {
  if (amount > 0) return `+$${amount}`
  if (amount < 0) return `−$${Math.abs(amount)}`
  return '$0'
}

function createTransactionId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  )
}

function loadTransactions(): Transaction[] {
  try {
    const storedTransactions = JSON.parse(
      localStorage.getItem(transactionsStorageKey) ?? '[]',
    )

    if (!Array.isArray(storedTransactions)) return []

    return storedTransactions.flatMap((transaction) => {
      if (
        typeof transaction !== 'object' ||
        transaction === null ||
        typeof transaction.category !== 'string' ||
        typeof transaction.amount !== 'number' ||
        !Number.isFinite(transaction.amount)
      ) {
        return []
      }

      return [
        {
          id:
            typeof transaction.id === 'string' && transaction.id
              ? transaction.id
              : createTransactionId(),
          category: transaction.category,
          amount: transaction.amount,
        },
      ]
    })
  } catch {
    return []
  }
}

function App() {
  const [budgetConfiguration, setBudgetConfiguration] =
    useState<BudgetConfiguration | null>(() => loadBudgetForMonth(getMonthKey()))
  const amountInputRef = useRef<HTMLInputElement>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [transactions, setTransactions] =
    useState<Transaction[]>(loadTransactions)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingAmount, setEditingAmount] = useState('')
  const [dayCompletions, setDayCompletions] =
    useState<DayCompletions>(loadDayCompletions)
  const todayKey = getTodayKey()

  useEffect(() => {
    localStorage.setItem(transactionsStorageKey, JSON.stringify(transactions))
  }, [transactions])

  useEffect(() => {
    localStorage.setItem(
      dayCompletionsStorageKey,
      JSON.stringify(dayCompletions),
    )
  }, [dayCompletions])

  useEffect(() => {
    if (selectedCategory) amountInputRef.current?.focus()
  }, [selectedCategory])

  function addExpense() {
    if (!selectedCategory || !amount) return

    setTransactions([
      ...transactions,
      {
        id: createTransactionId(),
        category: selectedCategory,
        amount: Number(amount),
      },
    ])

    setAmount('')
    setSelectedCategory(null)
  }

  function startEditing(transaction: Transaction) {
    setEditingId(transaction.id)
    setEditingAmount(String(transaction.amount))
  }

  function cancelEditing() {
    setEditingId(null)
    setEditingAmount('')
  }

  function saveTransaction(id: string) {
    const updatedAmount = Number(editingAmount)
    if (!editingAmount || !Number.isFinite(updatedAmount) || updatedAmount < 0)
      return

    setTransactions((currentTransactions) =>
      currentTransactions.map((transaction) =>
        transaction.id === id
          ? { ...transaction, amount: updatedAmount }
          : transaction,
      ),
    )
    cancelEditing()
  }

  function deleteTransaction(id: string) {
    setTransactions((currentTransactions) =>
      currentTransactions.filter((transaction) => transaction.id !== id),
    )
    if (editingId === id) cancelEditing()
  }

  function completeBudgetSetup(configuration: BudgetConfiguration) {
    saveBudget(configuration)
    setBudgetConfiguration(configuration)
  }

  if (!budgetConfiguration) {
    return <BudgetSetup onComplete={completeBudgetSetup} />
  }

  const dailyBaseline = getTodayAllocationCents(budgetConfiguration) / 100

  const historicalTransactions = [
    { date: '2026-08-06', category: 'Food', amount: 20 },
    { date: '2026-08-07', category: 'Food', amount: 12 },
    { date: '2026-08-07', category: 'Life', amount: 8 },
  ]
  const historicalDates = ['2026-08-06', '2026-08-07']

  const previousDayBalance = historicalDates.reduce((rollover, date) => {
    const spentThatDay = historicalTransactions
      .filter((transaction) => transaction.date === date)
      .reduce((total, transaction) => total + transaction.amount, 0)

    return rollover + dailyBaseline - spentThatDay
  }, 0)
  const totalSpent = transactions.reduce(
    (total, transaction) => total + transaction.amount,
    0,
  )

  const availableToday = previousDayBalance + dailyBaseline - totalSpent
  const categories = ['Food', 'Shopping', 'Fun', 'Life']
  const isTodayComplete = dayCompletions[todayKey] === true

  return (
    <main className="today">
      <header className="today__header">
        <p className="today__date">
          {new Intl.DateTimeFormat(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          }).format(new Date())}
        </p>

        <div className="balance">
          <h1 className="balance__amount">${availableToday}</h1>
          <p className="balance__label">available today</p>
          <p className="balance__rollover">
            Includes ${previousDayBalance} from yesterday
          </p>
        </div>
      </header>

      <div className="categories" aria-label="Expense categories">
        {categories.map((category) => (
          <CategoryButton
            key={category}
            label={category}
            selected={selectedCategory === category}
            onClick={() => setSelectedCategory(category)}
          />
        ))}
      </div>

      {selectedCategory && (
        <section className="expense-entry" aria-labelledby="expense-title">
          <h2 className="expense-entry__title" id="expense-title">
            {selectedCategory}
          </h2>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              addExpense()
            }}
          >
            <label className="expense-entry__label">
              Amount
              <input
                ref={amountInputRef}
                className="expense-entry__input"
                type="number"
                inputMode="decimal"
                placeholder="$0"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </label>

            <button className="expense-entry__button" type="submit">
              Add ${amount || '0'}
            </button>
          </form>
        </section>
      )}

      <section className="spending" aria-labelledby="spending-title">
        <h2 className="spending__title" id="spending-title">
          Today&apos;s spending
        </h2>
        {transactions.length === 0 ? (
          <p className="spending__empty">No spending logged today.</p>
        ) : (
          <div className="transaction-list">
            {transactions.map((transaction) => (
              <div
                className="transaction-row"
                data-category={transaction.category}
                key={transaction.id}
              >
                {editingId === transaction.id ? (
                  <>
                    <label className="transaction-row__edit-label">
                      <span className="transaction-row__category">
                        {transaction.category} amount
                      </span>
                      <span className="transaction-row__input-wrap">
                        <span aria-hidden="true">$</span>
                        <input
                          className="transaction-row__input"
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          value={editingAmount}
                          onChange={(event) =>
                            setEditingAmount(event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === 'Enter')
                              saveTransaction(transaction.id)
                            if (event.key === 'Escape') cancelEditing()
                          }}
                          autoFocus
                        />
                      </span>
                    </label>
                    <div className="transaction-row__actions">
                      <button
                        type="button"
                        onClick={() => saveTransaction(transaction.id)}
                      >
                        Save
                      </button>
                      <button type="button" onClick={cancelEditing}>
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="transaction-row__details">
                      <span>{transaction.category}</span>
                      <span className="transaction-row__amount">
                        ${transaction.amount}
                      </span>
                    </div>
                    <div className="transaction-row__actions">
                      <button
                        type="button"
                        onClick={() => startEditing(transaction)}
                      >
                        Edit
                      </button>
                      <button
                        className="transaction-row__delete"
                        type="button"
                        onClick={() => deleteTransaction(transaction.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section
        className={`day-finish${isTodayComplete ? ' day-finish--complete' : ''}`}
        aria-labelledby={isTodayComplete ? 'day-complete-title' : undefined}
      >
        {isTodayComplete ? (
          <div className="day-complete" role="status" aria-live="polite">
            <div className="celebration" aria-hidden="true">
              {Array.from({ length: 12 }, (_, index) => (
                <span key={index} />
              ))}
            </div>
            <p className="day-complete__eyebrow">Checked in</p>
            <h2 className="day-complete__title" id="day-complete-title">
              Day complete.
            </h2>
            <p className="day-complete__rollover">
              <strong>{formatRollover(availableToday)}</strong> rolls into
              tomorrow.
            </p>
          </div>
        ) : (
          <button
            className="day-finish__button"
            type="button"
            onClick={() =>
              setDayCompletions((completions) => ({
                ...completions,
                [todayKey]: true,
              }))
            }
          >
            <span>Finish my day</span>
            <span className="day-finish__button-mark" aria-hidden="true">
              ✓
            </span>
          </button>
        )}
      </section>
    </main>
  )
}

export default App
