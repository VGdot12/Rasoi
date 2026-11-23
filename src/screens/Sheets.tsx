import { useState } from 'react'
import { CopyBtn, QtyPicker, Sheet } from '../components/ui'
import { byKey, emojiOf, INGREDIENTS, unitTypeOf } from '../lib/catalogue'
import { addDays, buildList, findEvening, firstName, hhmm, nameOf, newEvening, now, pasteList } from '../lib/logic'
import { formatQty, parseQty } from '../lib/qty'
import { useStore } from '../lib/store'
import type { DB, Evening, OrderApp } from '../lib/types'

const APPS: { app: OrderApp; url: string }[] = [
  { app: 'Blinkit', url: 'https://blinkit.com' },
  { app: 'Zepto', url: 'https://www.zeptonow.com' },
  { app: 'Instamart', url: 'https://www.swiggy.com/instamart' },
]

const defaultQty = (key: string) => byKey(key)?.qty ?? formatQty(parseQty('', unitTypeOf(key)))

/** Add something that is running low, and pick its quantity. After the order is placed it goes to tomorrow's list. */
export function AddItemSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { db, me, flat, tonight, update, updateTonight } = useStore()
  const [custom, setCustom] = useState('')
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  if (!me || !flat || !tonight) return null
  const locked = !!tonight.ordered
  const lines = buildList(tonight)
  const onList = (k: string) => lines.some((l) => l.key === k)

  /** Change the evening the new items go to: tonight, or tomorrow once tonight's order is placed. */
  const target = (fn: (e: Evening) => void) => {
    if (!locked) return updateTonight((e) => fn(e))
    update((d: DB) => {
      const f = d.flats.find((x) => x.id === flat.id)!
      const date = addDays(now(d).date, 1)
      let e = findEvening(d, f.id, date)
      if (!e) {
        e = newEvening(d, f, date)
        d.evenings.push(e)
      }
      fn(e)
    })
  }

  const add = (key: string) => {
    target((e) => {
      e.removed = e.removed.filter((r) => r !== key)
      if (!e.extras.some((x) => x.key === key) && !e.note?.items.includes(key)) e.extras.push({ key, qty: defaultQty(key), addedBy: me.id })
    })
    setPicked((p) => (p.includes(key) ? p : [...p, key]))
  }
  const setQty = (key: string, qty: string) =>
    target((e) => {
      e.qtyEdits[key] = qty
      const x = e.extras.find((y) => y.key === key)
      if (x) x.qty = qty
    })
  const unpick = (key: string) => {
    target((e) => { e.extras = e.extras.filter((x) => x.key !== key) })
    setPicked((p) => p.filter((k) => k !== key))
  }
  const qtyOf = (key: string) => {
    const e = locked ? findEvening(db, flat.id, addDays(now(db).date, 1)) : tonight
    return e?.qtyEdits[key] ?? e?.extras.find((x) => x.key === key)?.qty ?? defaultQty(key)
  }

  const shown = INGREDIENTS.filter((i) => !q || i.en.toLowerCase().includes(q.toLowerCase()))
  const close = () => { setPicked([]); onClose() }
  return (
    <Sheet open={open} onClose={close} title={locked ? 'Add to tomorrow’s list' : 'Add to tonight’s list'}>
      {locked && <p className="callout">{firstName(nameOf(db, tonight.ordered!.by))} already placed tonight's order. New items go on tomorrow's list, so nothing is bought twice.</p>}

      {picked.length > 0 && (
        <div className="picked">
          <div className="card-title">Added · set the quantity</div>
          {picked.map((k) => (
            <div key={k} className="picked-row">
              <span className="line-emoji">{emojiOf(k)}</span>
              <span className="line-name">{byKey(k)?.en ?? k}</span>
              <QtyPicker label={byKey(k)?.en ?? k} value={qtyOf(k)} type={unitTypeOf(k)} onChange={(v) => setQty(k, v)} />
              <button type="button" className="icon-btn" aria-label={`Remove ${k}`} onClick={() => unpick(k)}>✕</button>
            </div>
          ))}
        </div>
      )}

      <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" />
      <div className="tiles">
        {shown.map((i) => {
          const taken = picked.includes(i.key) || (!locked && onList(i.key))
          return (
            <button key={i.key} type="button" className={`tile ${taken ? 'tile-on' : ''}`} disabled={taken} onClick={() => add(i.key)}>
              <span className="tile-emoji">{i.emoji}</span>
              <span>{i.en}</span>
              {taken && <span className="tile-tag">{picked.includes(i.key) ? 'added' : 'on list'}</span>}
            </button>
          )
        })}
      </div>
      <div className="row gap8">
        <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Something else, e.g. Maggi" />
        <button type="button" className="btn btn-outline" disabled={!custom.trim()} onClick={() => { add(custom.trim()); setCustom('') }}>Add</button>
      </div>
      <button type="button" className="btn btn-primary btn-block" onClick={close}>Done</button>
    </Sheet>
  )
}

/** The owner orders in their own app, then taps "Order placed". Rasoi Ready never orders, pays or delivers. */
export function OrderSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { db, me, flat, tonight, updateTonight } = useStore()
  const [app, setApp] = useState<OrderApp>('Blinkit')
  const [amount, setAmount] = useState('')
  if (!me || !flat || !tonight) return null
  const lines = buildList(tonight)
  const heads = flat.memberIds.length || 1
  const amt = Number(amount) || 0

  if (tonight.ordered) {
    const per = tonight.ordered.amount ? Math.round(tonight.ordered.amount / heads) : 0
    return (
      <Sheet open={open} onClose={onClose} title="Order placed">
        <div className="done-mark">✓</div>
        <p className="center">
          <strong>{tonight.ordered.by === me.id ? 'Done!' : nameOf(db, tonight.ordered.by)}</strong> Everyone in {flat.name} can see the order is placed on {tonight.ordered.app}. It should arrive in about 20 minutes.
        </p>
        {tonight.ordered.amount ? (
          <div className="split">
            <div>Bill <strong>₹{tonight.ordered.amount}</strong></div>
            <div>{heads} flatmates · <strong>₹{per} each</strong></div>
            <a className="btn btn-outline btn-block" href="https://secure.splitwise.com/" target="_blank" rel="noreferrer">Add it on Splitwise</a>
          </div>
        ) : null}
        <button type="button" className="btn btn-primary btn-block" onClick={onClose}>Done</button>
        {!tonight.received && <button type="button" className="link center-block" onClick={() => updateTonight((e) => void (e.ordered = null))}>Undo "Order placed"</button>}
      </Sheet>
    )
  }

  return (
    <Sheet open={open} onClose={onClose} title="Order tomorrow's list">
      <ol className="order-steps">
        <li>
          <strong>Copy the list</strong>
          <pre className="paste">{pasteList(lines) || 'The list is empty.'}</pre>
          <CopyBtn text={pasteList(lines)} label="Copy list" />
        </li>
        <li>
          <strong>Order in your app</strong>
          <div className="apps">
            {APPS.map((a) => (
              <a key={a.app} className={`app-btn app-${a.app.toLowerCase()}`} href={a.url} target="_blank" rel="noreferrer" onClick={() => setApp(a.app)}>{a.app}</a>
            ))}
          </div>
        </li>
        <li>
          <strong>Tell the flat it's placed</strong>
          <div className="seg">
            {(['Blinkit', 'Zepto', 'Instamart', 'Other'] as OrderApp[]).map((a) => (
              <button key={a} type="button" className={app === a ? 'on' : ''} onClick={() => setApp(a)}>{a}</button>
            ))}
          </div>
          <label className="field">
            <span>Bill amount (optional, to split)</span>
            <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} placeholder="₹" />
          </label>
          {amt > 0 && <p className="muted small">₹{amt} ÷ {heads} flatmates = ₹{Math.round(amt / heads)} each</p>}
        </li>
      </ol>
      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={!lines.length}
        onClick={() => updateTonight((e, d) => void (e.ordered = { by: me.id, at: d.clock?.time ?? hhmm(new Date()), app, amount: amt || null }))}
      >
        ✓ Order placed
      </button>
      <p className="fine">Rasoi Ready never orders without you. You place the order in your own app.</p>
    </Sheet>
  )
}
