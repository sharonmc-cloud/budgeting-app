import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import CategoryButton from './components/CategoryButton'
import BudgetSetup from './components/BudgetSetup'
import Settings from './components/Settings'
import {
  getLocalDateKey,
  getMonthDetails,
  getMonthKey,
  loadBudgetConfigurations,
  parseMoneyToCents,
  saveBudget,
  type BudgetConfiguration,
  type RoundingPreference,
} from './budget'
import { calculateDayBalances, type DatedTransaction } from './calendar'

const transactionsStorageKey = 'transactions'
const dayCompletionsStorageKey = 'dayCompletions'
const migrationKey = 'calendarDayMigrationVersion'
type DayCompletions = Record<string, boolean>
type View = 'today' | 'history' | 'detail' | 'settings'

const currency = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 })
const categories = ['Food', 'Shopping', 'Fun', 'Life']
const createId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
const money = (cents: number) => currency.format(cents / 100)
const formatDate = (key: string, weekday = true) => new Intl.DateTimeFormat(undefined, { ...(weekday ? { weekday: 'long' as const } : {}), month: 'long', day: 'numeric', year: key.slice(0, 4) === getLocalDateKey().slice(0, 4) ? undefined : 'numeric' }).format(new Date(`${key}T12:00:00`))

function loadTransactions(today: string): DatedTransaction[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(transactionsStorageKey) ?? '[]')
    if (!Array.isArray(stored)) return []
    const migrated = localStorage.getItem(migrationKey) !== '1'
    const result = stored.flatMap((value): DatedTransaction[] => {
      if (!value || typeof value !== 'object') return []
      const item = value as Record<string, unknown>
      if (typeof item.category !== 'string') return []
      const amountCents = Number.isSafeInteger(item.amountCents) ? Number(item.amountCents) : typeof item.amount === 'number' && Number.isFinite(item.amount) ? Math.round(item.amount * 100) : NaN
      if (!Number.isSafeInteger(amountCents) || amountCents < 0) return []
      return [{ id: typeof item.id === 'string' && item.id ? item.id : createId(), date: typeof item.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.date) ? item.date : today, category: item.category, amountCents }]
    })
    if (migrated) {
      localStorage.setItem(transactionsStorageKey, JSON.stringify(result))
      localStorage.setItem(migrationKey, '1')
    }
    return result
  } catch { return [] }
}

function loadCompletions(): DayCompletions {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(dayCompletionsStorageKey) ?? '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(Object.entries(value).filter(([date, complete]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && complete === true))
  } catch { return {} }
}

function NewMonthPrompt({ previous, monthName, onKeep, onEdit }: { previous: BudgetConfiguration; monthName: string; onKeep: () => void; onEdit: () => void }) {
  return <div className="modal-backdrop"><section className="month-modal" role="dialog" aria-modal="true" aria-labelledby="month-title"><p className="setup__eyebrow">A fresh month</p><h1 id="month-title">Set up {monthName}</h1><p>Last month, your spending amount was <strong>{money(previous.amountCents)}</strong>.</p><div className="month-modal__actions"><button className="setup__submit" onClick={onKeep}>Keep {money(previous.amountCents)} <span aria-hidden="true">→</span></button><button className="secondary-button" onClick={onEdit}>Edit amount</button></div></section></div>
}

function App() {
  const today = getLocalDateKey()
  const monthKey = getMonthKey()
  const [configurations, setConfigurations] = useState(loadBudgetConfigurations)
  const [transactions, setTransactions] = useState(() => loadTransactions(today))
  const [completions, setCompletions] = useState(loadCompletions)
  const [view, setView] = useState<View>('today')
  const [selectedDate, setSelectedDate] = useState(today)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingAmount, setEditingAmount] = useState('')
  const [notice, setNotice] = useState('')
  const [showSetup, setShowSetup] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const currentConfiguration = configurations[monthKey]?.at(-1)
  const previousConfiguration = Object.entries(configurations).filter(([key]) => key < monthKey).sort(([a], [b]) => b.localeCompare(a))[0]?.[1].at(-1)
  const trackingStart = Object.values(configurations).flat().map((item) => item.setupDate).sort()[0] ?? today
  const balances = useMemo(() => calculateDayBalances(trackingStart, today, configurations, transactions), [trackingStart, today, configurations, transactions])
  const balanceMap = new Map(balances.map((balance) => [balance.date, balance]))

  useEffect(() => localStorage.setItem(transactionsStorageKey, JSON.stringify(transactions)), [transactions])
  useEffect(() => localStorage.setItem(dayCompletionsStorageKey, JSON.stringify(completions)), [completions])
  useEffect(() => { if (selectedCategory) inputRef.current?.focus() }, [selectedCategory])

  const saveConfiguration = (configuration: BudgetConfiguration) => { saveBudget(configuration); setConfigurations(loadBudgetConfigurations()); setShowSetup(false) }
  if (!currentConfiguration && (!previousConfiguration || showSetup)) return <BudgetSetup onComplete={saveConfiguration} />
  if (!currentConfiguration && previousConfiguration) {
    const details = getMonthDetails()
    return <NewMonthPrompt previous={previousConfiguration} monthName={details.monthName} onEdit={() => setShowSetup(true)} onKeep={() => saveConfiguration({ ...previousConfiguration, monthKey, setupDate: today, interpretation: 'full-month' })} />
  }

  const activeDate = view === 'today' ? today : selectedDate
  const activeBalance = balanceMap.get(activeDate) ?? { priorBalanceCents: 0, endingBalanceCents: 0, spentCents: 0 }
  const dayTransactions = transactions.filter((item) => item.date === activeDate)
  const isToday = activeDate === today
  const editable = activeDate.slice(0, 7) === monthKey
  const historicalChange = !isToday
  const resetEntry = () => { setAmount(''); setSelectedCategory(null) }
  const changed = () => { if (historicalChange) { setNotice('Later daily balances were recalculated.'); window.setTimeout(() => setNotice(''), 3500) } }
  function addExpense() {
    if (!selectedCategory) return
    const amountCents = parseMoneyToCents(amount)
    if (amountCents === null) return
    setTransactions((all) => [...all, { id: createId(), date: activeDate, category: selectedCategory, amountCents }]); resetEntry(); changed()
  }
  function saveTransaction(id: string) {
    const amountCents = parseMoneyToCents(editingAmount)
    if (amountCents === null) return
    setTransactions((all) => all.map((item) => item.id === id ? { ...item, amountCents } : item)); setEditingId(null); changed()
  }
  function deleteTransaction(id: string) { setTransactions((all) => all.filter((item) => item.id !== id)); setEditingId(null); changed() }
  function navigate(next: View, date = today) { setView(next); setSelectedDate(date); setEditingId(null); resetEntry(); setNotice('') }

  function saveSettings(amountCents: number, rounding: RoundingPreference) {
    saveConfiguration({ version: 1, amountCents, monthKey, setupDate: today, interpretation: 'remaining-month', rounding })
  }

  if (view === 'settings') return <main className="today"><PrimaryNav view={view} navigate={navigate} /><Settings configuration={currentConfiguration!} today={today} onSave={saveSettings} /></main>

  if (view === 'history') return <main className="today history"><PrimaryNav view={view} navigate={navigate} /><header className="history__header"><p className="setup__eyebrow">Your days</p><h1>History</h1><p>Every budgeting day, newest first.</p></header>{balances.filter((item) => item.date < today).reverse().map((day) => <button className="history-row" key={day.date} onClick={() => navigate('detail', day.date)}><span><strong>{formatDate(day.date)}</strong><small>{day.spentCents ? `${money(day.spentCents)} spent` : 'No spending'}</small></span><span className="history-row__balance">{money(day.endingBalanceCents)} <span aria-hidden="true">→</span></span></button>)}</main>

  return <main className="today"><PrimaryNav view={isToday ? 'today' : 'history'} navigate={navigate} />{!isToday && <button className="back-button" onClick={() => navigate('history')}>← Back to History</button>}<header className="today__header"><p className="today__date">{formatDate(activeDate)}</p><div className="balance"><h1 className="balance__amount">{money(activeBalance.endingBalanceCents)}</h1><p className="balance__label">{isToday ? 'available today' : 'ending balance'}</p><p className="balance__rollover">Includes {money(activeBalance.priorBalanceCents)} from the prior day</p></div></header>
  {editable ? <><div className="categories" aria-label="Expense categories">{categories.map((category) => <CategoryButton key={category} label={category} selected={selectedCategory === category} onClick={() => setSelectedCategory(category)} />)}</div>{selectedCategory && <section className="expense-entry" aria-labelledby="expense-title"><h2 className="expense-entry__title" id="expense-title">{selectedCategory}</h2><form onSubmit={(event) => { event.preventDefault(); addExpense() }}><label className="expense-entry__label">Amount<input ref={inputRef} className="expense-entry__input" inputMode="decimal" placeholder="$0" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><button className="expense-entry__button" type="submit">Add {amount ? `$${amount}` : '$0'}</button></form></section>}</> : <p className="read-only" role="note">Previous months are view only.</p>}
  {notice && <p className="recalculation-notice" role="status">{notice}</p>}
  <section className="spending" aria-labelledby="spending-title"><h2 className="spending__title" id="spending-title">{isToday ? "Today's spending" : 'Spending'}</h2>{dayTransactions.length === 0 ? <p className="spending__empty">No spending logged for this day.</p> : <div className="transaction-list">{dayTransactions.map((transaction) => <div className="transaction-row" data-category={transaction.category} key={transaction.id}>{editingId === transaction.id ? <><label className="transaction-row__edit-label"><span className="transaction-row__category">{transaction.category} amount</span><span className="transaction-row__input-wrap"><span aria-hidden="true">$</span><input className="transaction-row__input" inputMode="decimal" value={editingAmount} onChange={(event) => setEditingAmount(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') saveTransaction(transaction.id); if (event.key === 'Escape') setEditingId(null) }} autoFocus /></span></label><div className="transaction-row__actions"><button onClick={() => saveTransaction(transaction.id)}>Save</button><button onClick={() => setEditingId(null)}>Cancel</button></div></> : <><div className="transaction-row__details"><span>{transaction.category}</span><span className="transaction-row__amount">{money(transaction.amountCents)}</span></div>{editable && <div className="transaction-row__actions"><button onClick={() => { setEditingId(transaction.id); setEditingAmount(String(transaction.amountCents / 100)) }}>Edit</button><button className="transaction-row__delete" onClick={() => deleteTransaction(transaction.id)}>Delete</button></div>}</>}</div>)}</div>}</section>
  {isToday && <section className={`day-finish${completions[today] ? ' day-finish--complete' : ''}`}>{completions[today] ? <div className="day-complete" role="status"><div className="celebration" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <span key={i} />)}</div><p className="day-complete__eyebrow">Checked in</p><h2 className="day-complete__title">Day complete.</h2><p className="day-complete__rollover"><strong>{money(activeBalance.endingBalanceCents)}</strong> rolls into tomorrow.</p></div> : <button className="day-finish__button" onClick={() => setCompletions((all) => ({ ...all, [today]: true }))}><span>Finish my day</span><span className="day-finish__button-mark" aria-hidden="true">✓</span></button>}</section>}</main>
}

function PrimaryNav({ view, navigate }: { view: View; navigate: (view: View, date?: string) => void }) { return <nav className="primary-nav" aria-label="Primary"><button aria-current={view === 'today' ? 'page' : undefined} onClick={() => navigate('today')}>Today</button><button aria-current={view === 'history' || view === 'detail' ? 'page' : undefined} onClick={() => navigate('history')}>History</button><button aria-current={view === 'settings' ? 'page' : undefined} onClick={() => navigate('settings')}>Settings</button></nav> }
export default App
