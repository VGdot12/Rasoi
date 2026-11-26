import { useState } from 'react'
import { CopyBtn, QtyPicker } from '../components/ui'
import { byKey, emojiOf, unitTypeOf } from '../lib/catalogue'
import {
  addDays, addToEvening, AUTO, buildList, DEADLINES, findEvening, firstName, fmtDay, fmtTime, nameOf, now, pasteList, receiveOpensAt, stageOf,
} from '../lib/logic'
import { useStore } from '../lib/store'
import { AddItemSheet, OrderSheet } from './Sheets'

/**
 * Groceries: what needs ordering (top) and what is already in the kitchen (bottom).
 * When an order is received, its items move from "To order" into "In the kitchen".
 */
const sinceLabel = (since: string, today: string) => {
  const d = fmtDay(since, today)
  return d === 'Today' ? 'Arrived today' : d === 'Yesterday' ? 'Since yesterday' : `Since ${d}`
}

export function GroceriesTab() {
  const { db, me, flat, tonight, today, time, update, updateTonight } = useStore()
  const [add, setAdd] = useState(false)
  const [order, setOrder] = useState(false)
  if (!me || !flat || !tonight) return null

  const lines = buildList(tonight)
  const stage = stageOf(tonight, time)
  const locked = !!tonight.ordered
  const received = !!tonight.received
  const isOwner = tonight.ownerId === me.id
  const owner = firstName(nameOf(db, tonight.ownerId))
  const tomorrow = findEvening(db, flat.id, addDays(today, 1))
  const nextLines = tomorrow ? buildList(tomorrow) : []
  const onList = new Set([...(received ? [] : lines.map((l) => l.key)), ...nextLines.map((l) => l.key)])
  const pantry = [...(flat.pantry ?? [])]
  const who = (id: string) => (id === 'cook' ? flat.cookName.split(' ')[0] : id === me.id ? 'you' : firstName(nameOf(db, id)))

  const status =
    stage === 'skipped'
      ? 'No cook tomorrow, so nothing to order tonight.'
      : received
        ? `Received by ${who(tonight.received!.by)} at ${fmtTime(tonight.received!.at)}. Everything moved to In the kitchen.`
        : locked
          ? `Ordered by ${who(tonight.ordered!.by)} on ${tonight.ordered!.app} at ${fmtTime(tonight.ordered!.at)} · arriving from ${fmtTime(receiveOpensAt(tonight))}`
          : time >= DEADLINES.list && (tonight.note || tonight.fallbackAnswered)
            ? isOwner
              ? `Your turn: order these by ${fmtTime(AUTO.orderAt)}.`
              : `${owner} is ordering these by ${fmtTime(AUTO.orderAt)}.`
            : `Being collected. The list goes out at ${fmtTime(DEADLINES.list)}.`

  const addFromKitchen = (key: string, qty: string) =>
    update((d) => addToEvening(d, flat.id, addDays(now(d).date, locked ? 1 : 0), key, qty, me.id))

  return (
    <div className="screen">
      <div className="hello">
        <div>
          <div className="muted small">{flat.name}</div>
          <h2>Groceries</h2>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setAdd(true)}>+ Add item</button>
      </div>

      {/* ---- To order ---- */}
      <section className="card groc">
        <div className="groc-head">
          <span className="card-title">To order</span>
          <span className={`groc-state ${received ? 'ok' : locked ? 'way' : ''}`}>{received ? 'Received' : locked ? 'Ordered' : 'Needed'}</span>
        </div>
        <p className="groc-status">{status}</p>

        {!received && !tonight.skipped && (
          lines.length === 0 ? (
            <p className="muted">Nothing yet. {flat.cookName}'s 8 pm note fills this in, or add something yourself.</p>
          ) : (
            <ul className="lines">
              {lines.map((l) => (
                <li key={l.key} className={locked ? 'locked' : ''}>
                  <span className="line-emoji">{l.emoji}</span>
                  <span className="line-name">
                    {l.name}
                    <span className="muted small">added by {who(l.addedBy)}</span>
                  </span>
                  <QtyPicker label={l.name} value={l.qty} type={unitTypeOf(l.key)} disabled={locked} onChange={(v) => updateTonight((ev) => { ev.qtyEdits[l.key] = v; const x = ev.extras.find((y) => y.key === l.key); if (x) x.qty = v })} />
                  {!locked && (
                    <button type="button" className="icon-btn" aria-label={`Remove ${l.name}`} onClick={() => updateTonight((ev) => { ev.removed.push(l.key); ev.extras = ev.extras.filter((x) => x.key !== l.key) })}>✕</button>
                  )}
                </li>
              ))}
            </ul>
          )
        )}

        {stage === 'list' && isOwner && lines.length > 0 && (
          <button type="button" className="btn btn-primary btn-block" onClick={() => setOrder(true)}>Order now</button>
        )}
        {!received && lines.length > 0 && (
          <div className="row gap8 wrap">
            <CopyBtn text={pasteList(lines)} label="Copy list" className="btn btn-quiet btn-sm" />
          </div>
        )}

        {nextLines.length > 0 && (
          <div className="next-list">
            <div className="muted small">For tomorrow's order</div>
            <div className="chips">
              {nextLines.map((l) => <span key={l.key} className="chip">{l.emoji} {l.name} · {l.qty}</span>)}
            </div>
          </div>
        )}
      </section>

      {/* ---- In the kitchen ---- */}
      <section className="card groc kitchen">
        <div className="groc-head">
          <span className="card-title">In the kitchen · {pantry.length}</span>
        </div>
        <p className="muted small">What {flat.cookName} has to cook with. Running low? Tap Order.</p>
        {pantry.length === 0 ? (
          <p className="muted">Nothing recorded yet. Items move here when an order is received.</p>
        ) : (
          <ul className="pantry">
            {pantry.map((p) => {
              const fresh = received && p.since === today
              const low = onList.has(p.key)
              return (
                <li key={p.key} className={fresh ? 'fresh' : ''}>
                  <span className="line-emoji">{emojiOf(p.key)}</span>
                  <span className="line-name">
                    <span>{byKey(p.key)?.en ?? p.key} <span className="pantry-qty">{p.qty}</span></span>
                    <span className="muted small">{fresh ? 'Just arrived' : sinceLabel(p.since, today)}</span>
                  </span>
                  {low ? (
                    <span className="tag tag-low">On the list</span>
                  ) : (
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => addFromKitchen(p.key, p.qty)}>+ Order</button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <AddItemSheet open={add} onClose={() => setAdd(false)} />
      <OrderSheet open={order} onClose={() => setOrder(false)} />
    </div>
  )
}
