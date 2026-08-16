import { useEffect, useRef, useState } from 'react'
import './App.css'
import CategoryButton from './components/CategoryButton'

type Transaction = {
  id: string
  category: string
  amount: number
}

const transactionsStorageKey = 'transactions'

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
  const amountInputRef = useRef<HTMLInputElement>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [transactions, setTransactions] =
    useState<Transaction[]>(loadTransactions)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingAmount, setEditingAmount] = useState('')

  useEffect(() => {
    localStorage.setItem(transactionsStorageKey, JSON.stringify(transactions))
  }, [transactions])

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
                className={`transaction-row${
                  editingId === transaction.id
                    ? ' transaction-row--editing'
                    : ''
                }`}
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
    </main>
  )
}

export default App
