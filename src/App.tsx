import { useState } from 'react'
import './App.css'
import CategoryButton from './components/CategoryButton'

function App() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [transactions, setTransactions] = useState<
    { category: string; amount: number }[]
  >([])

  function addExpense() {
    if (!selectedCategory || !amount) return

    setTransactions([
      ...transactions,
      {
        category: selectedCategory,
        amount: Number(amount),
      },
    ])

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
  const categories = ['Food', 'Shopping', 'Fun', 'Life']

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
              <p className="transaction-row" key={index}>
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
