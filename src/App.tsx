import { useEffect, useState } from 'react'
import './App.css'
import CategoryButton from './components/CategoryButton'

const categories = ['Food', 'Shopping', 'Fun', 'Life'] as const
const transactionsStorageKey = 'budgeting-app.today-transactions'

type Category = (typeof categories)[number]

type Transaction = {
  category: Category
  amount: number
}

type StoredTransactions = {
  version: 1
  transactions: Transaction[]
}

function isTransaction(value: unknown): value is Transaction {
  if (!value || typeof value !== 'object') return false

  const transaction = value as Record<string, unknown>

  return (
    typeof transaction.category === 'string' &&
    categories.some((category) => category === transaction.category) &&
    typeof transaction.amount === 'number' &&
    Number.isFinite(transaction.amount)
  )
}

function loadTransactions(): Transaction[] {
  try {
    const savedTransactions = localStorage.getItem(transactionsStorageKey)

    if (!savedTransactions) return []

    const storedData: unknown = JSON.parse(savedTransactions)

    if (!storedData || typeof storedData !== 'object') return []

    const { version, transactions } = storedData as Partial<StoredTransactions>

    if (
      version !== 1 ||
      !Array.isArray(transactions) ||
      !transactions.every(isTransaction)
    ) {
      return []
    }

    return transactions
  } catch {
    return []
  }
}

function saveTransactions(transactions: Transaction[]) {
  try {
    const storedData: StoredTransactions = {
      version: 1,
      transactions,
    }

    localStorage.setItem(transactionsStorageKey, JSON.stringify(storedData))
  } catch {
    // Keep the in-memory expense experience working when storage is unavailable.
  }
}

function App() {
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [amount, setAmount] = useState('')
  const [transactions, setTransactions] =
    useState<Transaction[]>(loadTransactions)

  useEffect(() => {
    saveTransactions(transactions)
  }, [transactions])

  function addExpense() {
    if (!selectedCategory || !amount) return

    setTransactions((currentTransactions) => {
      const updatedTransactions = [
        ...currentTransactions,
        {
          category: selectedCategory,
          amount: Number(amount),
        },
      ]

      return updatedTransactions
    })

    setAmount('')
    setSelectedCategory(null)
  }

  const dailyBaseline = 50

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
  return (
    <main className="today">
      <header className="today__header">
        <p className="today__date">Saturday, August 8</p>

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

          <label className="expense-entry__label">
            Amount
            <input
              className="expense-entry__input"
              type="number"
              inputMode="decimal"
              placeholder="$0"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>

          <button
            className="expense-entry__button"
            type="button"
            onClick={addExpense}
          >
            Add ${amount || '0'}
          </button>
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
            {transactions.map((transaction, index) => (
              <p
                className="transaction-row"
                data-category={transaction.category}
                key={index}
              >
                <span>{transaction.category}</span>
                <span className="transaction-row__amount">
                  ${transaction.amount}
                </span>
              </p>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

export default App
