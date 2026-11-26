import { useState } from 'react'
import { Avatar, CopyBtn, waShare } from '../components/ui'
import { addDays, fairness, firstName, fmtDay, nameOf, upcomingTurns } from '../lib/logic'
import { useStore } from '../lib/store'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// ---------------- Dishes ----------------

export function DishesTab() {
  const { db, flat, today, update } = useStore()
  const [custom, setCustom] = useState('')
  if (!flat) return null
  const history = db.evenings
    .filter((e) => e.flatId === flat.id && e.date < today && e.dish && !e.skipped)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 7)
  const setDishes = (fn: (d: string[]) => string[]) => update((d) => { const f = d.flats.find((x) => x.id === flat.id)!; f.usualDishes = fn(f.usualDishes) })
  const n = flat.usualDishes.length

  return (
    <div className="screen">
      <div className="hello">
        <div>
          <div className="muted small">No more "bhaiya, kya banau?"</div>
          <h2>Dishes</h2>
        </div>
      </div>
      <section className="card">
        <div className="card-title">Your usual dishes · {n}</div>
        <p className="muted small">When {flat.cookName} hasn't decided, we suggest one of these that you haven't had this week. {n < 10 ? 'Most flats have 10 to 15.' : ''}</p>
        <div className="chips">
          {flat.usualDishes.map((d) => (
            <span key={d} className="chip chip-on">
              {d} <button type="button" className="x" aria-label={`Remove ${d}`} onClick={() => setDishes((l) => l.filter((x) => x !== d))}>✕</button>
            </span>
          ))}
        </div>
        <div className="row gap8">
          <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Add a dish" />
          <button type="button" className="btn btn-outline" disabled={!custom.trim()} onClick={() => { setDishes((l) => [...l, custom.trim()]); setCustom('') }}>Add</button>
        </div>
      </section>
      <section className="card">
        <div className="card-title">This week</div>
        {history.length === 0 ? <p className="muted">Nothing yet.</p> : (
          <ul className="history">
            {history.map((e) => (
              <li key={e.date}>
                <span className="muted small">{fmtDay(addDays(e.date, 1), today)}</span>
                <strong>{e.dish}</strong>
                <span className="tag">{e.dishSource === 'cook' ? flat.cookName : e.dishSource === 'suggestion' ? 'suggested' : 'flat chose'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

// ---------------- Flat ----------------

export function FlatTab() {
  const { db, me, flat, update } = useStore()
  if (!me || !flat) return null
  const invite = `Join our flat "${flat.name}" on Rasoi Ready so groceries are sorted the night before. Code: ${flat.code}`
  const cookMsg = `${flat.cookName || 'Didi'}, kal kya banana hai aur kya khatam ho raha hai, ab Rasoi Ready par bataiye. Code: ${flat.code}`
  const per = Math.round(149 / Math.max(1, flat.memberIds.length))
  const setFlat = (fn: (f: NonNullable<typeof flat>) => void) => update((d) => { const f = d.flats.find((x) => x.id === flat.id)!; fn(f) })

  return (
    <div className="screen">
      <div className="hello">
        <div>
          <div className="muted small">{flat.area}</div>
          <h2>{flat.name}</h2>
        </div>
      </div>

      <TurnsCard />

      <section className="card">
        <div className="card-title">Flatmates</div>
        <ul className="people">
          {flat.memberIds.map((id) => (
            <li key={id}><Avatar name={nameOf(db, id)} size={30} /> {nameOf(db, id)}{id === me.id ? ' (you)' : ''}{!flat.rotation.includes(id) && <span className="tag">no turn</span>}</li>
          ))}
        </ul>
        <div className="invite">
          <span className="muted small">Invite code</span>
          <span className="code-inline">{flat.code}</span>
          <CopyBtn text={flat.code} label="Copy" className="btn btn-outline btn-sm" />
        </div>
        <a className="btn btn-wa btn-block" href={waShare(invite)} target="_blank" rel="noreferrer">Invite on WhatsApp</a>
      </section>

      <section className="card">
        <div className="card-title">Cook</div>
        <ul className="people">
          <li>
            <Avatar name={flat.cookName || 'C'} size={30} tone={1} /> {flat.cookName || 'Not added'}
            <span className="tag">{flat.cookLang === 'hi' ? 'Hindi' : flat.cookLang === 'te' ? 'Telugu' : 'English'}</span>
            <span className="tag">{flat.cookVisits === 2 ? 'twice a day' : 'once a day'}</span>
            {flat.cookId ? <span className="tag tag-done">on the app</span> : <span className="tag">not joined yet</span>}
          </li>
        </ul>
        {!flat.cookId && <a className="btn btn-outline btn-block" href={waShare(cookMsg)} target="_blank" rel="noreferrer">Send {flat.cookName || 'her'} the link</a>}
        <label className="field">
          <span>Weekly staples check (atta, rice, oil, dal)</span>
          <select value={flat.staplesWeekday} onChange={(e) => setFlat((f) => void (f.staplesWeekday = Number(e.target.value)))}>
            {WEEKDAYS.map((w, i) => <option key={w} value={i}>{w}</option>)}
          </select>
        </label>
      </section>

      <section className="card plan">
        <div className="card-title">Plan</div>
        <p><strong>₹149 a month for the flat</strong>, split between flatmates: about ₹{per} each.</p>
        <p className="muted small">Less than one dinner ordered in when the cook couldn't cook. Free while you try it.</p>
      </section>

      <section className="card">
        <div className="card-title">How Rasoi Ready works</div>
        <ul className="how">
          <li>🎤 Every evening {flat.cookName || 'your cook'} says tomorrow's dish and what's running out.</li>
          <li>📝 One list, with quantities, for the whole flat.</li>
          <li>🔁 One owner orders on Blinkit or Zepto. Only they get a reminder, once.</li>
          <li>✅ Next evening she tells us if she had everything.</li>
        </ul>
        <p className="fine">We never order without you, and we don't deliver or take payments.</p>
      </section>

      <button type="button" className="btn btn-outline btn-block" onClick={() => update((d) => void (d.sessionUserId = null))}>Log out · choose another person</button>
    </div>
  )
}

/** Turns: who orders tonight and next, a hand-over, and how fair it has been. */
function TurnsCard() {
  const { db, me, flat, tonight, today, update, updateTonight } = useStore()
  const [handover, setHandover] = useState(false)
  if (!me || !flat || !tonight) return null
  const turns = upcomingTurns(db, flat, today, 4)
  const fair = fairness(db, flat, today)
  const fairShare = flat.memberIds.length ? 1 / flat.memberIds.length : 0
  const isOwner = tonight.ownerId === me.id
  const inTurn = flat.rotation.includes(me.id)
  const who = (id: string) => (id === me.id ? 'You' : firstName(nameOf(db, id)))

  return (
    <section className="card compact">
      <div className="card-title">Turns</div>
      <ol className="turn-strip">
        {turns.map((t, i) => (
          <li key={t.date} className={i === 0 ? 'now' : ''}>
            <Avatar name={nameOf(db, t.ownerId)} size={30} />
            <strong>{who(t.ownerId)}</strong>
            <span className="muted small">{i === 0 ? 'Tonight' : i === 1 ? 'Tomorrow' : new Date(t.date + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short' })}</span>
          </li>
        ))}
      </ol>

      {isOwner && !tonight.ordered && !tonight.skipped && (
        <>
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => setHandover(!handover)}>Can't tonight? Hand over</button>
          {handover && (
            <div className="chips">
              {flat.memberIds.filter((id) => id !== me.id).map((id) => (
                <button key={id} type="button" className="chip" onClick={() => { updateTonight((e) => { e.handedOverFrom = me.id; e.ownerId = id }); setHandover(false) }}>
                  {nameOf(db, id)} takes tonight
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <details className="more">
        <summary>Who's ordered this month</summary>
        <div className="fair">
          {[...fair.counts.entries()].map(([id, n]) => (
            <div key={id} className="fair-row">
              <span className="fair-name">{who(id)}</span>
              <span className="bar big"><span style={{ width: `${fair.total ? (n / fair.total) * 100 : 0}%` }} /><i style={{ left: `${fairShare * 100}%` }} /></span>
              <span className="fair-n">{n}</span>
            </div>
          ))}
        </div>
        <p className="muted small">The orange line is a fair share ({Math.round(fairShare * 100)}%).</p>
        <label className="toggle">
          <input
            type="checkbox"
            checked={inTurn}
            onChange={(e) => update((d) => { const f = d.flats.find((x) => x.id === flat.id)!; f.rotation = e.target.checked ? [...f.rotation, me.id] : f.rotation.filter((x) => x !== me.id) })}
          />
          <span><strong>I take a turn ordering</strong><span className="muted small">Order: {flat.rotation.map(who).join(' → ') || 'nobody yet'}</span></span>
        </label>
      </details>
    </section>
  )
}
