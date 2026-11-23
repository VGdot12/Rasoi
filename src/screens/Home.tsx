import { useState } from 'react'
import { Avatar, VoiceNote } from '../components/ui'
import { nameOf as ingName } from '../lib/catalogue'
import { addDays, buildList, DEADLINES, eveningOrDraft, fairness, finalDish, firstName, fmtTime, nameOf, stageOf, weekReady } from '../lib/logic'
import { useStore } from '../lib/store'
import { AddItemSheet, OrderSheet } from './Sheets'

export function Home({ goTo }: { goTo: (tab: string) => void }) {
  const { db, me, flat, tonight, today, time, updateTonight } = useStore()
  const [order, setOrder] = useState(false)
  const [add, setAdd] = useState(false)
  const [pickDish, setPickDish] = useState(false)
  if (!me || !flat || !tonight) return null

  const stage = stageOf(tonight, time)
  const lines = buildList(tonight)
  const isOwner = tonight.ownerId === me.id
  const owner = firstName(nameOf(db, tonight.ownerId))
  const dish = finalDish(tonight)
  const note = tonight.note
  const week = weekReady(db, flat, today)
  const fair = fairness(db, flat, today)
  const tomorrowOwner = eveningOrDraft(db, flat, addDays(today, 1))
  const hour = Number(time.slice(0, 2))
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const steps = [
    { k: 'Didi’s note', done: !!note || tonight.fallbackAnswered, sub: note ? fmtTime(note.at) : 'by 8 pm' },
    { k: 'One list', done: (!!note || tonight.fallbackAnswered) && lines.length > 0, sub: `${lines.length} items` },
    { k: `${owner} orders`, done: !!tonight.ordered, sub: tonight.ordered ? tonight.ordered.app : 'tonight' },
    { k: 'All there', done: false, sub: 'tomorrow' },
  ]

  return (
    <div className="screen">
      <div className="hello">
        <div>
          <div className="muted small">{greet}, {me.name}</div>
          <h2>Tonight in {flat.name}</h2>
        </div>
      </div>

      {/* The one thing to do right now */}
      <section className={`hero-card stage-${stage} ${isOwner ? 'is-owner' : ''}`}>
        <div className="owner-line">
          <Avatar name={nameOf(db, tonight.ownerId)} size={28} />
          <span>{isOwner ? <strong>You're tonight's owner</strong> : <>Owner tonight: <strong>{owner}</strong></>}</span>
          {tonight.handedOverFrom && <span className="tag">handed over</span>}
        </div>

        {stage === 'skipped' && <p className="hero-text">{flat.cookName} isn't coming tomorrow. Nothing to order tonight, and turns don't move.</p>}

        {stage === 'before-note' && (
          <>
            <p className="hero-text">Waiting for {flat.cookName}'s note. She'll say tomorrow's dish and what's running out, usually by {fmtTime(DEADLINES.note)}.</p>
            <button type="button" className="btn btn-ghost" onClick={() => setAdd(true)}>+ Noticed something low? Add it</button>
          </>
        )}

        {stage === 'no-note' && (
          isOwner ? (
            <>
              <p className="hero-text">{flat.cookName}'s note hasn't come in. If tomorrow is <strong>{tonight.suggestion || 'the usual'}</strong>, what's low?</p>
              <div className="row gap8 wrap">
                <button type="button" className="btn btn-primary" onClick={() => setAdd(true)}>Add what's low</button>
                <button type="button" className="btn btn-outline" disabled={!lines.length} onClick={() => updateTonight((e) => void (e.fallbackAnswered = true))}>The list is ready</button>
              </div>
            </>
          ) : (
            <p className="hero-text">{flat.cookName}'s note hasn't come in. {owner} will add what's low tonight. You can add too.</p>
          )
        )}

        {(stage === 'list' || stage === 'nudged') && (
          <>
            {stage === 'nudged' && isOwner && <div className="nudge-banner">⏰ One reminder: tap "Ordered" once it's placed.</div>}
            <p className="hero-text">
              Tomorrow: <strong>{dish || 'dish not decided'}</strong> · {lines.length} {lines.length === 1 ? 'item' : 'items'} needed
            </p>
            <div className="emoji-row" onClick={() => goTo('list')}>
              {lines.slice(0, 8).map((l) => <span key={l.key} title={l.name}>{l.emoji}</span>)}
              {lines.length > 8 && <span className="more">+{lines.length - 8}</span>}
            </div>
            {isOwner ? (
              <button type="button" className="btn btn-primary btn-block" disabled={!lines.length} onClick={() => setOrder(true)}>{lines.length ? 'Order now' : 'Nothing to order'}</button>
            ) : (
              <p className="muted small">Only {owner} orders tonight, so nothing is bought twice. You can still add items.</p>
            )}
          </>
        )}

        {stage === 'ordered' && (
          <>
            <p className="hero-text">
              ✓ <strong>{tonight.ordered!.by === me.id ? 'You' : firstName(nameOf(db, tonight.ordered!.by))}</strong> ordered on {tonight.ordered!.app} at {fmtTime(tonight.ordered!.at)}. Tomorrow is sorted.
            </p>
            {tonight.ordered!.amount ? (
              <p className="muted small">₹{tonight.ordered!.amount} · ₹{Math.round(tonight.ordered!.amount / flat.memberIds.length)} each <button type="button" className="link" onClick={() => setOrder(true)}>Split</button></p>
            ) : null}
            <p className="muted small">Tomorrow's owner: {tomorrowOwner.ownerId === me.id ? 'you' : firstName(nameOf(db, tomorrowOwner.ownerId))}</p>
          </>
        )}

        <ol className="progress">
          {steps.map((s) => (
            <li key={s.k} className={s.done ? 'done' : ''}>
              <span className="dot">{s.done ? '✓' : ''}</span>
              <span className="p-k">{s.k}</span>
              <span className="p-sub">{s.sub}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Today's visit, from her evening note */}
      <section className="card">
        <div className="card-title">Today's cooking</div>
        {note ? (
          note.todayAllGood === false ? (
            <p>⚠️ {flat.cookName} was missing <strong>{note.todayMissing.map((k) => ingName(k)).join(', ') || 'something'}</strong> today.</p>
          ) : note.todayAllGood ? (
            <p>✅ {flat.cookName} had everything she needed today.</p>
          ) : (
            <p className="muted">She didn't say.</p>
          )
        ) : (
          <p className="muted">{flat.cookName} will tell us in her evening note.</p>
        )}
        {note && (note.voiceUrl || note.voiceSecs > 0) && <VoiceNote url={note.voiceUrl} secs={note.voiceSecs} label={`${flat.cookName} · ${fmtTime(note.at)}`} />}
      </section>

      {/* Tomorrow's dish */}
      {!tonight.skipped && (
        <section className="card">
          <div className="card-title">Tomorrow's dish</div>
          {tonight.dishSource === 'cook' ? (
            <p>🍛 <strong>{tonight.dish}</strong> <span className="muted small">· {flat.cookName} decided</span></p>
          ) : tonight.suggestionAnswer === 'accepted' ? (
            <p>🍛 <strong>{tonight.suggestion}</strong> <span className="muted small">· suggested from your usual dishes</span></p>
          ) : tonight.suggestionAnswer === 'changed' ? (
            <p>🍛 <strong>{tonight.dish}</strong> <span className="muted small">· changed by the flat</span></p>
          ) : tonight.suggestion ? (
            <>
              <p>How about <strong>{tonight.suggestion}</strong>? <span className="muted small">From your usual dishes, not made this week.</span></p>
              <div className="row gap8">
                <button type="button" className="btn btn-primary" onClick={() => updateTonight((e) => { e.suggestionAnswer = 'accepted'; e.dish = e.suggestion; e.dishSource = 'suggestion' })}>Sounds good</button>
                <button type="button" className="btn btn-outline" onClick={() => setPickDish(!pickDish)}>Something else</button>
              </div>
            </>
          ) : (
            <p className="muted">Add your usual dishes and we'll suggest one each evening. <button type="button" className="link" onClick={() => goTo('dishes')}>Add dishes</button></p>
          )}
          {pickDish && (
            <div className="chips">
              {flat.usualDishes.filter((d) => d !== tonight.suggestion).map((d) => (
                <button key={d} type="button" className="chip" onClick={() => { updateTonight((e) => { e.suggestionAnswer = 'changed'; e.dish = d; e.dishSource = 'flatmate' }); setPickDish(false) }}>{d}</button>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="card stats">
        {week.visits ? (
          <div>
            <div className="stat">{week.ready}<span>/{week.visits}</span></div>
            <div className="muted small">days this week {flat.cookName.split(' ')[0]} had everything</div>
          </div>
        ) : (
          <div className="muted small" style={{ maxWidth: 150 }}>Your first week starts tonight. We'll count the days {flat.cookName.split(' ')[0]} had everything.</div>
        )}
        <div className="fair-mini" onClick={() => goTo('turns')}>
          {[...fair.counts.entries()].map(([id, n]) => (
            <div key={id} className="fair-mini-row">
              <span>{id === me.id ? 'You' : firstName(nameOf(db, id))}</span>
              <span className="bar"><span style={{ width: `${fair.total ? (n / fair.total) * 100 : 0}%` }} /></span>
              <span className="muted small">{n}</span>
            </div>
          ))}
          <div className="muted small">Orders in the last 30 days</div>
        </div>
      </section>

      <OrderSheet open={order} onClose={() => setOrder(false)} />
      <AddItemSheet open={add} onClose={() => setAdd(false)} />
    </div>
  )
}
