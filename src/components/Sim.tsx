import { fmtTime, milestones, nameOf, SIM, toMin, variants } from '../lib/logic'
import { useStore } from '../lib/store'

/** Prototype controls inside the app: run the evening clock and switch between the three views. */
export function SimBar() {
  const { db, me, flat, time, sim } = useStore()
  if (!flat || !me) return null
  const v = variants(db, flat)
  const ended = time >= SIM.end
  const progress = Math.min(1, Math.max(0, (toMin(time) - toMin(SIM.start)) / (toMin(SIM.end) - toMin(SIM.start))))
  const views = [
    { id: v.owner, label: 'Tonight’s owner' },
    { id: v.roommate, label: 'Roommate' },
    { id: v.cook, label: 'Didi' },
  ].filter((x) => x.id)
  return (
    <div className="simbar">
      <div className="sim-row">
        <button type="button" className={`sim-btn ${sim.running ? 'on' : ''}`} onClick={sim.toggle}>
          {sim.running ? '❚❚ Pause' : ended ? '↺ Simulate again' : sim.waitingForCook ? '⏸ Waiting' : '▶ Simulate'}
        </button>
        <div className="sim-clock">
          <strong>{fmtTime(time)}</strong>
          <span className="sim-track"><span style={{ width: `${progress * 100}%` }} /></span>
        </div>
        <button type="button" className="sim-mini" onClick={sim.resetEvening} title="Back to 7:30 pm">↺</button>
        <button type="button" className="sim-mini" onClick={sim.nextEvening} title="Next evening">⏭</button>
      </div>
      {sim.waitingForCook && <div className="sim-wait">Clock paused at 8 pm. Send Didi's note below and it carries on.</div>}
      {!sim.running && !sim.waitingForCook && !ended && time === SIM.start && (
        <div className="sim-hint">
          {me.role === 'cook' ? 'Press Simulate: the clock stops at 8 pm for Didi to send her note.' : 'Press Simulate: Didi\u2019s note arrives at 8 pm, the list at 10 pm.'}
        </div>
      )}
      <div className="sim-views" role="tablist" aria-label="View as">
        {views.map((x) => (
          <button key={x.label} type="button" role="tab" aria-selected={me.id === x.id} className={me.id === x.id ? 'on' : ''} onClick={() => sim.viewAs(x.id!)}>
            {x.label}
            <span>{nameOf(db, x.id!)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** The four milestones of the evening. */
export function Milestones() {
  const { tonight, time } = useStore()
  if (!tonight) return null
  if (tonight.skipped) return <div className="milestones skipped">No cook tomorrow: nothing to order tonight.</div>
  const ms = milestones(tonight, time)
  const current = ms.findIndex((m) => !m.done)
  return (
    <ol className="milestones">
      {ms.map((m, i) => (
        <li key={m.k} className={`${m.done ? 'done' : ''} ${i === current ? 'current' : ''}`}>
          <span className="ms-dot">{m.done ? '✓' : i + 1}</span>
          <span className="ms-k">{m.k}</span>
          <span className="ms-t">{m.done ? fmtTime(m.at) : m.due ? fmtTime(m.due) : '—'}</span>
        </li>
      ))}
    </ol>
  )
}
