import { useState } from 'react'
import {
  getMonthDetails,
  parseMoneyToCents,
  type BudgetConfiguration,
  type RoundingPreference,
} from '../budget'

const currency = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 })
const labels: Record<RoundingPreference, string> = { exact: 'Exact', down: 'Round Down', up: 'Round Up' }

type Props = {
  configuration: BudgetConfiguration
  today: string
  onSave: (amountCents: number, rounding: RoundingPreference) => void
}

export default function Settings({ configuration, today, onSave }: Props) {
  const month = getMonthDetails(new Date(`${today}T12:00:00`))
  const [editing, setEditing] = useState(false)
  const [amount, setAmount] = useState(String(configuration.amountCents / 100))
  const [rounding, setRounding] = useState(configuration.rounding)
  const [error, setError] = useState(false)
  const [saved, setSaved] = useState(false)

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const amountCents = parseMoneyToCents(amount)
    if (amountCents === null) { setError(true); return }
    onSave(amountCents, rounding)
    setEditing(false)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 3500)
  }

  return <section className="settings" aria-labelledby="settings-title">
    <header className="settings__header"><p className="setup__eyebrow">Current month</p><h1 id="settings-title">Settings</h1><p>{month.monthName} {today.slice(0, 4)}</p></header>
    {!editing ? <div className="settings-card">
      <dl><div><dt>Current spending amount</dt><dd>{currency.format(configuration.amountCents / 100)}</dd></div><div><dt>Rounding preference</dt><dd>{labels[configuration.rounding]}</dd></div></dl>
      <button className="setup__submit" onClick={() => { setAmount(String(configuration.amountCents / 100)); setRounding(configuration.rounding); setEditing(true); setSaved(false) }}>Edit current month <span aria-hidden="true">→</span></button>
    </div> : <form className="settings-card" onSubmit={submit} noValidate>
      <h2>Update {month.monthName}</h2>
      <label className="settings__label" htmlFor="settings-amount">Amount available from today through {month.monthName} {month.totalDays}</label>
      <label className="money-input"><span aria-hidden="true">$</span><input id="settings-amount" autoFocus inputMode="decimal" value={amount} aria-invalid={error} aria-describedby={error ? 'settings-error' : 'settings-note'} onChange={(event) => { setAmount(event.target.value); setError(false) }} /></label>
      {error && <p className="setup__error" id="settings-error" role="alert">Enter an amount greater than $0, with up to two decimal places.</p>}
      <fieldset><legend>Rounding preference</legend><div className="rounding-grid">{(Object.keys(labels) as RoundingPreference[]).map((value) => <label className="rounding-card" key={value}><input type="radio" name="settings-rounding" checked={rounding === value} onChange={() => setRounding(value)} /><span><strong>{labels[value]}</strong></span></label>)}</div></fieldset>
      <p className="settings__note" id="settings-note">Your update begins today. Previous days will not change.</p>
      <div className="settings__actions"><button className="setup__submit" type="submit">Save update <span aria-hidden="true">→</span></button><button className="secondary-button" type="button" onClick={() => setEditing(false)}>Cancel</button></div>
    </form>}
    {saved && <p className="recalculation-notice" role="status">Current month settings saved.</p>}
  </section>
}
