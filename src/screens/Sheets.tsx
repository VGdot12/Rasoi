import { useEffect, useState } from 'react'
import { CopyBtn, QtyPicker, Sheet } from '../components/ui'
import { byKey, emojiOf, INGREDIENTS, unitTypeOf } from '../lib/catalogue'
import { abandonTask, finishTask, startTask, taskOpen, taskStep, track } from '../lib/analytics'
import { addDays, addToEvening, buildList, confirmOrder, findEvening, firstName, hhmm, nameOf, newEvening, now, pasteList } from '../lib/logic'
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
export function AddItemSheet({ open, onClose, source = 'flatmate_sheet' }: { open: boolean; onClose: () => void; source?: string }) {
  const { db, me, flat, tonight, update, updateTonight } = useStore()
  const [custom, setCustom] = useState('')
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  // Effort: the add_item task runs from opening the sheet (that tap counts) to Done.
  useEffect(() => {
    if (open && !taskOpen('add_item')) startTask('add_item', 1)
  }, [open])
  if (!me || !flat || !tonight) return null
  const locked = !!tonight.ordered
  const lines = buildList(tonight)
  const onList = (k: string) => lines.some((l) => l.key === k)

  /** Change the evening the new items go to: tonight, or tomorrow once tonight's order is placed. */
  const target = (fn: (e: Evening, d: DB) => void) => {
    if (!locked) return updateTonight((e, d) => fn(e, d))
    update((d: DB) => {
      const f = d.flats.find((x) => x.id === flat.id)!
      const date = addDays(now(d).date, 1)
      let e = findEvening(d, f.id, date)
      if (!e) {
        e = newEvening(d, f, date)
        d.evenings.push(e)
      }
      fn(e, d)
    })
  }
  const ctx = () => ({ flatId: flat.id, who: me.id })
  const itemId = (k: string) => (byKey(k) ? k : 'custom')

  const add = (key: string) => {
    if (picked.includes(key) || (!locked && onList(key))) {
      // Tapping an item already on the list: blocked, so nothing is bought twice.
      update((d) => track(d, 'item_add_blocked', ctx(), { item_id: itemId(key) }))
      return
    }
    update((d) => void addToEvening(d, flat.id, addDays(now(d).date, locked ? 1 : 0), key, defaultQty(key), me.id, source))
    setPicked((p) => [...p, key])
    taskStep('add_item', 'item_added')
  }
  const setQty = (key: string, qty: string) =>
    target((e, d) => {
      const from = e.qtyEdits[key] ?? e.extras.find((y) => y.key === key)?.qty ?? defaultQty(key)
      e.qtyEdits[key] = qty
      const x = e.extras.find((y) => y.key === key)
      if (x) x.qty = qty
      track(d, 'item_changed', ctx(), { change: 'quantity', item_id: itemId(key), from, to: qty })
    })
  const unpick = (key: string) => {
    target((e, d) => {
      const from = e.extras.find((x) => x.key === key)?.qty ?? null
      e.extras = e.extras.filter((x) => x.key !== key)
      track(d, 'item_changed', ctx(), { change: 'removed', item_id: itemId(key), from, to: null })
    })
    setPicked((p) => p.filter((k) => k !== key))
  }
  const qtyOf = (key: string) => {
    const e = locked ? findEvening(db, flat.id, addDays(now(db).date, 1)) : tonight
    return e?.qtyEdits[key] ?? e?.extras.find((x) => x.key === key)?.qty ?? defaultQty(key)
  }

  const shown = INGREDIENTS.filter((i) => !q || i.en.toLowerCase().includes(q.toLowerCase()))
  const close = () => {
    const done = picked.length ? finishTask('add_item') : null
    const gave = done ? null : abandonTask('add_item')
    update((d) => {
      if (done) track(d, 'task_completed', ctx(), done)
      if (gave) track(d, 'task_abandoned', ctx(), gave)
    })
    setPicked([])
    onClose()
  }
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
            <button key={i.key} type="button" className={`tile ${taken ? 'tile-on' : ''}`} aria-disabled={taken} onClick={() => add(i.key)}>
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
  const { db, me, flat, tonight, update, updateTonight } = useStore()
  const [app, setApp] = useState<OrderApp>('Blinkit')
  const [amount, setAmount] = useState('')
  const ordered = !!tonight?.ordered
  // order_started, and the place_order task from the Order now tap to Order placed.
  useEffect(() => {
    if (!open || ordered || !me || !flat || !tonight || taskOpen('place_order')) return
    startTask('place_order', 1)
    update((d) => track(d, 'order_started', { flatId: flat.id, who: me.id }, { item_count: buildList(tonight).length }))
  }, [open, ordered]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!me || !flat || !tonight) return null
  const close = () => {
    const gave = !tonight.ordered ? abandonTask('place_order') : null
    if (gave) update((d) => track(d, 'task_abandoned', { flatId: flat.id, who: me.id }, gave))
    onClose()
  }
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
      </Sheet>
    )
  }

  return (
    <Sheet open={open} onClose={close} title="Order tomorrow's list">
      <ol className="order-steps">
        <li>
          <strong>Copy the list</strong>
          <pre className="paste">{pasteList(lines) || 'The list is empty.'}</pre>
          <CopyBtn text={pasteList(lines)} label="Copy list" onCopy={() => update((d) => track(d, 'list_copied', { flatId: flat.id, who: me.id }, { item_count: lines.length }))} />
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
        onClick={() => {
          const done = finishTask('place_order')
          updateTonight((e, d) => {
            confirmOrder(d, e, me.id, d.clock?.time ?? hhmm(new Date()), app, amt || null)
            if (done) track(d, 'task_completed', { flatId: flat.id, who: me.id }, done)
          })
        }}
      >
        ✓ Order placed
      </button>
      <p className="fine">Rasoi Ready never orders without you. You place the order in your own app.</p>
    </Sheet>
  )
}
