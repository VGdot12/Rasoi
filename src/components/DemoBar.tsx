import { useState } from 'react'
import { addDays, fmtDay, fmtTime, isoDate, now } from '../lib/logic'
import { useStore } from '../lib/store'

const TIMES = [
  { t: '18:00', label: '6 pm', hint: 'cook gets her prompt' },
  { t: '20:30', label: '8:30 pm', hint: 'note due by 8' },
  { t: '21:15', label: '9:15 pm', hint: 'list is out' },
  { t: '22:15', label: '10:15 pm', hint: 'one reminder' },
]

/** Prototype controls: move through an evening and switch between people in the sample flat.
 *  Not part of the product. */
export function DemoBar() {
  const { db, me, update, reset } = useStore()
  const [open, setOpen] = useState(false)
  const { date, time } = now(db)
  const today = isoDate(new Date())
  const people = db.users.filter((u) => u.flatId && db.flats.some((f) => f.id === u.flatId))

  return (
    <aside className={`demo ${open ? 'open' : ''}`}>
      <button type="button" className="demo-toggle" onClick={() => setOpen(!open)}>
        🧪 Prototype controls · {fmtDay(date, today)} {fmtTime(time)} {open ? '▴' : '▾'}
      </button>
      {open && (
        <div className="demo-body">
          <div className="demo-group">
            <div className="demo-label">Time of evening</div>
            <div className="demo-row">
              {TIMES.map((x) => (
                <button key={x.t} type="button" className={db.clock?.time === x.t ? 'on' : ''} onClick={() => update((d) => void (d.clock = { date, time: x.t }))} title={x.hint}>
                  {x.label}
                </button>
              ))}
              <button type="button" onClick={() => update((d) => void (d.clock = { date: addDays(date, 1), time: '18:00' }))}>Next day ›</button>
            </div>
            <div className="demo-hint">{TIMES.find((x) => x.t === db.clock?.time)?.hint ?? (db.clock ? '' : 'real time')}</div>
          </div>
          <div className="demo-group">
            <div className="demo-label">View as</div>
            <div className="demo-row">
              {people.map((u) => (
                <button key={u.id} type="button" className={me?.id === u.id ? 'on' : ''} onClick={() => update((d) => void (d.sessionUserId = u.id))}>
                  {u.name}{u.role === 'cook' ? ' 👩‍🍳' : ''}
                </button>
              ))}
              <button type="button" onClick={() => update((d) => void (d.sessionUserId = null))}>Log out</button>
            </div>
          </div>
          <div className="demo-group">
            <div className="demo-row">
              <button type="button" onClick={() => reset()}>Reset sample data</button>
              {db.clock && <button type="button" onClick={() => update((d) => void (d.clock = null))}>Use real time</button>}
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
