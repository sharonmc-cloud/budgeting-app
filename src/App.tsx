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
import { calculateDayBalances, calculateMonthlySummary, type DatedTransaction, type MonthlySummary } from './calendar'

const transactionsStorageKey = 'transactions'
const dayCompletionsStorageKey = 'dayCompletions'
const migrationKey = 'calendarDayMigrationVersion'
const transactionDataVersion = '2'
type DayCompletions = Record<string, boolean>
type View = 'today' | 'history' | 'detail' | 'settings'

const currency = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 })
const categories = ['Food', 'Shopping', 'Fun', 'Life'] as const
const createId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
const money = (cents: number) => currency.format(cents / 100)
const formatDate = (key: string, weekday = true) => new Intl.DateTimeFormat(undefined, { ...(weekday ? { weekday: 'long' as const } : {}), month: 'long', day: 'numeric', year: key.slice(0, 4) === getLocalDateKey().slice(0, 4) ? undefined : 'numeric' }).format(new Date(`${key}T12:00:00`))
const formatMonth = (key: string) => new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date(`${key}-01T12:00:00`))

function SpendingDonut({ summary }: { summary: MonthlySummary }) {
  const description = categories.map((category) => `${category} ${money(summary.categoryTotals[category])}`).join(', ')
  let offset = 0
  return <svg className="monthly-donut" viewBox="0 0 42 42" role="img" aria-label={summary.spentCents ? `Spending by category: ${description}.` : 'No spending recorded for this month.'}>
    <circle className="monthly-donut__track" cx="21" cy="21" r="15.9155" pathLength="100" />
    {summary.spentCents > 0 && categories.map((category) => {
      const portion = summary.categoryTotals[category] / summary.spentCents * 100
      const dashOffset = -offset
      offset += portion
      return portion > 0 ? <circle className="monthly-donut__segment" data-category={category} key={category} cx="21" cy="21" r="15.9155" pathLength="100" strokeDasharray={`${portion} ${100 - portion}`} strokeDashoffset={dashOffset} /> : null
    })}
  </svg>
}

function MonthlyHistorySummary({ summary, current, onSelectCategory }: { summary: MonthlySummary; current: boolean; onSelectCategory: (category: string, trigger: HTMLButtonElement) => void }) {
  return <div className="monthly-summary">
    <dl className="monthly-summary__metrics">
      <div><dt>Budgeted</dt><dd>{money(summary.budgetedCents)}</dd></div>
      <div><dt>Spent</dt><dd>{money(summary.spentCents)}</dd></div>
      <div><dt>{current ? 'Current balance' : 'Ending balance'}</dt><dd>{money(summary.balanceCents)}</dd></div>
    </dl>
    <div className="monthly-summary__breakdown">
      <SpendingDonut summary={summary} />
      <ul aria-label="Category spending totals">{categories.map((category) => {
        const total = summary.categoryTotals[category]
        return <li data-category={category} key={category}><button type="button" aria-disabled={!total} aria-label={`${category}, ${money(total)} spent. ${total ? `Show transactions for ${formatMonth(summary.monthKey)}` : 'No transactions'}`} onClick={(event) => { if (total) onSelectCategory(category, event.currentTarget) }}><span aria-hidden="true" /><strong>{category}</strong> {money(total)}</button></li>
      })}</ul>
    </div>
  </div>
}

function loadTransactions(today: string): DatedTransaction[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(transactionsStorageKey) ?? '[]')
    if (!Array.isArray(stored)) return []
    const migrated = localStorage.getItem(migrationKey) !== transactionDataVersion
    const result = stored.flatMap((value): DatedTransaction[] => {
      if (!value || typeof value !== 'object') return []
      const item = value as Record<string, unknown>
      if (typeof item.category !== 'string' || !categories.includes(item.category as typeof categories[number])) return []
      const amountCents = Number.isSafeInteger(item.amountCents) ? Number(item.amountCents) : typeof item.amount === 'number' && Number.isFinite(item.amount) ? Math.round(item.amount * 100) : NaN
      if (!Number.isSafeInteger(amountCents) || amountCents < 0) return []
      const note = typeof item.note === 'string' && item.note.trim() ? item.note.trim() : undefined
      return [{ id: typeof item.id === 'string' && item.id ? item.id : createId(), date: typeof item.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.date) ? item.date : today, category: item.category, amountCents, ...(note ? { note } : {}) }]
    })
    if (migrated) {
      localStorage.setItem(transactionsStorageKey, JSON.stringify(result))
      localStorage.setItem(migrationKey, transactionDataVersion)
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
  const [note, setNote] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingAmount, setEditingAmount] = useState('')
  const [editingCategory, setEditingCategory] = useState('')
  const [editingNote, setEditingNote] = useState('')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [showSetup, setShowSetup] = useState(false)
  const [drawer, setDrawer] = useState<{ month: string; category: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const drawerRef = useRef<HTMLDialogElement>(null)
  const drawerTriggerRef = useRef<HTMLButtonElement | null>(null)
  const currentConfiguration = configurations[monthKey]?.at(-1)
  const previousConfiguration = Object.entries(configurations).filter(([key]) => key < monthKey).sort(([a], [b]) => b.localeCompare(a))[0]?.[1].at(-1)
  const trackingStart = Object.values(configurations).flat().map((item) => item.setupDate).sort()[0] ?? today
  const balances = useMemo(() => calculateDayBalances(trackingStart, today, configurations, transactions), [trackingStart, today, configurations, transactions])
  const balanceMap = new Map(balances.map((balance) => [balance.date, balance]))
  const historyMonths = useMemo(() => {
    const keys = new Set([monthKey, ...Object.keys(configurations).filter((key) => key <= monthKey)])
    transactions.forEach((transaction) => { if (transaction.date >= trackingStart && transaction.date <= today) keys.add(transaction.date.slice(0, 7)) })
    return [...keys].sort().reverse().map((key) => ({
      key,
      days: balances.filter((day) => day.date.slice(0, 7) === key && day.date < today).reverse(),
      summary: calculateMonthlySummary(key, balances, transactions, categories),
    }))
  }, [balances, configurations, monthKey, today, trackingStart, transactions])

  useEffect(() => localStorage.setItem(transactionsStorageKey, JSON.stringify(transactions)), [transactions])
  useEffect(() => localStorage.setItem(dayCompletionsStorageKey, JSON.stringify(completions)), [completions])
  useEffect(() => { if (selectedCategory) inputRef.current?.focus() }, [selectedCategory])
  useEffect(() => {
    const dialog = drawerRef.current
    if (drawer && dialog && !dialog.open) dialog.showModal()
  }, [drawer])
  useEffect(() => {
    const closeMenu = (event: KeyboardEvent | PointerEvent) => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return
      if (event instanceof PointerEvent && (event.target as Element).closest('.transaction-menu')) return
      setOpenMenuId(null)
    }
    document.addEventListener('keydown', closeMenu)
    document.addEventListener('pointerdown', closeMenu)
    return () => { document.removeEventListener('keydown', closeMenu); document.removeEventListener('pointerdown', closeMenu) }
  }, [])

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
  const resetEntry = () => { setAmount(''); setNote(''); setSelectedCategory(null) }
  const changed = () => { if (historicalChange) { setNotice('Later daily balances were recalculated.'); window.setTimeout(() => setNotice(''), 3500) } }
  function addExpense() {
    if (!selectedCategory) return
    const amountCents = parseMoneyToCents(amount)
    if (amountCents === null) return
    const normalizedNote = note.trim()
    setTransactions((all) => [...all, { id: createId(), date: activeDate, category: selectedCategory, amountCents, ...(normalizedNote ? { note: normalizedNote } : {}) }]); resetEntry(); changed()
  }
  function saveTransaction(id: string) {
    const amountCents = parseMoneyToCents(editingAmount)
    if (amountCents === null) return
    const normalizedNote = editingNote.trim()
    setTransactions((all) => all.map((item) => item.id === id ? { ...item, amountCents, category: editingCategory, note: normalizedNote || undefined } : item)); setEditingId(null); changed()
  }
  function deleteTransaction(id: string) { setTransactions((all) => all.filter((item) => item.id !== id)); setEditingId(null); setOpenMenuId(null); changed() }
  function navigate(next: View, date = today) { setView(next); setSelectedDate(date); setEditingId(null); setOpenMenuId(null); resetEntry(); setNotice('') }

  function openDrawer(month: string, category: string, trigger: HTMLButtonElement) {
    drawerTriggerRef.current = trigger
    setDrawer({ month, category })
    setEditingId(null)
    setOpenMenuId(null)
  }

  function closeDrawer() { drawerRef.current?.close() }

  function finishClosingDrawer() {
    setDrawer(null)
    setEditingId(null)
    setOpenMenuId(null)
    requestAnimationFrame(() => drawerTriggerRef.current?.focus())
  }

  function beginEditing(transaction: DatedTransaction) {
    setEditingId(transaction.id)
    setEditingAmount(String(transaction.amountCents / 100))
    setEditingCategory(transaction.category)
    setEditingNote(transaction.note ?? '')
    setOpenMenuId(null)
  }

  function saveSettings(amountCents: number, rounding: RoundingPreference) {
    saveConfiguration({ version: 1, amountCents, monthKey, setupDate: today, interpretation: 'remaining-month', rounding })
  }

  function transactionRow(transaction: DatedTransaction, showDate = false, canEdit = editable) {
    return <div className={`transaction-row${editingId === transaction.id ? ' transaction-row--editing' : ''}${openMenuId === transaction.id ? ' transaction-row--menu-open' : ''}`} data-category={transaction.category} key={transaction.id}>{editingId === transaction.id ? <form className="transaction-edit" onSubmit={(event) => { event.preventDefault(); saveTransaction(transaction.id) }} onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); setEditingId(null) } }}><label>Amount<span className="transaction-row__input-wrap"><span aria-hidden="true">$</span><input className="transaction-row__input" inputMode="decimal" value={editingAmount} onChange={(event) => setEditingAmount(event.target.value)} autoFocus /></span></label><label>Category<select value={editingCategory} onChange={(event) => setEditingCategory(event.target.value)}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label className="transaction-edit__note">Note<input type="text" value={editingNote} onChange={(event) => setEditingNote(event.target.value)} /></label><div className="transaction-row__actions"><button type="submit">Save</button><button type="button" onClick={() => setEditingId(null)}>Cancel</button></div></form> : <><div className="transaction-row__labels"><strong>{transaction.note || transaction.category}</strong>{transaction.note && <small>{transaction.category}</small>}{showDate && <time dateTime={transaction.date}>{formatDate(transaction.date)}</time>}</div><span className="transaction-row__amount">{money(transaction.amountCents)}</span>{canEdit && <div className="transaction-menu"><button className="transaction-menu__trigger" type="button" aria-label={`Transaction actions for ${transaction.note || transaction.category}`} aria-haspopup="menu" aria-expanded={openMenuId === transaction.id} onClick={() => setOpenMenuId((open) => open === transaction.id ? null : transaction.id)}>•••</button>{openMenuId === transaction.id && <div className="transaction-menu__popover" role="menu"><button role="menuitem" onClick={() => beginEditing(transaction)}>Edit</button><button className="transaction-row__delete" role="menuitem" onClick={() => deleteTransaction(transaction.id)}>Delete</button></div>}</div>}</>}</div>
  }

  if (view === 'settings') return <main className="today"><PrimaryNav view={view} navigate={navigate} /><Settings configuration={currentConfiguration!} today={today} onSave={saveSettings} /></main>

  if (view === 'history') {
    const drawerTransactions = drawer ? transactions.filter((transaction) => transaction.category === drawer.category && transaction.date.slice(0, 7) === drawer.month && balanceMap.has(transaction.date)).sort((a, b) => b.date.localeCompare(a.date)) : []
    const drawerTotal = drawerTransactions.reduce((sum, transaction) => sum + transaction.amountCents, 0)
    return <><main className="today history"><PrimaryNav view={view} navigate={navigate} /><header className="history__header"><p className="setup__eyebrow">Your days</p><h1>History</h1><p>Every budgeting day, newest first.</p></header>{historyMonths.map((month) => <section className="history-month" aria-labelledby={`month-${month.key}`} key={month.key}><h2 id={`month-${month.key}`}>{formatMonth(month.key)}</h2><MonthlyHistorySummary summary={month.summary} current={month.key === monthKey} onSelectCategory={(category, trigger) => openDrawer(month.key, category, trigger)} /><div className="history-month__days">{month.days.map((day) => <button className="history-row" key={day.date} onClick={() => navigate('detail', day.date)}><span><strong>{formatDate(day.date)}</strong><small>{day.spentCents ? `${money(day.spentCents)} spent` : 'No spending'}</small></span><span className="history-row__balance">{money(day.endingBalanceCents)} <span aria-hidden="true">→</span></span></button>)}</div></section>)}</main><dialog ref={drawerRef} className="category-drawer" aria-labelledby="drawer-title" aria-describedby="drawer-summary" onClose={finishClosingDrawer} onClick={(event) => { if (event.target === event.currentTarget) closeDrawer() }}>{drawer && <div className="category-drawer__panel"><header className="category-drawer__header"><div><p className="setup__eyebrow">{formatMonth(drawer.month)}</p><h2 id="drawer-title">{drawer.category}</h2><p id="drawer-summary"><strong>{money(drawerTotal)}</strong> spent in {formatMonth(drawer.month)}</p></div><button className="category-drawer__close" type="button" aria-label="Close category transactions" onClick={closeDrawer}>×</button></header><div className="category-drawer__content"><div className="transaction-list">{drawerTransactions.map((transaction) => transactionRow(transaction, true, drawer.month === monthKey))}</div></div></div>}</dialog></>
  }

  return <main className="today"><PrimaryNav view={isToday ? 'today' : 'history'} navigate={navigate} />{!isToday && <button className="back-button" onClick={() => navigate('history')}>← Back to History</button>}<header className="today__header"><p className="today__date">{formatDate(activeDate)}</p><div className="balance"><h1 className="balance__amount">{money(activeBalance.endingBalanceCents)}</h1><p className="balance__label">{isToday ? 'available today' : 'ending balance'}</p><p className="balance__rollover">Includes {money(activeBalance.priorBalanceCents)} from the prior day</p></div></header>
  {editable ? <><div className="categories" aria-label="Expense categories">{categories.map((category) => <CategoryButton key={category} label={category} selected={selectedCategory === category} onClick={() => setSelectedCategory(category)} />)}</div>{selectedCategory && <section className="expense-entry" aria-labelledby="expense-title"><h2 className="expense-entry__title" id="expense-title">{selectedCategory}</h2><form onSubmit={(event) => { event.preventDefault(); addExpense() }}><label className="expense-entry__label">Amount<input ref={inputRef} className="expense-entry__input" inputMode="decimal" placeholder="$0" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label className="expense-entry__label expense-entry__label--note">Note<input className="expense-entry__note" type="text" value={note} onChange={(event) => setNote(event.target.value)} /></label><button className="expense-entry__button" type="submit">Add {amount ? `$${amount}` : '$0'}</button></form></section>}</> : <p className="read-only" role="note">Previous months are view only.</p>}
  {notice && <p className="recalculation-notice" role="status">{notice}</p>}
  <section className="spending" aria-labelledby="spending-title"><h2 className="spending__title" id="spending-title">{isToday ? "Today's spending" : 'Spending'}</h2>{dayTransactions.length === 0 ? <p className="spending__empty">No spending logged for this day.</p> : <div className="transaction-list">{dayTransactions.map((transaction) => transactionRow(transaction))}</div>}</section>
  {isToday && <section className={`day-finish${completions[today] ? ' day-finish--complete' : ''}`}>{completions[today] ? <div className="day-complete" role="status"><div className="celebration" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <span key={i} />)}</div><p className="day-complete__eyebrow">Checked in</p><h2 className="day-complete__title">Day complete.</h2><p className="day-complete__rollover"><strong>{money(activeBalance.endingBalanceCents)}</strong> rolls into tomorrow.</p></div> : <button className="day-finish__button" onClick={() => setCompletions((all) => ({ ...all, [today]: true }))}><span>Finish my day</span><span className="day-finish__button-mark" aria-hidden="true">✓</span></button>}</section>}</main>
}

function PrimaryNav({ view, navigate }: { view: View; navigate: (view: View, date?: string) => void }) { return <nav className="primary-nav" aria-label="Primary"><button aria-current={view === 'today' ? 'page' : undefined} onClick={() => navigate('today')}>Today</button><button aria-current={view === 'history' || view === 'detail' ? 'page' : undefined} onClick={() => navigate('history')}>History</button><button aria-current={view === 'settings' ? 'page' : undefined} onClick={() => navigate('settings')}>Settings</button></nav> }
export default App
