import { useMemo, useState, type ReactNode } from 'react'
import { Sheet } from '../components/ui'
import { personNames, TEAM_PASSWORD } from '../lib/analytics'
import { fmtDay, fmtTime, now, SIM } from '../lib/logic'
import { buildReport, frac, pct, type Ratio } from '../lib/metrics'
import { useStore } from '../lib/store'

type Status = 'good' | 'bad' | 'na'
const st = (v: number | null, ok: (v: number) => boolean): Status => (v === null ? 'na' : ok(v) ? 'good' : 'bad')
const Pill = ({ s }: { s: Status }) => (
  <span className={`mpill mpill-${s}`}>{s === 'good' ? '✓ on target' : s === 'bad' ? '✕ below target' : '– no data yet'}</span>
)
const R = ({ r }: { r: Ratio }) => (r.value === null ? <span className="muted">—</span> : <><strong>{pct(r)}</strong> <span className="muted small">({frac(r)})</span></>)

/**
 * The button the team uses to open analytics: at the bottom of the Flat tab (and of Didi's screen).
 * It asks for the team password every time; flatmates and cooks have no reason to tap it.
 */
export function AnalyticsEntry() {
  const { metrics } = useStore()
  const [asking, setAsking] = useState(false)
  const [pw, setPw] = useState('')
  const [wrong, setWrong] = useState(false)
  const close = () => { setAsking(false); setPw(''); setWrong(false) }
  const submit = () => {
    if (pw.trim() === TEAM_PASSWORD) {
      close()
      metrics.setOpen(true)
    } else setWrong(true)
  }
  return (
    <>
      <button type="button" className="btn btn-outline btn-block" onClick={() => setAsking(true)}>🔒 Analytics</button>
      <Sheet open={asking} onClose={close} title="Analytics">
        <p className="muted small">For the Rasoi Ready team only. Enter the team password.</p>
        <form className="pw-form" onSubmit={(e) => { e.preventDefault(); submit() }}>
          <input type="password" autoFocus value={pw} onChange={(e) => { setPw(e.target.value); setWrong(false) }} placeholder="Password" aria-label="Password" autoComplete="off" />
          {wrong && <p className="err small">That password isn't right.</p>}
          <button type="submit" className="btn btn-primary btn-block" disabled={!pw}>Open analytics</button>
        </form>
      </Sheet>
    </>
  )
}

/**
 * The team's analytics (tracking spec, section 8): the North Star, its inputs, the GAME goals and the
 * guardrails, with the count beside every percentage. It covers every day played so far, or one day,
 * and is rebuilt from the events on each render, so it updates live as the evening runs.
 */
export function MetricsView() {
  const { db, metrics, flat: myFlat, time } = useStore()
  const flatsWithData = db.flats.filter((f) => (db.events ?? []).some((e) => e.flat_id === f.id))
  const [flatId, setFlatId] = useState(myFlat?.id ?? flatsWithData[0]?.id ?? '')
  const [day, setDay] = useState<'all' | string>('all')
  const today = now(db).date
  const flat = db.flats.find((f) => f.id === flatId)
  const r = useMemo(() => (flat ? buildReport(db, flat.id, today, day) : null), [db, flat, today, day])
  const names = useMemo(() => personNames(db), [db])
  const log = useMemo(() => [...(db.events ?? [])].filter((e) => e.flat_id === flatId && (day === 'all' || e.evening_date === day)).reverse(), [db, flatId, day])
  const nDays = r?.days.length ?? 0
  // Tonight is counted as it happens; say so until the evening ends.
  const running = !!r?.days.some((x) => x.date === today) && today >= (r?.range.start ?? '') && today <= (r?.range.end ?? '') && time < SIM.end
  const picked = r?.days.find((x) => x.date === day)
  const scope = day === 'all' ? `All ${nDays} day${nDays === 1 ? '' : 's'}` : picked ? `Day ${picked.n}` : 'This day'

  const download = (name: string, text: string, type: string) => {
    try {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([text], { type }))
      a.download = name
      a.click()
    } catch {
      /* blocked in some frames */
    }
  }
  const clean = log.map(({ _once, ...e }) => { void _once; return e })
  const csv = () => {
    const cols = ['event_id', 'event_name', 'occurred_at', 'evening_date', 'flat_id', 'person_id', 'role', 'is_owner_tonight', 'ui_language', 'app_version', 'platform', 'is_simulated']
    const rows = clean.map((e) => [...cols.map((c) => String((e as unknown as Record<string, unknown>)[c] ?? '')), JSON.stringify(e.props)].map((v) => `"${v.replace(/"/g, '""')}"`).join(','))
    return [[...cols, 'props'].join(','), ...rows].join('\n')
  }

  return (
    <div className="metrics-wrap" role="dialog" aria-label="Metrics">
      <div className="metrics">
        <header className="m-head">
          <div>
            <div className="eyebrow">Team only · <span className="live-dot" /> live</div>
            <h2>Rasoi Ready analytics</h2>
            <p className="muted small">Built from the events of the days played in this browser, as the analytics spec defines them. Each day appears as soon as its evening starts and fills in as it runs.</p>
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => metrics.setOpen(false)}>Close</button>
        </header>

        <div className="m-controls">
          <label>Flat <select value={flatId} onChange={(e) => setFlatId(e.target.value)}>{db.flats.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
          <div className="m-days" role="tablist" aria-label="Days">
            <button type="button" className={`chip ${day === 'all' ? 'chip-on' : ''}`} onClick={() => setDay('all')}>All days</button>
            {r?.days.map((x) => (
              <button key={x.date} type="button" className={`chip ${day === x.date ? 'chip-on' : ''}`} onClick={() => setDay(x.date)}>Day {x.n}</button>
            ))}
          </div>
        </div>

        {!r || !r.rows.length ? (
          <p className="callout">No days played yet. Close this, press ▶ Simulate, and Day 1 shows up here as the evening runs. After midnight, Next day adds Day 2.</p>
        ) : (
          <>
            <p className="m-scope"><strong>{scope}</strong> · {r.range.start === r.range.end ? fmtDay(r.range.start, '') : `${fmtDay(r.range.start, '')} to ${fmtDay(r.range.end, '')}`}{running ? ' · tonight still running' : ''}</p>

            <section className="m-grid">
              <div className="m-card m-ns">
                <div className="card-title">North Star · ready cook visits</div>
                <div className="m-big">{r.northStar.ready}<span> {day === 'all' ? `in ${nDays} day${nDays === 1 ? '' : 's'}` : 'on this day'}</span></div>
                <p className="small">Ready share <R r={r.northStar.share} /> · {r.northStar.noNoteDays} day{r.northStar.noNoteDays === 1 ? '' : 's'} with no note (never ready)</p>
                <p className="muted small">{day === 'all' ? 'Target: rises week on week. The day-by-day table below shows the trend.' : r.northStar.prevDayReady === null ? 'Day 1: nothing before it to compare.' : `Day before: ${r.northStar.prevDayReady}.`}</p>
              </div>
              <Input title="01 · Active flat" value={r.inputs.active ? 'Yes' : 'No'} note={day === "all" ? "A cook note in these days" : "A cook note on this day"} s={r.inputs.active ? 'good' : 'bad'} />
              <Input title="02 · Note coverage" value={<R r={r.inputs.noteCoverage} />} note="Note by 8 pm ÷ cook visit days · target 5 of 7" s={st(r.inputs.noteCoverage.value, (v) => v >= 5 / 7)} />
              <Input title="03 · Order-through" value={<R r={r.inputs.orderThrough} />} note="Ordered before the next visit · pass rule 70%" s={st(r.inputs.orderThrough.value, (v) => v >= 0.7)} />
              <Input title="Came back" value={<R r={r.inputs.cameBack} />} note="Notes sent without a prompt · watched, no target" s="na" />
            </section>

            <Table scopeLabel={scope} title="G1 · The cook finds everything she needs" rows={[
              ['First note within 3 days of setup', r.g1.firstNoteWithin3.days === null ? '—' : `${r.g1.firstNoteWithin3.days} day${r.g1.firstNoteWithin3.days === 1 ? '' : 's'}`, '3 of 5 flats', r.g1.firstNoteWithin3.ok === null ? 'na' : r.g1.firstNoteWithin3.ok ? 'good' : 'bad', 'Meet cooks in person'],
              ['"Something missing" visits', <><R r={r.g1.missing} />{r.g1.missingBaseline && <span className="muted small"> · first 7 days: {pct(r.g1.missingBaseline)}</span>}</>, '50% drop vs the first 7 days', r.g1.missingBaseline && r.g1.missingBaseline.value ? st(r.g1.missing.value, (v) => v <= r.g1.missingBaseline!.value! / 2) : 'na', 'Change how the list is collected'],
            ]} />
            <Table scopeLabel={scope} title="G2 · Nobody is the one who always orders" rows={[
              ['Flatmates in the rotation', <R r={r.g2.rotation} />, '100%', st(r.g2.rotation.value, (v) => v >= 1), 'Ask why in person'],
              ['Owner orders after one reminder', <R r={r.g2.afterReminder} />, '80% or more', st(r.g2.afterReminder.value, (v) => v >= 0.8), 'Change timing or wording; never a second reminder'],
              ['Order concentration (last 14 days)', r.g2.concentration.applies ? <R r={r.g2.concentration} /> : <span className="muted">flat of fewer than 3</span>, '50% or less', r.g2.concentration.applies ? st(r.g2.concentration.value, (v) => v <= 0.5) : 'na', 'Change how turns are assigned'],
              ['Duplicate buys (last 14 days)', String(r.g2.duplicates), 'fewer than 2', r.g2.duplicates < 2 ? 'good' : 'bad', 'Tighten the single-owner rule'],
              ['Fee split across all flatmates', <R r={r.g2.feeSplit} />, 'every paying flat', st(r.g2.feeSplit.value, (v) => v >= 1), 'Offer per-head billing'],
            ]} />
            <Table scopeLabel={scope} title="G3 · Tomorrow's dish is settled in advance" rows={[
              ['Usual-dish list (10+ dishes)', `${r.g3.dishList.count} dishes`, '4 of 5 flats', r.g3.dishList.ok ? 'good' : 'bad', "Build the list from the cook's notes"],
              ['Dish named by 8 pm', <R r={r.g3.dishNamed} />, '50% or more', st(r.g3.dishNamed.value, (v) => v >= 0.5), 'Ask only what is low'],
              ['Suggestion accepted', <R r={r.g3.suggestionAccepted} />, '40% or more', st(r.g3.suggestionAccepted.value, (v) => v >= 0.4), 'Default to "repeat last week"'],
              ['Planned dish cooked', <R r={r.g3.plannedCooked} />, '70% or more', st(r.g3.plannedCooked.value, (v) => v >= 0.7), 'Ask the cooks what changed'],
              ['Dish suggestion as a reason to pay', String(r.g3.dishReasonToPay), 'at least one flat', r.g3.dishReasonToPay > 0 ? 'good' : 'na', 'Keep it free as a retention feature'],
            ]} />
            <Table scopeLabel={scope} title="Guardrails" stop rows={[
              ['Asks per person per day (max)', String(r.guardrails.asksMax), 'stop at 2', r.guardrails.asksMax >= 2 ? 'bad' : 'good', r.guardrails.asksOver.length ? `Talk to the flat: ${r.guardrails.asksOver.map((a) => a.date).join(', ')}` : 'Stop and talk to that flat within 48 hours'],
              ['Opt-outs (muted or left)', String(r.guardrails.optOuts), 'any', r.guardrails.optOuts > 0 ? 'bad' : 'good', 'Talk to that flat within 48 hours'],
              ['Duplicate or spoiled items (last 14 days)', String(r.guardrails.dupSpoiled), 'stop at 2', r.guardrails.dupSpoiled >= 2 ? 'bad' : 'good', 'Tighten the quantities on the list'],
              ['Freshness complaints this week', String(r.guardrails.freshness), 'any repeat', r.guardrails.freshness >= 2 ? 'bad' : 'good', 'Vegetables move to a same-morning order'],
            ]} />
            <Table scopeLabel={scope} title="Money" rows={[
              ['Pre-pay rate at ₹149', <R r={r.money.prepay} />, '2 of 5 flats', st(r.money.prepay.value, (v) => v > 0), 'Re-ask at ₹99 in MVP 2'],
              ['Time from note to list (median)', r.money.noteToList === null ? '—' : `${r.money.noteToList} min`, 'falls as the flow is automated', 'na', 'Look at the owner fallback rate'],
              ['Time from note to order (median)', r.money.noteToOrder === null ? '—' : `${r.money.noteToOrder} min`, 'falls', 'na', 'Review the order sheet steps'],
            ]} />

            <section className="m-section">
              <h3>Effort · taps per task</h3>
              <p className="muted small">Median of task_completed, against the prototype test counts. A release that raises a median above its bar is reviewed.</p>
              <div className="m-table-wrap">
                <table className="m-table">
                  <thead><tr><th>Task</th><th>Runs</th><th>Median taps</th><th>Median typing</th><th>Bar</th><th>Abandoned</th><th /></tr></thead>
                  <tbody>
                    {r.effort.map((t) => {
                      const s: Status = t.taps === null ? 'na' : t.taps <= t.bar.taps && (t.chars ?? 0) <= t.bar.chars ? 'good' : 'bad'
                      return (
                        <tr key={t.task}>
                          <td>{t.label}</td><td>{t.n}</td><td>{t.taps ?? '—'}</td><td>{t.chars ?? '—'}</td>
                          <td className="muted">{t.bar.taps} taps{t.bar.chars ? `, ${t.bar.chars} chars` : ''}</td><td>{t.abandoned}</td><td><Pill s={s} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="m-section">
              <h3>Day by day</h3>
              <p className="muted small">The derived flat_evening table: one row per day played, Day 1 first. Tap a day above to see only its numbers.</p>
              <div className="m-table-wrap">
                <table className="m-table">
                  <thead><tr><th>Day</th><th>Note</th><th>Dish</th><th>List</th><th>Owner</th><th>Ordered</th><th>Received</th><th>Most asks</th><th>Visit ready?</th></tr></thead>
                  <tbody>
                    {r.days.map((row) => (
                      <tr key={row.date} className={`${row.isVisitDay ? '' : 'm-off'} ${row.date === day ? 'm-picked' : ''}`}>
                        <td><strong>Day {row.n}</strong> <span className="muted small">{fmtDay(row.date, '')}</span></td>
                        <td>{!row.isVisitDay ? 'day off' : row.noteMinutesVs8 === null ? '—' : `${row.noteMinutesVs8 <= 0 ? 'on time' : `${row.noteMinutesVs8} min late`}${row.notePrompted === false ? ' · unprompted' : ''}`}</td>
                        <td>{row.dishMethod ? row.dishMethod.replace('_', ' ') : '—'}</td>
                        <td>{row.list ? `${row.listItems} items` : '—'}</td>
                        <td>{names.get(row.ownerPid) ?? '—'}{row.handedOver ? ' (handed over)' : ''}</td>
                        <td>{row.ordered ? `${fmtTime(istTime(row.ordered.occurred_at))} · ${names.get(row.ordered.person_id) ?? ''}` : row.listItems ? '✕ not ordered' : '—'}</td>
                        <td>{row.received ? fmtTime(istTime(row.received.occurred_at)) : '—'}</td>
                        <td>{row.asksMax}</td>
                        <td>{row.ready === null ? '—' : row.ready ? '✓' : `✕${row.topUp ? ' (top-up)' : ''}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        <section className="m-section">
          <div className="row between wrap gap8">
            <h3>Event log · {log.length} events</h3>
            <div className="row gap8 wrap">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => navigator.clipboard?.writeText(JSON.stringify(clean, null, 1)).catch(() => {})}>Copy JSON</button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => download('rasoi-ready-events.json', JSON.stringify(clean, null, 1), 'application/json')}>Download JSON</button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => download('rasoi-ready-events.csv', csv(), 'text/csv')}>Download CSV</button>
            </div>
          </div>
          <p className="muted small">Newest first{day === 'all' ? '' : `, ${scope} only`}. Every event carries the common properties (event_id, occurred_at in UTC, evening_date, flat_id, hashed person_id, role, is_owner_tonight, ui_language, app_version, platform). Names are shown here for the team only; they are never stored in events.</p>
          <div className="m-table-wrap m-log">
            <table className="m-table">
              <thead><tr><th>Event</th><th>Evening</th><th>Time</th><th>Who</th><th>Properties</th></tr></thead>
              <tbody>
                {log.slice(0, 150).map((e) => (
                  <tr key={e.event_id}>
                    <td><code>{e.event_name}</code></td>
                    <td>{fmtDay(e.evening_date, today)}</td>
                    <td>{fmtTime(istTime(e.occurred_at))}</td>
                    <td>{names.get(e.person_id) ?? (e.person_id ? 'someone' : 'server')}{e.is_owner_tonight ? ' · owner' : ''}</td>
                    <td className="m-props">{Object.entries(e.props).map(([k, v]) => `${k}: ${Array.isArray(v) ? `[${v.join(', ')}]` : String(v)}`).join(' · ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}

const istTime = (utc: string) => {
  const d = new Date(new Date(utc).getTime() + 330 * 60000)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

function Input({ title, value, note, s }: { title: string; value: ReactNode; note: string; s: Status }) {
  return (
    <div className="m-card">
      <div className="card-title">{title}</div>
      <div className="m-val">{value}</div>
      <p className="muted small">{note}</p>
      <Pill s={s} />
    </div>
  )
}

function Table({ title, rows, stop, scopeLabel }: { title: string; rows: [string, ReactNode, string, Status, string][]; stop?: boolean; scopeLabel: string }) {
  return (
    <section className="m-section">
      <h3>{title}</h3>
      <div className="m-table-wrap">
        <table className="m-table">
          <thead><tr><th>Metric</th><th>{scopeLabel}</th><th>{stop ? 'Stop-work threshold' : 'Target'}</th><th>Status</th><th>If it misses</th></tr></thead>
          <tbody>
            {rows.map(([m, v, t, s, a]) => (
              <tr key={m}><td>{m}</td><td>{v}</td><td className="muted">{t}</td><td><Pill s={s} /></td><td className="muted small">{a}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
