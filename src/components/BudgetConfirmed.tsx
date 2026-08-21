import { getDailyAllocationCents, getMonthDetails, getPeriodDays, type BudgetConfiguration } from '../budget'

type Props = {
  configuration: BudgetConfiguration
  spentCents: number
  onContinue: () => void
}

const currency = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

const money = (cents: number) => currency.format(cents / 100)

function BudgetConfirmed({ configuration, spentCents, onContinue }: Props) {
  const setupDate = new Date(`${configuration.setupDate}T12:00:00`)
  const month = getMonthDetails(setupDate)
  const days = getPeriodDays(configuration.interpretation, setupDate)
  const dailyCents = getDailyAllocationCents(configuration.amountCents, days, configuration.rounding)
  const remainingCents = configuration.amountCents - spentCents

  return <main className="confirmation">
    <header className="confirmation__header">
      <p className="setup__eyebrow">All locked in!</p>
      <h1>You're ready to<br />roll, Champ!</h1>
      <p>Your custom daily allowance is<br />calculated and set.</p>
    </header>

    <section className="allowance-card" aria-labelledby="allowance-title">
      <p className="allowance-card__label" id="allowance-title">Your daily track</p>
      <p className="allowance-card__amount">{money(dailyCents)}</p>
      <p className="allowance-card__caption">to spend every single day</p>
      <dl>
        <div><dt>Total allocation</dt><dd>{money(configuration.amountCents)}</dd></div>
        <div><dt>Time frame</dt><dd>{days} Days ({month.monthName})</dd></div>
      </dl>
    </section>

    <section className="dashboard-preview" aria-labelledby="dashboard-title">
      <h2 id="dashboard-title">Your live monthly dashboard</h2>
      <div className="dashboard-preview__card">
        <dl>
          <div><dt>Budgeted</dt><dd>{money(configuration.amountCents)}</dd></div>
          <div><dt>Spent</dt><dd>{money(spentCents)}</dd></div>
          <div><dt>Remaining</dt><dd>{money(remainingCents)}</dd></div>
        </dl>
        <p>Donut breakdown updates as you spend!</p>
      </div>
    </section>

    <aside className="rollover-tip"><span aria-hidden="true">!</span><p><strong>Tip:</strong> Your {money(dailyCents)} allowance rolls over to tomorrow if you don't spend it all today!</p></aside>
    <button className="confirmation__submit" type="button" onClick={onContinue}>Let's start tracking! <span aria-hidden="true">→</span></button>
  </main>
}

export default BudgetConfirmed
