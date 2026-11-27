import { useState } from 'react'
import { finishTask, startTask, track } from '../lib/analytics'
import { DISH_IDEAS } from '../lib/catalogue'
import { Avatar, ConfirmTwice, CopyBtn, waShare } from '../components/ui'
import { addDays, fairness, firstName, fmtDay, nameOf, requestHandover, upcomingTurns } from '../lib/logic'
import { useStore } from '../lib/store'
import { AnalyticsEntry } from './Metrics'

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
  const { me } = useStore()
  const setDishes = (fn: (d: string[]) => string[]) =>
    update((d) => {
      const f = d.flats.find((x) => x.id === flat.id)!
      f.usualDishes = fn(f.usualDishes)
      track(d, 'usual_dishes_shared', { flatId: f.id, who: me?.id ?? '' }, { dish_count: f.usualDishes.length, source: 'dishes_tab', custom_dish_count: f.usualDishes.filter((x) => !DISH_IDEAS.includes(x)).length })
    })
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
  const ctx = { flatId: flat.id, who: me.id }
  const invited = (invitee: string, channel: string) => update((d) => track(d, 'invite_sent', ctx, { invitee, channel }))

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
          <CopyBtn text={flat.code} label="Copy" className="btn btn-outline btn-sm" onCopy={() => invited('flatmate', 'copy')} />
        </div>
        <a className="btn btn-wa btn-block" href={waShare(invite)} target="_blank" rel="noreferrer" onClick={() => invited('flatmate', 'whatsapp')}>Invite on WhatsApp</a>
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
        {!flat.cookId && <a className="btn btn-outline btn-block" href={waShare(cookMsg)} target="_blank" rel="noreferrer" onClick={() => invited('cook', 'whatsapp')}>Send {flat.cookName || 'her'} the link</a>}
        <label className="field">
          <span>Weekly staples check (atta, rice, oil, dal)</span>
          <select value={flat.staplesWeekday} onChange={(e) => setFlat((f) => void (f.staplesWeekday = Number(e.target.value)))}>
            {WEEKDAYS.map((w, i) => <option key={w} value={i}>{w}</option>)}
          </select>
        </label>
      </section>

      <PlanCard per={per} />

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

      <section className="card compact">
        <div className="card-title">Settings</div>
        <label className="toggle">
          <input
            type="checkbox"
            checked={!!me.muted}
            onChange={(e) => update((d) => {
              const u = d.users.find((x) => x.id === me.id)!
              u.muted = e.target.checked
              if (e.target.checked) track(d, 'flat_muted_or_left', ctx, { scope: 'person', reason: 'muted reminders' })
            })}
          />
          <span><strong>Mute reminders</strong><span className="muted small">You'll still see everything in the app.</span></span>
        </label>
        <ConfirmTwice
          className="btn btn-quiet btn-sm danger"
          label="Leave this flat"
          confirmLabel="Tap again to leave"
          onConfirm={() => update((d) => {
            const f = d.flats.find((x) => x.id === flat.id)!
            const last = f.memberIds.length === 1
            track(d, 'flat_muted_or_left', ctx, { scope: last ? 'flat' : 'person', reason: 'left the flat' })
            f.memberIds = f.memberIds.filter((x) => x !== me.id)
            f.rotation = f.rotation.filter((x) => x !== me.id)
            const u = d.users.find((x) => x.id === me.id)!
            u.flatId = null
          })}
        />
      </section>

      <section className="card compact">
        <div className="card-title">For the Rasoi Ready team</div>
        <p className="muted small">Analytics for the people building the app. Password needed.</p>
        <AnalyticsEntry />
      </section>

      <button type="button" className="btn btn-outline btn-block" onClick={() => update((d) => void (d.sessionUserId = null))}>Log out · choose another person</button>
    </div>
  )
}

/** The plan, and the day-21 pre-pay ask (prepayment_answered). Opening it sends plan_viewed. */
function PlanCard({ per }: { per: number }) {
  const { db, me, flat, update } = useStore()
  const [open, setOpen] = useState(false)
  const [split, setSplit] = useState(true)
  const [reason, setReason] = useState('')
  const [dishReason, setDishReason] = useState(false)
  if (!me || !flat) return null
  const answer = [...(db.events ?? [])].reverse().find((e) => e.flat_id === flat.id && e.event_name === 'prepayment_answered')
  const send = (a: 'paid' | 'declined' | 'later') =>
    update((d) => track(d, 'prepayment_answered', { flatId: flat.id, who: me.id }, {
      price_asked_inr: 149, answer: a, amount_inr: a === 'paid' ? 149 : 0, split_across: split ? flat.memberIds.length : 1, reason_given: reason.trim(), cites_dish_suggestion: dishReason,
    }))
  return (
    <section className="card plan">
      <button type="button" className="plan-head" aria-expanded={open} onClick={() => { if (!open) update((d) => track(d, 'plan_viewed', { flatId: flat.id, who: me.id }, { price_shown_inr: 149 })); setOpen(!open) }}>
        <span className="card-title">Plan</span>
        <span className="muted small">{open ? 'Hide' : 'See plan'}</span>
      </button>
      <p><strong>₹149 a month for the flat</strong>, split between flatmates: about ₹{per} each.</p>
      {open && (
        <div className="prepay">
          <p className="muted small">Less than one dinner ordered in when the cook couldn't cook. Free while you try it; on day 21 we ask whether you'd pre-pay for next month. We don't take payments in the app yet.</p>
          {answer ? (
            <p>✓ Your flat answered: <strong>{answer.props.answer === 'paid' ? 'would pre-pay' : answer.props.answer === 'later' ? 'ask later' : 'no'}</strong>.</p>
          ) : (
            <>
              <label className="toggle"><input type="checkbox" checked={split} onChange={(e) => setSplit(e.target.checked)} /><span><strong>Split across all {flat.memberIds.length} flatmates</strong></span></label>
              <label className="toggle"><input type="checkbox" checked={dishReason} onChange={(e) => setDishReason(e.target.checked)} /><span><strong>The dish suggestions are a reason</strong></span></label>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why? (optional)" />
              <div className="row gap8 wrap">
                <button type="button" className="btn btn-primary btn-sm" onClick={() => send('paid')}>We'd pre-pay ₹149</button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => send('later')}>Ask later</button>
                <button type="button" className="btn btn-quiet btn-sm" onClick={() => send('declined')}>No thanks</button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
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
          {tonight.handoverPending ? (
            <p className="muted small">Asked {nameOf(db, tonight.handoverPending.to)} to take tonight. Waiting for them to accept; until then it's still your turn.</p>
          ) : (
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => { if (!handover) startTask('hand_over', 1); setHandover(!handover) }}>Can't tonight? Hand over</button>
          )}
          {handover && !tonight.handoverPending && (
            <div className="chips">
              {flat.memberIds.filter((id) => id !== me.id).map((id) => (
                <button key={id} type="button" className="chip" onClick={() => {
                  const done = finishTask('hand_over')
                  updateTonight((e, d) => {
                    requestHandover(d, e, me.id, id, d.clock?.time ?? '22:00')
                    if (done) track(d, 'task_completed', { flatId: flat.id, who: me.id }, done)
                  })
                  setHandover(false)
                }}>
                  Ask {nameOf(db, id)}
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
            onChange={(e) => update((d) => {
              const f = d.flats.find((x) => x.id === flat.id)!
              f.rotation = e.target.checked ? [...f.rotation, me.id] : f.rotation.filter((x) => x !== me.id)
              track(d, 'rotation_changed', { flatId: f.id, who: me.id }, { in_rotation: e.target.checked, turn_position: e.target.checked ? f.rotation.indexOf(me.id) + 1 : 0, at_setup: false })
            })}
          />
          <span><strong>I take a turn ordering</strong><span className="muted small">Order: {flat.rotation.map(who).join(' → ') || 'nobody yet'}</span></span>
        </label>
      </details>
    </section>
  )
}
