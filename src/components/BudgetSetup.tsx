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

type Props = { onComplete: (configuration: BudgetConfiguration) => void; initialAmountCents?: number; initialRounding?: RoundingPreference; newMonth?: boolean; onCancel?: () => void }

const currency = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

function BudgetSetup({ onComplete, initialAmountCents, initialRounding = 'down', newMonth = false, onCancel }: Props) {
  const today = useMemo(() => new Date(), [])
  const month = getMonthDetails(today)
  const [amount, setAmount] = useState(initialAmountCents ? String(initialAmountCents / 100) : '')
  const [interpretation, setInterpretation] =
    useState<BudgetInterpretation>(newMonth ? 'full-month' : 'remaining-month')
  const [rounding, setRounding] = useState<RoundingPreference>(initialRounding)
  const [showError, setShowError] = useState(false)
  const amountCents = parseMoneyToCents(amount)
  const days = getPeriodDays(interpretation, today)
  const exactDailyPreview =
    amountCents === null
      ? null
      : getDailyAllocationCents(amountCents, days, 'exact')

  const choices: Array<{ value: RoundingPreference; label: string }> = [
    { value: 'down', label: 'Round down' },
    { value: 'exact', label: 'Exact' },
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
    <main className={`setup${amountCents !== null ? ' setup--active' : ''}`}>
      <header className="setup__header">
        <p className="setup__eyebrow">{newMonth ? `New month · ${month.monthName}` : 'Your spending game plan'}</p>
        <h1>{newMonth ? `Set ${month.monthName}'s amount.` : 'Let\'s find your daily number.'}</h1>
        <p>{newMonth ? 'Confirm your spending amount and rounding preference.' : 'Two quick choices, then you\'re ready to roll.'}</p>
      </header>

      <form onSubmit={submit} noValidate>
        <section className={`setup-card setup-card--amount${amount.trim() ? '' : ' setup-card--empty'}`} aria-labelledby="amount-title">
          {!newMonth && <span className="setup-card__number" aria-hidden="true">1</span>}
          <h2 id="amount-title">{newMonth ? `Spending amount for ${month.monthName}` : 'How much can you spend this month?'}</h2>
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
          {!newMonth && <div className="setup-card__tip"><span aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M8.3 14.5A6 6 0 1 1 15.7 14.5C14.7 15.2 14.2 16 14 17h-4c-.2-1-.7-1.8-1.7-2.5Z" /></svg></span><p>This is your balance for the month or whatever is left after rent, utilities, etc.</p></div>}
        </section>

        {!newMonth && <fieldset className="setup-card" aria-labelledby="interpretation-title">
          <h2 className="setup-card__heading" id="interpretation-title"><span className="setup-card__number" aria-hidden="true">2</span>What does that amount represent?</h2>
          <div className="radio-stack">
            <label className="radio-card radio-card--yellow">
              <input type="radio" name="interpretation" value="full-month" checked={interpretation === 'full-month'} onChange={() => setInterpretation('full-month')} />
              <span><i aria-hidden="true" /><b><strong>Full month</strong><small>This is my budget for all of {month.monthName} ({month.totalDays} days).</small></b></span>
            </label>
            <label className="radio-card">
              <input type="radio" name="interpretation" value="remaining-month" checked={interpretation === 'remaining-month'} onChange={() => setInterpretation('remaining-month')} />
              <span><i aria-hidden="true" /><b><strong>Remaining month</strong><small>I have this much left for the rest of {month.monthName}.</small></b></span>
            </label>
          </div>
        </fieldset>}

        <fieldset className="setup-card" aria-labelledby="rounding-title">
          <h2 className="setup-card__heading" id="rounding-title">{!newMonth && <span className="setup-card__number" aria-hidden="true">3</span>}How should I show your daily amount?</h2>
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

        <div className={newMonth ? 'setup__actions' : undefined}><button className="setup__submit" type="submit">{newMonth ? `Use for ${month.monthName}` : 'Set my budget'} <span aria-hidden="true">→</span></button>{newMonth && onCancel && <button className="secondary-button" type="button" onClick={onCancel}>Back</button>}</div>
      </form>
    </main>
  )
}

export default BudgetSetup
