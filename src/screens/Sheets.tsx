import { useState } from 'react'
import { CopyBtn, Sheet } from '../components/ui'
import { INGREDIENTS } from '../lib/catalogue'
import { addDays, buildList, findEvening, firstName, hhmm, nameOf, newEvening, now, pasteList } from '../lib/logic'
import { useStore } from '../lib/store'
import type { OrderApp } from '../lib/types'

const APPS: { app: OrderApp; url: string }[] = [
  { app: 'Blinkit', url: 'https://blinkit.com' },
  { app: 'Zepto', url: 'https://www.zeptonow.com' },
  { app: 'Instamart', url: 'https://www.swiggy.com/instamart' },
]

/** Add something that is running low. After the order is placed it goes to tomorrow's list instead. */
export function AddItemSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { db, me, flat, tonight, update, updateTonight } = useStore()
  const [custom, setCustom] = useState('')
  const [q, setQ] = useState('')
  if (!me || !flat || !tonight) return null
  const lines = buildList(tonight)
  const locked = !!tonight.ordered
  const onList = (k: string) => lines.some((l) => l.key === k)

  const add = (key: string) => {
    if (!locked) {
      updateTonight((e) => {
        e.removed = e.removed.filter((r) => r !== key)
        if (!e.extras.some((x) => x.key === key) && !e.note?.items.includes(key)) e.extras.push({ key, qty: '', addedBy: me.id })
      })
      return
    }
    update((d) => {
      const f = d.flats.find((x) => x.id === flat.id)!
      const date = addDays(now(d).date, 1)
      let e = findEvening(d, f.id, date)
      if (!e) {
        e = newEvening(d, f, date)
        d.evenings.push(e)
      }
      if (!e.extras.some((x) => x.key === key)) e.extras.push({ key, qty: '', addedBy: me.id })
    })
  }

  const shown = INGREDIENTS.filter((i) => !q || i.en.toLowerCase().includes(q.toLowerCase()))
  return (
    <Sheet open={open} onClose={onClose} title={locked ? 'Add to tomorrow’s list' : 'Add to tonight’s list'}>
      {locked && (
        <p className="callout">
          {firstName(nameOf(db, tonight.ordered!.by))} already ordered tonight. New items go on tomorrow's list, so nothing is bought twice.
        </p>
      )}
      <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" />
      <div className="tiles">
        {shown.map((i) => (
          <button key={i.key} type="button" className={`tile ${!locked && onList(i.key) ? 'tile-on' : ''}`} disabled={!locked && onList(i.key)} onClick={() => add(i.key)}>
            <span className="tile-emoji">{i.emoji}</span>
            <span>{i.en}</span>
            {!locked && onList(i.key) && <span className="tile-tag">on list</span>}
          </button>
        ))}
      </div>
      <div className="row gap8">
        <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Something else, e.g. Maggi" />
        <button type="button" className="btn btn-outline" disabled={!custom.trim()} onClick={() => { add(custom.trim()); setCustom('') }}>Add</button>
      </div>
      <button type="button" className="btn btn-primary btn-block" onClick={onClose}>Done</button>
    </Sheet>
  )
}

/** The owner orders in their own app. Rasoi Ready never orders, pays or delivers. */
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
      <Sheet open={open} onClose={onClose} title="Ordered">
        <div className="done-mark">✓</div>
        <p className="center">
          <strong>{nameOf(db, tonight.ordered.by)}</strong> ordered on {tonight.ordered.app}. {flat.cookName} will have everything tomorrow.
        </p>
        {tonight.ordered.amount ? (
          <div className="split">
            <div>Bill <strong>₹{tonight.ordered.amount}</strong></div>
            <div>{heads} flatmates · <strong>₹{per} each</strong></div>
            <a className="btn btn-outline btn-block" href="https://secure.splitwise.com/" target="_blank" rel="noreferrer">Add it on Splitwise</a>
          </div>
        ) : null}
        <button type="button" className="link center-block" onClick={() => { updateTonight((e) => void (e.ordered = null)); }}>Undo "ordered"</button>
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
              <a key={a.app} className={`app-btn app-${a.app.toLowerCase()}`} href={a.url} target="_blank" rel="noreferrer" onClick={() => setApp(a.app)}>
                {a.app}
              </a>
            ))}
          </div>
        </li>
        <li>
          <strong>Tell the flat it's done</strong>
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
        ✓ Ordered
      </button>
      <p className="fine">Rasoi Ready never orders without you. You place the order in your own app.</p>
    </Sheet>
  )
}
