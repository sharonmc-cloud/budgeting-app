import { useState } from 'react'
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

const totalSpent = transactions.reduce(
  (total, transaction) => total + transaction.amount,
  0
)

const availableToday = 50 - totalSpent

  return (
    <main>
      <p>Saturday, August 8</p>

      <h1>${availableToday}</h1>
      <p>available today</p>

      <div>
       <CategoryButton
        label="Food"
        onClick={() => setSelectedCategory('Food')}
      />

      <CategoryButton
        label="Shopping"
       onClick={() => setSelectedCategory('Shopping')}
      />

      <CategoryButton
        label="Fun"
        onClick={() => setSelectedCategory('Fun')}
      />

      <CategoryButton
        label="Life"
        onClick={() => setSelectedCategory('Life')}
      />
      </div>
      
      {selectedCategory && (
      <div>
      <h2>{selectedCategory}</h2>

      <label>
      Amount
      <input
        type="number"
        placeholder="$0"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
/>
      </label>

      <button onClick={addExpense}>
        Add ${amount || '0'}
      </button>
  </div>
)}

      <h2>Today's spending</h2>
      {transactions.length === 0 ? (
  <p>No spending logged today.</p>
) : (
  <div>
    {transactions.map((transaction, index) => (
      <p key={index}>
        {transaction.category} — ${transaction.amount}
      </p>
    ))}
  </div>
)}
      
    </main>
  )

}

export default App