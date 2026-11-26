import { useState, type ReactNode } from 'react'
import { Milestones, SimBar } from '../components/Sim'
import { VoiceNote } from '../components/ui'
import { nameOf as ingName } from '../lib/catalogue'
import {
  addDays, AUTO, buildList, DEADLINES, eveningOrDraft, finalDish, firstName, fmtTime, nameOf,
  markReceived, receiveOpensAt, stageOf, weekReady, type Line,
} from '../lib/logic'
import { useStore } from '../lib/store'
import { AddItemSheet, OrderSheet } from './Sheets'

// Home: one card that says the one thing to do now for tomorrow's cooking. Everything else is secondary and kept short.

export function Home({ goTo }: { goTo: (tab: string) => void }) {
  const { db, me, flat, tonight, time, updateTonight } = useStore()
  const [order, setOrder] = useState(false)
  const [add, setAdd] = useState(false)
  if (!me || !flat || !tonight) return null

  const stage = stageOf(tonight, time)
  const lines = buildList(tonight)
  const isOwner = tonight.ownerId === me.id
  const owner = firstName(nameOf(db, tonight.ownerId))
  const dish = finalDish(tonight)
  const cook = flat.cookName
  const opens = receiveOpensAt(tonight)
  const canReceive = !!tonight.ordered && time >= opens
  // The dish card appears only when the flat has to decide: Didi didn't name one and nobody has picked yet.
  const noteIn = !!tonight.note || tonight.fallbackAnswered
  const dishDecisionNeeded = !tonight.skipped && noteIn && !dish && !!tonight.suggestion && !tonight.ordered

  return (
    <div className="screen">
      <SimBar />
      <div className="hello">
        <div>
          <div className="muted small">{isOwner ? 'Your turn to order tonight' : `${owner} orders tonight`}</div>
          <h2>Tomorrow's cooking</h2>
        </div>
      </div>
      <Milestones />

      {stage === 'received' ? (
        <Finale />
      ) : (
        <section className={`now-card now-${stage} ${isOwner ? 'is-owner' : ''}`} aria-live="polite">
          {stage === 'skipped' && <Now title="No cook tomorrow" body="Nothing to order tonight. Turns don't move." />}

          {stage === 'before-note' && (
            <Now
              title={`${cook}'s note comes at ${fmtTime(DEADLINES.note)}`}
              body={isOwner ? "She'll say tomorrow's dish and what's running out. You'll order from that." : `Nothing for you to do. ${owner} orders tonight.`}
            >
              <button type="button" className="btn btn-quiet" onClick={() => setAdd(true)}>+ Add something you noticed</button>
            </Now>
          )}

          {stage === 'no-note' &&
            (isOwner ? (
              <Now title={`${cook}'s note hasn't come`} body={`If tomorrow is ${tonight.suggestion || 'the usual'}, what's low? Add it and you're done.`}>
                <button type="button" className="btn btn-primary btn-block" onClick={() => setAdd(true)}>Add what's low</button>
                <button type="button" className="btn btn-quiet" disabled={!lines.length} onClick={() => updateTonight((e) => void (e.fallbackAnswered = true))}>That's everything</button>
              </Now>
            ) : (
              <Now title={`${cook}'s note hasn't come`} body={`${owner} will add what's low. You can add too.`}>
                <button type="button" className="btn btn-quiet" onClick={() => setAdd(true)}>+ Add something</button>
              </Now>
            ))}

          {stage === 'collecting' && (
            <Now title={`${cook}'s note is in`} body={`Tomorrow: ${dish || 'dish not decided'}. The list is created at ${fmtTime(DEADLINES.list)}.`}>
              <ListPreview lines={lines} onOpen={() => goTo('list')} />
              <button type="button" className="btn btn-quiet" onClick={() => setAdd(true)}>+ Need anything else? Add it</button>
            </Now>
          )}

          {stage === 'list' &&
            (isOwner ? (
              <Now title="Your turn to order" body={`${lines.length} items for ${dish || 'tomorrow'}. One order, everything on it. Please order by ${fmtTime(AUTO.orderAt)}.`} tone="action">
                <ListPreview lines={lines} onOpen={() => goTo('list')} />
                <button type="button" className="btn btn-primary btn-block" disabled={!lines.length} onClick={() => setOrder(true)}>Order now</button>
              </Now>
            ) : (
              <Now title={`${owner} is ordering`} body={`List created: ${lines.length} items for ${dish || 'tomorrow'}. Nothing for you to do; only ${owner} orders, so nothing is bought twice.`}>
                <ListPreview lines={lines} onOpen={() => goTo('list')} />
              </Now>
            ))}

          {stage === 'ordered' && (
            <Now
              title={canReceive ? 'Has it arrived?' : 'Order placed · on its way'}
              body={
                canReceive
                  ? `${tonight.ordered!.by === me.id ? 'Your' : `${owner}'s`} ${tonight.ordered!.app} order should be at the door.${!isOwner ? ` If nobody marks it, ${owner} will by ${fmtTime(AUTO.receiveByFlatmateView)}.` : ''}`
                  : `${tonight.ordered!.by === me.id ? 'You' : owner} ordered on ${tonight.ordered!.app} at ${fmtTime(tonight.ordered!.at)}. Arrives from ${fmtTime(opens)}${!isOwner ? ` to ${fmtTime(AUTO.receiveByFlatmateView)}` : ''}.`
              }
              tone={canReceive ? 'action' : 'calm'}
            >
              {canReceive ? (
                <button type="button" className="btn btn-primary btn-block" onClick={() => updateTonight((e, d) => markReceived(d, e, me.id, d.clock?.time ?? time))}>
                  ✓ Order received
                </button>
              ) : (
                <div className="eta"><span className="eta-dot" /> Delivery on the way</div>
              )}
              {tonight.ordered!.amount ? <p className="muted small">₹{tonight.ordered!.amount} · ₹{Math.round(tonight.ordered!.amount / flat.memberIds.length)} each on Splitwise</p> : null}
            </Now>
          )}
        </section>
      )}

      {tonight.note && stage !== 'received' && (
        <section className="card compact">
          <div className="row gap8 between">
            <span className="card-title">{cook}'s note · {fmtTime(tonight.note.at)}</span>
          </div>
          <p>
            {tonight.note.todayAllGood === false
              ? `Today she was missing ${tonight.note.todayMissing.map((k) => ingName(k)).join(', ') || 'something'}.`
              : tonight.note.todayAllGood
                ? 'Today she had everything she needed.'
                : ''}
          </p>
          {(tonight.note.voiceUrl || tonight.note.voiceSecs > 0) && <VoiceNote url={tonight.note.voiceUrl} secs={tonight.note.voiceSecs} />}
        </section>
      )}

      {dishDecisionNeeded && <DishCard />}

      <OrderSheet open={order} onClose={() => setOrder(false)} />
      <AddItemSheet open={add} onClose={() => setAdd(false)} />
    </div>
  )
}

function Now({ title, body, tone = 'calm', children }: { title: string; body: string; tone?: 'calm' | 'action'; children?: ReactNode }) {
  return (
    <div className={`now now-tone-${tone}`}>
      <h3>{title}</h3>
      <p>{body}</p>
      {children && <div className="now-actions">{children}</div>}
    </div>
  )
}

/** Items shown with their names, not icons alone. */
function ListPreview({ lines, onOpen }: { lines: Line[]; onOpen: () => void }) {
  if (!lines.length) return <p className="muted small">Nothing on the list yet.</p>
  const shown = lines.slice(0, 6)
  return (
    <button type="button" className="list-preview" onClick={onOpen} aria-label="Open the list">
      {shown.map((l) => (
        <span key={l.key} className="lp-item">
          <span aria-hidden>{l.emoji}</span> {l.name} <span className="lp-qty">{l.qty}</span>
        </span>
      ))}
      {lines.length > shown.length && <span className="lp-item lp-more">+{lines.length - shown.length} more</span>}
    </button>
  )
}

/** The end of the evening: the moment the product delivered. Peak-end rule: make it the one they remember. */
function Finale() {
  const { db, me, flat, tonight, today } = useStore()
  if (!me || !flat || !tonight?.ordered || !tonight.received) return null
  const who = (id: string) => (id === me.id ? 'You' : firstName(nameOf(db, id)))
  const week = weekReady(db, flat, today)
  const next = eveningOrDraft(db, flat, addDays(today, 1))
  const dish = finalDish(tonight)
  const per = tonight.ordered.amount ? Math.round(tonight.ordered.amount / flat.memberIds.length) : 0
  return (
    <section className="finale" aria-live="polite">
      <div className="confetti" aria-hidden>{Array.from({ length: 14 }, (_, i) => <i key={i} />)}</div>
      <div className="finale-mark">✓</div>
      <h3>Kitchen ready for tomorrow</h3>
      <p>{flat.cookName} will find everything{dish ? ` for ${dish}` : ''}. Nobody had to chase anyone.</p>
      <ol className="recap">
        <li><span>{fmtTime(tonight.note?.at ?? DEADLINES.note)}</span>{flat.cookName}'s note</li>
        <li><span>{fmtTime(DEADLINES.list)}</span>List created · {buildList(tonight).length} items</li>
        <li><span>{fmtTime(tonight.ordered.at)}</span>{who(tonight.ordered.by)} ordered on {tonight.ordered.app}</li>
        <li><span>{fmtTime(tonight.received.at)}</span>{who(tonight.received.by)} received it</li>
      </ol>
      <div className="finale-facts">
        {week.visits > 0 && <div><strong>{week.ready}/{week.visits}</strong><span>days this week she had everything</span></div>}
        {per > 0 && <div><strong>₹{per}</strong><span>your share, on Splitwise</span></div>}
        <div><strong>{next.ownerId === me.id ? 'You' : firstName(nameOf(db, next.ownerId))}</strong><span>order{next.ownerId === me.id ? '' : 's'} tomorrow</span></div>
      </div>
    </section>
  )
}

/** Shown only when the flat has to decide: Didi didn't name tomorrow's dish. */
function DishCard() {
  const { flat, tonight, updateTonight } = useStore()
  const [pick, setPick] = useState(false)
  if (!flat || !tonight) return null
  return (
    <section className="card compact decide">
      <div className="card-title">Decide tomorrow's dish</div>
      <p>{flat.cookName} hasn't picked one. How about <strong>{tonight.suggestion}</strong>? <span className="muted small">From your usual dishes, not made this week.</span></p>
      <div className="row gap8">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => updateTonight((e) => { e.suggestionAnswer = 'accepted'; e.dish = e.suggestion; e.dishSource = 'suggestion' })}>Sounds good</button>
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => setPick(!pick)}>Something else</button>
      </div>
      {pick && (
        <div className="chips">
          {flat.usualDishes.filter((d) => d !== tonight.suggestion).map((d) => (
            <button key={d} type="button" className="chip" onClick={() => { updateTonight((e) => { e.suggestionAnswer = 'changed'; e.dish = d; e.dishSource = 'flatmate' }); setPick(false) }}>{d}</button>
          ))}
        </div>
      )}
    </section>
  )
}
