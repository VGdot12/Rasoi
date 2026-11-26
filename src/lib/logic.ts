import { byKey, INGREDIENTS } from './catalogue'
import type { DB, Evening, Flat, ListLine, User } from './types'

// ---------- time ----------

export const pad = (n: number) => String(n).padStart(2, '0')
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

export function now(db: DB) {
  if (db.clock) return db.clock
  const d = new Date()
  return { date: isoDate(d), time: hhmm(d) }
}

export function addDays(date: string, n: number) {
  const d = new Date(date + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return isoDate(d)
}

export const weekday = (date: string) => new Date(date + 'T12:00:00').getDay()

export const fmtTime = (t: string) => {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ap = h >= 12 && h < 24 ? 'pm' : 'am'
  return `${((h + 11) % 12) + 1}:${pad(m)} ${ap}`
}

export const fmtDay = (date: string, today: string) => {
  if (date === today) return 'Today'
  if (date === addDays(today, -1)) return 'Yesterday'
  if (date === addDays(today, 1)) return 'Tomorrow'
  return new Date(date + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}

/** The evening: Didi's note at 8 pm, the list goes out at 10 pm with a reminder to tonight's owner
 *  that stays until the order is placed. */
export const DEADLINES = { prompt: '19:30', note: '20:00', list: '22:00' }

/** Prototype simulation: 7:30 pm to midnight, 20 seconds per hour (1 second = 10 minutes). */
export const SIM = { start: '19:30', end: '24:00', minutesPerSecond: 10 }

/** What happens on its own for the people you are not playing. */
export const AUTO = {
  orderAt: '23:00', // tonight's owner places the order by 11 pm
  deliveryMins: 20, // "Order received" opens 20 minutes after the order is placed
  receiveByFlatmateView: '23:45', // in Rohan's (flatmate) journey, Aditya receives it at 11:45 if Rohan hasn't
  receiveInCookView: '23:30', // in Didi's journey, the flat receives it at 11:30
}

export const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
export const fromMin = (n: number) => `${pad(Math.floor(n / 60))}:${pad(n % 60)}`

// ---------- ids ----------

export const uid = (p: string) => p + '_' + Math.random().toString(36).slice(2, 9)
export const inviteCode = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('')

// ---------- evenings and turns ----------

export const findEvening = (db: DB, flatId: string, date: string) => db.evenings.find((e) => e.flatId === flatId && e.date === date)

/** Next turn position: one step after the last evening that was not skipped. */
function nextTurnIndex(db: DB, flatId: string, date: string) {
  const prev = db.evenings.filter((e) => e.flatId === flatId && e.date < date).sort((a, b) => (a.date < b.date ? 1 : -1))[0]
  if (!prev) return 0
  return prev.skipped ? prev.turnIndex : prev.turnIndex + 1
}

export function newEvening(db: DB, flat: Flat, date: string): Evening {
  const turnIndex = nextTurnIndex(db, flat.id, date)
  const ownerId = flat.rotation.length ? flat.rotation[turnIndex % flat.rotation.length] : flat.memberIds[0] ?? ''
  return {
    flatId: flat.id,
    date,
    turnIndex,
    ownerId,
    handedOverFrom: null,
    note: null,
    extras: [],
    qtyEdits: {},
    removed: [],
    dish: '',
    dishSource: '',
    suggestion: suggestDish(db, flat, date),
    suggestionAnswer: null,
    fallbackAnswered: false,
    ordered: null,
    received: null,
    nudgeSeenAt: null,
    skipped: false,
    pantryAtStart: structuredClone(flat.pantry ?? []),
  }
}

/** Read an evening, or what it would look like if nobody has touched it yet. */
export const eveningOrDraft = (db: DB, flat: Flat, date: string) => findEvening(db, flat.id, date) ?? newEvening(db, flat, date)

export function ownerOn(db: DB, flat: Flat, date: string) {
  return eveningOrDraft(db, flat, date).ownerId
}

/** Upcoming owners, so everyone can see whose turn is next. */
export function upcomingTurns(db: DB, flat: Flat, from: string, days: number) {
  const out: { date: string; ownerId: string }[] = []
  const first = eveningOrDraft(db, flat, from)
  let idx = first.turnIndex
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i)
    const e = findEvening(db, flat.id, date)
    if (e) {
      out.push({ date, ownerId: e.ownerId })
      idx = e.skipped ? e.turnIndex : e.turnIndex + 1
    } else {
      out.push({ date, ownerId: flat.rotation.length ? flat.rotation[idx % flat.rotation.length] : '' })
      idx++
    }
  }
  return out
}

// ---------- dish suggestion (from the flat's own usual dishes) ----------

export function suggestDish(db: DB, flat: Flat, date: string) {
  if (!flat.usualDishes.length) return ''
  const recent = db.evenings
    .filter((e) => e.flatId === flat.id && e.date < date && e.dish)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 5)
    .map((e) => e.dish)
  const pool = flat.usualDishes.filter((d) => !recent.includes(d))
  const list = pool.length ? pool : flat.usualDishes
  const seed = date.split('-').reduce((n, x) => n + Number(x), 0)
  return list[seed % list.length]
}

// ---------- the one list ----------

export interface Line extends ListLine {
  name: string
  emoji: string
}

export function buildList(e: Evening): Line[] {
  const lines: ListLine[] = []
  const add = (key: string, addedBy: string, qty?: string) => {
    if (e.removed.includes(key)) return
    if (lines.some((l) => l.key === key)) return // bought once, not twice
    lines.push({ key, addedBy, qty: e.qtyEdits[key] || qty || byKey(key)?.qty || '1 Nos' })
  }
  e.note?.items.forEach((k) => add(k, 'cook'))
  e.extras.forEach((x) => add(x.key, x.addedBy, x.qty))
  return lines.map((l) => {
    const ing = byKey(l.key)
    return { ...l, name: ing?.en ?? l.key, emoji: ing?.emoji ?? '🛒', inCart: e.extras.find((x) => x.key === l.key)?.inCart }
  })
}

export const pasteList = (lines: Line[]) => lines.map((l) => `${l.name} ${l.qty}`.trim()).join('\n')

// ---------- where tonight stands ----------

export type Stage = 'skipped' | 'before-note' | 'no-note' | 'collecting' | 'list' | 'ordered' | 'received'

export function stageOf(e: Evening, time: string): Stage {
  if (e.skipped) return 'skipped'
  if (e.received) return 'received'
  if (e.ordered) return 'ordered'
  const noteIn = !!e.note || e.fallbackAnswered
  if (!noteIn && time < DEADLINES.note) return 'before-note'
  if (!noteIn) return 'no-note'
  if (time < DEADLINES.list) return 'collecting'
  return 'list'
}

/** The delivery arrived: tonight's items move into the kitchen. */
export function markReceived(d: DB, e: Evening, by: string, at: string) {
  e.received = { by, at }
  const f = d.flats.find((x) => x.id === e.flatId)
  if (!f) return
  f.pantry = f.pantry ?? []
  for (const l of buildList(e)) {
    const item = { key: l.key, qty: l.qty, since: e.date }
    const i = f.pantry.findIndex((p) => p.key === l.key)
    if (i >= 0) f.pantry.splice(i, 1)
    f.pantry.unshift(item)
  }
}

/** The cook said these ran out today: they leave the kitchen. */
export function removeFromPantry(d: DB, flatId: string, keys: string[]) {
  const f = d.flats.find((x) => x.id === flatId)
  if (f) f.pantry = (f.pantry ?? []).filter((p) => !keys.includes(p.key))
}

/** When the delivery can be marked as received. */
export const receiveOpensAt = (e: Evening) => (e.ordered ? fromMin(toMin(e.ordered.at) + AUTO.deliveryMins) : '')

/** The four milestones shown at the top of Tonight. */
export function milestones(e: Evening, time: string) {
  const listOut = (!!e.note || e.fallbackAnswered) && (time >= DEADLINES.list || !!e.ordered)
  return [
    { k: 'Didi\u2019s note', done: !!e.note || e.fallbackAnswered, at: e.note?.at ?? '', due: DEADLINES.note },
    { k: 'List created', done: listOut, at: listOut ? DEADLINES.list : '', due: DEADLINES.list },
    { k: 'Order placed', done: !!e.ordered, at: e.ordered?.at ?? '', due: AUTO.orderAt },
    { k: 'Order received', done: !!e.received, at: e.received?.at ?? '', due: AUTO.receiveByFlatmateView },
  ]
}

/**
 * One tick of the simulation clock. Everyone you are not playing acts on their own:
 * Didi's note at 8 pm (in her journey the clock waits for you instead), the owner's order at 11 pm,
 * and the delivery being received (11:45 pm in Rohan's journey, 11:30 pm in Didi's).
 */
export function simTick(d: DB) {
  const c = d.clock ?? { date: isoDate(new Date()), time: SIM.start }
  let next = fromMin(Math.min(toMin(SIM.end), toMin(c.time) + SIM.minutesPerSecond))
  const viewer = d.users.find((u) => u.id === d.sessionUserId)
  for (const f of d.flats) {
    if (viewer?.flatId !== f.id) continue
    let e = findEvening(d, f.id, c.date)
    if (e?.skipped) continue
    if (!e) {
      e = newEvening(d, f, c.date)
      d.evenings.push(e)
    }
    const isCook = viewer.role === 'cook'
    const isOwner = viewer.id === e.ownerId
    if (next >= DEADLINES.note && !e.note && !e.fallbackAnswered) {
      if (isCook) next = DEADLINES.note // her journey: wait for her note
      else autoNote(d, f, e)
    }
    if (next >= AUTO.orderAt && !e.ordered && !isOwner && buildList(e).length) {
      e.ordered = { by: e.ownerId, at: AUTO.orderAt, app: 'Blinkit', amount: 540 }
    }
    if (e.ordered && !e.received && !isOwner) {
      const at = isCook ? AUTO.receiveInCookView : AUTO.receiveByFlatmateView
      const by = isCook ? f.memberIds.find((id) => id !== e!.ownerId) ?? e.ownerId : e.ownerId
      if (next >= at && at >= receiveOpensAt(e)) markReceived(d, e, by, at)
    }
  }
  d.clock = { date: c.date, time: next }
}

export const finalDish = (e: Evening) => e.dish || (e.suggestionAnswer === 'accepted' ? e.suggestion : '')

/** In the simulation, Didi's note arrives at 8 pm if she has not sent one herself. */
export function autoNote(db: DB, _flat: Flat, e: Evening) {
  const seed = toMin(db.clock?.time ?? '20:00') + e.date.split('-').reduce((n, x) => n + Number(x), 0)
  const daily = INGREDIENTS.filter((i) => !i.staple)
  const items: string[] = []
  for (let k = 0; items.length < 3 && k < daily.length; k++) {
    const key = daily[(seed + k * 7) % daily.length].key
    if (!items.includes(key)) items.push(key)
  }
  // She doesn't name a dish in the simulated note, so the flat sees the dish decision.
  e.note = { at: DEADLINES.note, todayAllGood: true, todayMissing: [], dish: '', items, voiceUrl: '', voiceSecs: 19, staplesChecked: false, dayOffTomorrow: false }
}

// ---------- notifications ----------

export interface Note {
  id: string
  at: string
  title: string
  body: string
  tone: 'info' | 'action' | 'done'
}

export function notificationsFor(db: DB, user: User, flat: Flat): Note[] {
  const { date, time } = now(db)
  const e = eveningOrDraft(db, flat, date)
  const owner = nameOf(db, e.ownerId)
  const lines = buildList(e)
  const out: Note[] = []
  if (e.skipped) return [{ id: 'skip', at: DEADLINES.prompt, title: 'No cook tomorrow', body: 'Nobody orders tonight. Turns do not move.', tone: 'info' }]
  const listOut = (!!e.note || e.fallbackAnswered) && time >= DEADLINES.list
  if (user.role === 'cook') {
    if (time >= DEADLINES.prompt && !e.note)
      out.push({ id: 'prompt', at: DEADLINES.prompt, title: flat.name, body: 'Didi, kal kya banana hai aur kya khatam ho raha hai? Ek voice note bhej dijiye.', tone: 'action' })
  } else {
    if (e.note) out.push({ id: 'note', at: e.note.at, title: `${flat.cookName} sent tomorrow's note`, body: e.note.todayAllGood === false ? `Today something was missing: ${e.note.todayMissing.join(', ') || 'not named'}.` : 'Today she had everything.', tone: 'info' })
    if (!e.note && time >= DEADLINES.note && user.id === e.ownerId && !e.fallbackAnswered)
      out.push({ id: 'fallback', at: DEADLINES.note, title: 'Didi\u2019s note has not come in', body: `You are tonight's owner. If tomorrow is ${e.suggestion || 'the usual'}, what is low?`, tone: 'action' })
    if (listOut)
      out.push({ id: 'list', at: DEADLINES.list, title: 'List created', body: `Tomorrow: ${finalDish(e) || 'not decided'}. Needed: ${lines.map((l) => `${l.name.toLowerCase()} ${l.qty}`).join(', ') || 'nothing'}. Owner tonight: ${owner}.`, tone: 'info' })
    if (listOut && !e.ordered && lines.length && user.id === e.ownerId)
      out.push({ id: 'remind', at: DEADLINES.list, title: 'Reminder: place tonight\u2019s order', body: `${user.name}, you are tonight's owner. Tap \u2018Order placed\u2019 once it is done.`, tone: 'action' })
  }
  if (e.ordered) out.push({ id: 'ord', at: e.ordered.at, title: `Order placed by ${firstName(nameOf(db, e.ordered.by))}`, body: `On ${e.ordered.app}, ${lines.length} items for tomorrow.`, tone: 'done' })
  if (e.received) out.push({ id: 'rcv', at: e.received.at, title: `Order received`, body: `${firstName(nameOf(db, e.received.by))} received it. Everything is in the kitchen for tomorrow.`, tone: 'done' })
  return out.sort((a, b) => (a.at < b.at ? 1 : -1))
}

// ---------- people ----------

export const nameOf = (db: DB, id: string) => (id === 'cook' ? 'Cook' : db.users.find((u) => u.id === id)?.name ?? '—')
export const firstName = (s: string) => s.split(' ')[0]

// ---------- fairness and the week ----------

export function fairness(db: DB, flat: Flat, today: string, days = 30) {
  const since = addDays(today, -days)
  const counts = new Map<string, number>(flat.memberIds.map((id) => [id, 0]))
  let total = 0
  for (const e of db.evenings) {
    if (e.flatId !== flat.id || e.date < since || e.date > today || !e.ordered) continue
    counts.set(e.ordered.by, (counts.get(e.ordered.by) ?? 0) + 1)
    total++
  }
  return { counts, total }
}

/** Ready visits: the cook said she had everything (the North Star, as the flat sees it). */
export function weekReady(db: DB, flat: Flat, today: string) {
  const since = addDays(today, -6)
  const es = db.evenings.filter((e) => e.flatId === flat.id && e.date >= since && e.date <= today && !e.skipped && e.note)
  return { ready: es.filter((e) => e.note!.todayAllGood === true).length, visits: es.length }
}

/** Put an item on an evening's list (tonight's, or tomorrow's once tonight's order is placed). */
export function addToEvening(d: DB, flatId: string, date: string, key: string, qty: string, by: string) {
  const f = d.flats.find((x) => x.id === flatId)
  if (!f) return
  let e = findEvening(d, flatId, date)
  if (!e) {
    e = newEvening(d, f, date)
    d.evenings.push(e)
  }
  e.removed = e.removed.filter((r) => r !== key)
  if (!e.extras.some((x) => x.key === key) && !e.note?.items.includes(key)) e.extras.push({ key, qty, addedBy: by })
}
