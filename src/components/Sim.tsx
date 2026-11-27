import { fmtTime, milestones, SIM, toMin } from '../lib/logic'
import { PERSONAS } from '../lib/seed'
import { useStore } from '../lib/store'

/** Prototype control: runs the evening clock for the journey you picked. You can't switch people mid-way. */
export function SimBar() {
  const { me, tonight, time, sim, metrics } = useStore()
  if (!me) return null
  const persona = PERSONAS.find((p) => p.userId === me.id)
  // The role follows the turn: after Next day, Aditya may just be a flatmate.
  const roleNow = me.role === 'cook' ? 'cook' : tonight?.ownerId === me.id ? 'orders tonight' : 'flatmate'
  const ended = time >= SIM.end
  const fresh = !sim.running && !sim.waitingForCook && time === SIM.start
  const progress = Math.min(1, Math.max(0, (toMin(time) - toMin(SIM.start)) / (toMin(SIM.end) - toMin(SIM.start))))
  return (
    <div className="simbar">
      <div className="sim-row">
        <button type="button" className={`sim-btn ${sim.running ? 'on' : ''}`} onClick={ended ? sim.nextDay : sim.toggle} disabled={sim.waitingForCook}>
          {sim.running ? '❚❚ Pause' : ended ? 'Next day ›' : sim.waitingForCook ? 'Waiting for you' : fresh ? '▶ Simulate' : '▶ Resume'}
        </button>
        <div className="sim-clock">
          <strong>{fmtTime(time)}</strong>
          <span className="sim-track"><span style={{ width: `${progress * 100}%` }} /></span>
        </div>
        {!fresh && (
          <button type="button" className="sim-restart" onClick={sim.resetEvening}>Restart</button>
        )}
        <button type="button" className="sim-restart" onClick={() => metrics.setOpen(true)} aria-label="Open metrics">📊</button>
      </div>
      {(sim.waitingForCook || fresh || ended) && <div className="sim-hint">
        {sim.waitingForCook
          ? 'Paused at 8 pm. Send your note below and the evening carries on.'
          : fresh
            ? `You're ${persona?.name ?? me.name} · ${roleNow}. 7:30 pm to midnight, about ${Math.round(60 / SIM.minutesPerSecond)} seconds an hour.`
            : ended
              ? 'Evening over. Next day moves to tomorrow evening; Restart runs tonight again.'
              : ''}
      </div>}
    </div>
  )
}

/** The four milestones of the evening. */
const LABELS: Record<string, string[]> = {
  en: ['Didi\u2019s note', 'List created', 'Order placed', 'Order received'],
  hi: ['दीदी का नोट', 'लिस्ट बनी', 'ऑर्डर हुआ', 'सामान आया'],
  te: ['దీదీ నోట్', 'జాబితా సిద్ధం', 'ఆర్డర్ అయింది', 'సరుకులు వచ్చాయి'],
}

export function Milestones() {
  const { me, tonight, time } = useStore()
  const labels = LABELS[me?.role === 'cook' ? me.lang : 'en']
  if (!tonight) return null
  if (tonight.skipped) return <div className="milestones skipped">No cook tomorrow: nothing to order tonight.</div>
  const ms = milestones(tonight, time)
  const current = ms.findIndex((m) => !m.done)
  return (
    <ol className="milestones" aria-label="Tonight's progress">
      {ms.map((m, i) => (
        <li key={m.k} className={`${m.done ? 'done' : ''} ${i === current ? 'current' : ''}`}>
          <span className="ms-dot">{m.done ? '✓' : i + 1}</span>
          <span className="ms-k">{labels[i] ?? m.k}</span>
          <span className="ms-t">{m.done ? fmtTime(m.at) : `by ${fmtTime(m.due)}`}</span>
        </li>
      ))}
    </ol>
  )
}
