import { useMemo, useState } from 'react'
import {
  getDailyAllocationCents,
  getLocalDateKey,
  getMonthDetails,
  getPeriodDays,
  parseMoneyToCents,
  type BudgetConfiguration,
  type BudgetInterpretation,
  type RoundingPreference,
} from '../budget'

type Props = { onComplete: (configuration: BudgetConfiguration) => void }

const currency = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

function BudgetSetup({ onComplete }: Props) {
  const today = useMemo(() => new Date(), [])
  const month = getMonthDetails(today)
  const [amount, setAmount] = useState('')
  const [interpretation, setInterpretation] =
    useState<BudgetInterpretation>('remaining-month')
  const [rounding, setRounding] = useState<RoundingPreference>('exact')
  const [showError, setShowError] = useState(false)
  const amountCents = parseMoneyToCents(amount)
  const days = getPeriodDays(interpretation, today)
  const exactDailyPreview =
    amountCents === null
      ? null
      : getDailyAllocationCents(amountCents, days, 'exact')

  const choices: Array<{ value: RoundingPreference; label: string }> = [
    { value: 'exact', label: 'Exact' },
    { value: 'down', label: 'Round down' },
    { value: 'up', label: 'Round up' },
  ]

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (amountCents === null) {
      setShowError(true)
      return
    }
    onComplete({
      version: 1,
      amountCents,
      monthKey: month.monthKey,
      setupDate: getLocalDateKey(today),
      interpretation,
      rounding,
    })
  }

  return (
    <main className="setup">
      <header className="setup__header">
        <p className="setup__eyebrow">Your spending game plan</p>
        <h1>Let&apos;s find your daily number.</h1>
        <p>Two quick choices, then you&apos;re ready to roll.</p>
      </header>

      <form onSubmit={submit} noValidate>
        <section className="setup-card setup-card--amount" aria-labelledby="amount-title">
          <span className="setup-card__number" aria-hidden="true">1</span>
          <h2 id="amount-title">How much can you spend this month?</h2>
          <label className="money-input">
            <span aria-hidden="true">$</span>
            <input
              autoFocus
              inputMode="decimal"
              placeholder="1,500"
              aria-label="Monthly spending budget in dollars"
              aria-invalid={showError && amountCents === null}
              aria-describedby={showError ? 'amount-error' : undefined}
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value)
                setShowError(false)
              }}
            />
          </label>
          {showError && amountCents === null && (
            <p className="setup__error" id="amount-error" role="alert">
              Enter an amount greater than $0, with up to two decimal places.
            </p>
          )}
          {exactDailyPreview !== null && (
            <p className="setup__daily-preview" aria-live="polite">
              That gives you{' '}
              <strong>{currency.format(exactDailyPreview / 100)} per day</strong>
              .
            </p>
          )}
        </section>

        <fieldset className="setup-card">
          <legend><span className="setup-card__number" aria-hidden="true">2</span>What does that amount represent?</legend>
          <div className="radio-stack">
            <label className="radio-card">
              <input type="radio" name="interpretation" value="remaining-month" checked={interpretation === 'remaining-month'} onChange={() => setInterpretation('remaining-month')} />
              <span><strong>Remaining month</strong><small>I have this much left for the rest of {month.monthName}.</small><em>{month.remainingDays} days, including today</em></span>
            </label>
            <label className="radio-card radio-card--yellow">
              <input type="radio" name="interpretation" value="full-month" checked={interpretation === 'full-month'} onChange={() => setInterpretation('full-month')} />
              <span><strong>Full month</strong><small>This is my budget for all of {month.monthName}.</small><em>{month.totalDays} calendar days</em></span>
            </label>
          </div>
        </fieldset>

        <fieldset className="setup-card">
          <legend><span className="setup-card__number" aria-hidden="true">3</span>How should I show your daily amount?</legend>
          <div className="rounding-grid">
            {choices.map((choice) => {
              const preview = amountCents === null ? null : getDailyAllocationCents(amountCents, days, choice.value)
              return (
                <label className="rounding-card" key={choice.value}>
                  <input type="radio" name="rounding" value={choice.value} checked={rounding === choice.value} onChange={() => setRounding(choice.value)} />
                  <span><strong>{choice.label}</strong><small>{preview === null ? '—' : currency.format(preview / 100)}</small></span>
                </label>
              )
            })}
          </div>
          <p className="setup-card__note">Your total stays the same. Any rounding difference is saved for the final day.</p>
        </fieldset>

        <button className="setup__submit" type="submit">Set my budget <span aria-hidden="true">→</span></button>
      </form>
    </main>
  )
}

export default BudgetSetup
