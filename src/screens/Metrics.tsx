import { useMemo, useState, type ReactNode } from 'react'
import { personNames } from '../lib/analytics'
import { addDays, fmtDay, fmtTime, now } from '../lib/logic'
import { buildReport, frac, pct, weekOf, type Ratio } from '../lib/metrics'
import { useStore } from '../lib/store'

type Status = 'good' | 'bad' | 'na'
const st = (v: number | null, ok: (v: number) => boolean): Status => (v === null ? 'na' : ok(v) ? 'good' : 'bad')
const Pill = ({ s }: { s: Status }) => (
  <span className={`mpill mpill-${s}`}>{s === 'good' ? '✓ on target' : s === 'bad' ? '✕ below target' : '– no data yet'}</span>
)
const R = ({ r }: { r: Ratio }) => (r.value === null ? <span className="muted">—</span> : <><strong>{pct(r)}</strong> <span className="muted small">({frac(r)})</span></>)

/**
 * The team's weekly review (tracking spec, section 8 and step 8): the North Star, its inputs,
 * the GAME goals and the guardrails, read flat by flat, with the count beside every percentage.
 * A prototype tool, opened from the Simulate bar; flatmates and cooks never see it.
 */
export function MetricsView() {
  const { db, metrics, flat: myFlat } = useStore()
  const flatsWithData = db.flats.filter((f) => (db.events ?? []).some((e) => e.flat_id === f.id))
  const [flatId, setFlatId] = useState(myFlat?.id ?? flatsWithData[0]?.id ?? '')
  const [withTest, setWithTest] = useState(true)
  const [weekShift, setWeekShift] = useState(0)
  const today = now(db).date
  const asOf = weekShift ? weekOf(addDays(today, 7 * weekShift)).end : today
  const flat = db.flats.find((f) => f.id === flatId)
  const r = useMemo(() => (flat ? buildReport(db, flat.id, asOf, withTest) : null), [db, flat, asOf, withTest])
  const names = useMemo(() => personNames(db), [db])
  const log = useMemo(() => [...(db.events ?? [])].filter((e) => e.flat_id === flatId && (withTest || !e.is_simulated)).reverse(), [db, flatId, withTest])

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
            <div className="eyebrow">Team view · prototype</div>
            <h2>Rasoi Ready metrics</h2>
            <p className="muted small">Computed from the stored events, as the analytics spec defines them. Flatmates and cooks never see this page.</p>
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => metrics.setOpen(false)}>Close</button>
        </header>

        <div className="m-controls">
          <label>Flat <select value={flatId} onChange={(e) => setFlatId(e.target.value)}>{db.flats.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
          <div className="m-week">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setWeekShift(weekShift - 1)}>‹</button>
            <span>Week of {r ? fmtDay(r.week.start, '') : ''} – {r ? fmtDay(r.week.end, '') : ''}</span>
            <button type="button" className="btn btn-outline btn-sm" disabled={weekShift >= 0} onClick={() => setWeekShift(weekShift + 1)}>›</button>
          </div>
          <label className="toggle m-toggle">
            <input type="checkbox" checked={withTest} onChange={(e) => setWithTest(e.target.checked)} />
            <span><strong>Include test data</strong><span className="muted small">The spec leaves out is_simulated events; the prototype has nothing else yet</span></span>
          </label>
        </div>

        {!r || !r.rows.length ? (
          <p className="callout">No events for this flat {withTest ? '' : 'outside test data '}yet. Run an evening with ▶ Simulate.</p>
        ) : (
          <>
            {withTest && <p className="callout small">All of this is test data: the Simulate bar and the sample flat Quad 3 are flagged <code>is_simulated = true</code>. Real pilot numbers start when real flats use the app.</p>}

            <section className="m-grid">
              <div className="m-card m-ns">
                <div className="card-title">North Star · ready cook visits</div>
                <div className="m-big">{r.northStar.ready}<span> this week</span></div>
                <p className="small">Ready share <R r={r.northStar.share} /> · {r.northStar.noNoteDays} day{r.northStar.noNoteDays === 1 ? '' : 's'} with no note (never ready)</p>
                <p className="muted small">{r.northStar.lastWeekReady === null ? 'No last week to compare.' : `Last week: ${r.northStar.lastWeekReady}. Target: rises week on week.`}</p>
              </div>
              <Input title="01 · Active flat" value={r.inputs.active ? 'Yes' : 'No'} note="A cook note this week" s={r.inputs.active ? 'good' : 'bad'} />
              <Input title="02 · Note coverage" value={<R r={r.inputs.noteCoverage} />} note="Note by 8 pm ÷ cook visit days · target 5 of 7" s={st(r.inputs.noteCoverage.value, (v) => v >= 5 / 7)} />
              <Input title="03 · Order-through" value={<R r={r.inputs.orderThrough} />} note="Ordered before the next visit · pass rule 70%" s={st(r.inputs.orderThrough.value, (v) => v >= 0.7)} />
              <Input title="Came back" value={<R r={r.inputs.cameBack} />} note="Notes sent without a prompt · watched, no target" s="na" />
            </section>

            <Table title="G1 · The cook finds everything she needs" rows={[
              ['First note within 3 days of setup', r.g1.firstNoteWithin3.days === null ? '—' : `${r.g1.firstNoteWithin3.days} day${r.g1.firstNoteWithin3.days === 1 ? '' : 's'}`, '3 of 5 flats', r.g1.firstNoteWithin3.ok === null ? 'na' : r.g1.firstNoteWithin3.ok ? 'good' : 'bad', 'Meet cooks in person'],
              ['"Something missing" visits', <><R r={r.g1.missing} />{r.g1.missingBaseline && <span className="muted small"> · week 1: {pct(r.g1.missingBaseline)}</span>}</>, '50% drop vs week 1', r.g1.missingBaseline && r.g1.missingBaseline.value ? st(r.g1.missing.value, (v) => v <= r.g1.missingBaseline!.value! / 2) : 'na', 'Change how the list is collected'],
            ]} />
            <Table title="G2 · Nobody is the one who always orders" rows={[
              ['Flatmates in the rotation', <R r={r.g2.rotation} />, '100%', st(r.g2.rotation.value, (v) => v >= 1), 'Ask why in person'],
              ['Owner orders after one reminder', <R r={r.g2.afterReminder} />, '80% or more', st(r.g2.afterReminder.value, (v) => v >= 0.8), 'Change timing or wording; never a second reminder'],
              ['Order concentration (last 14 days)', r.g2.concentration.applies ? <R r={r.g2.concentration} /> : <span className="muted">flat of fewer than 3</span>, '50% or less', r.g2.concentration.applies ? st(r.g2.concentration.value, (v) => v <= 0.5) : 'na', 'Change how turns are assigned'],
              ['Duplicate buys (last 14 days)', String(r.g2.duplicates), 'fewer than 2', r.g2.duplicates < 2 ? 'good' : 'bad', 'Tighten the single-owner rule'],
              ['Fee split across all flatmates', <R r={r.g2.feeSplit} />, 'every paying flat', st(r.g2.feeSplit.value, (v) => v >= 1), 'Offer per-head billing'],
            ]} />
            <Table title="G3 · Tomorrow's dish is settled in advance" rows={[
              ['Usual-dish list (10+ dishes)', `${r.g3.dishList.count} dishes`, '4 of 5 flats', r.g3.dishList.ok ? 'good' : 'bad', "Build the list from the cook's notes"],
              ['Dish named by 8 pm', <R r={r.g3.dishNamed} />, '50% or more', st(r.g3.dishNamed.value, (v) => v >= 0.5), 'Ask only what is low'],
              ['Suggestion accepted', <R r={r.g3.suggestionAccepted} />, '40% or more', st(r.g3.suggestionAccepted.value, (v) => v >= 0.4), 'Default to "repeat last week"'],
              ['Planned dish cooked', <R r={r.g3.plannedCooked} />, '70% or more', st(r.g3.plannedCooked.value, (v) => v >= 0.7), 'Ask the cooks what changed'],
              ['Dish suggestion as a reason to pay', String(r.g3.dishReasonToPay), 'at least one flat', r.g3.dishReasonToPay > 0 ? 'good' : 'na', 'Keep it free as a retention feature'],
            ]} />
            <Table title="Guardrails" stop rows={[
              ['Asks per person per day (max)', String(r.guardrails.asksMax), 'stop at 2', r.guardrails.asksMax >= 2 ? 'bad' : 'good', r.guardrails.asksOver.length ? `Talk to the flat: ${r.guardrails.asksOver.map((a) => a.date).join(', ')}` : 'Stop and talk to that flat within 48 hours'],
              ['Opt-outs (muted or left)', String(r.guardrails.optOuts), 'any', r.guardrails.optOuts > 0 ? 'bad' : 'good', 'Talk to that flat within 48 hours'],
              ['Duplicate or spoiled items (last 14 days)', String(r.guardrails.dupSpoiled), 'stop at 2', r.guardrails.dupSpoiled >= 2 ? 'bad' : 'good', 'Tighten the quantities on the list'],
              ['Freshness complaints this week', String(r.guardrails.freshness), 'any repeat', r.guardrails.freshness >= 2 ? 'bad' : 'good', 'Vegetables move to a same-morning order'],
            ]} />
            <Table title="Money" rows={[
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
              <h3>Flat evenings</h3>
              <p className="muted small">The derived flat_evening table: one row per evening, newest first.</p>
              <div className="m-table-wrap">
                <table className="m-table">
                  <thead><tr><th>Evening</th><th>Note</th><th>Dish</th><th>List</th><th>Owner</th><th>Ordered</th><th>Received</th><th>Most asks</th><th>Visit ready?</th></tr></thead>
                  <tbody>
                    {[...r.rows].reverse().slice(0, 21).map((row) => (
                      <tr key={row.date} className={row.isVisitDay ? '' : 'm-off'}>
                        <td>{fmtDay(row.date, today)}</td>
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
          <p className="muted small">Newest first. Every event carries the common properties (event_id, occurred_at in UTC, evening_date, flat_id, hashed person_id, role, is_owner_tonight, ui_language, app_version, platform, is_simulated). Names are shown here for the team only; they are never stored in events.</p>
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

function Table({ title, rows, stop }: { title: string; rows: [string, ReactNode, string, Status, string][]; stop?: boolean }) {
  return (
    <section className="m-section">
      <h3>{title}</h3>
      <div className="m-table-wrap">
        <table className="m-table">
          <thead><tr><th>Metric</th><th>This week</th><th>{stop ? 'Stop-work threshold' : 'Target'}</th><th>Status</th><th>If it misses</th></tr></thead>
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
