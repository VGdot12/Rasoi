import { byKey, INGREDIENTS } from './catalogue'
import { personId as hashPerson, track } from './analytics'
import type { DB, Evening, Flat, ListLine, OrderApp, User } from './types'

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

/** Prototype simulation: 7:30 pm to midnight. Each real second moves the clock minutesPerSecond minutes
 *  (10 = about 6 seconds per hour, 27 seconds for the evening). */
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
  if (e.received) return
  e.received = { by, at }
  const f = d.flats.find((x) => x.id === e.flatId)
  if (!f) return
  f.pantry = f.pantry ?? []
  const lines = buildList(e)
  for (const l of lines) {
    const item = { key: l.key, qty: l.qty, since: e.date }
    const i = f.pantry.findIndex((p) => p.key === l.key)
    if (i >= 0) f.pantry.splice(i, 1)
    f.pantry.unshift(item)
  }
  track(d, 'order_received', { flatId: f.id, who: by, at, date: e.date }, {
    received_by_owner: by === e.ownerId,
    minutes_after_order: e.ordered ? toMin(at) - toMin(e.ordered.at) : null,
    items_moved_to_kitchen: lines.length,
  })
}

/** The owner taps Order placed (or, in the simulation, the owner you aren't playing does). */
export function confirmOrder(d: DB, e: Evening, by: string, at: string, app: OrderApp, amount: number | null) {
  if (e.ordered) return
  e.ordered = { by, at, app, amount }
  track(d, 'order_confirmed', { flatId: e.flatId, who: by, at, date: e.date }, {
    app_used: app.toLowerCase(),
    item_count: buildList(e).length,
    bill_entered: amount !== null,
    bill_amount_inr: amount,
    minutes_after_list: toMin(at) - toMin(DEADLINES.list),
  })
}

/** Tonight's owner asks another flatmate to take over. It switches only when they accept. */
export function requestHandover(d: DB, e: Evening, from: string, to: string, at: string) {
  e.handoverPending = { from, to, at }
  track(d, 'ask_sent', { flatId: e.flatId, who: '', at, date: e.date }, { ask_type: 'handover_request', recipient: personIdOf(d, e.flatId, to), channel: 'in_app' })
}

export function answerHandover(d: DB, e: Evening, accepted: boolean, at: string) {
  const p = e.handoverPending
  if (!p) return
  if (accepted) {
    e.handedOverFrom = p.from
    e.ownerId = p.to
  }
  e.handoverPending = null
  track(d, 'turn_handed_over', { flatId: e.flatId, who: p.to, at, date: e.date }, {
    from_person_id: personIdOf(d, e.flatId, p.from),
    to_person_id: personIdOf(d, e.flatId, p.to),
    accepted,
    minutes_after_list: toMin(at) - toMin(DEADLINES.list),
  })
}

const personIdOf = (d: DB, flatId: string, who: string) => hashPerson(d, who, flatId)

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
    // The cook's one ask a day: her evening prompt.
    if (!e.note) track(d, 'ask_sent', { flatId: f.id, who: '', at: DEADLINES.prompt, date: e.date, once: 'cook_prompt' }, { ask_type: 'cook_prompt', recipient: hashPerson(d, f.cookId ?? 'cook', f.id), channel: 'in_app' })
    if (next >= DEADLINES.note && !e.note && !e.fallbackAnswered) {
      if (isCook) next = DEADLINES.note // her journey: wait for her note
      else autoNote(d, f, e)
    }
    // A hand-over to someone you aren't playing is accepted 10 minutes later.
    if (e.handoverPending && e.handoverPending.to !== viewer.id && toMin(next) >= toMin(e.handoverPending.at) + 10) answerHandover(d, e, true, fromMin(toMin(e.handoverPending.at) + 10))
    // 10 pm: the list goes out, and tonight's owner gets the one reminder.
    if (c.time < DEADLINES.list && next >= DEADLINES.list && (e.note || e.fallbackAnswered)) postList(d, f, e)
    const isOwner = viewer.id === e.ownerId
    if (next >= AUTO.orderAt && !e.ordered && !isOwner && buildList(e).length) confirmOrder(d, e, e.ownerId, AUTO.orderAt, 'Blinkit', 540)
    if (e.ordered && !e.received && !isOwner) {
      const at = isCook ? AUTO.receiveInCookView : AUTO.receiveByFlatmateView
      const by = isCook ? f.memberIds.find((id) => id !== e!.ownerId) ?? e.ownerId : e.ownerId
      if (next >= at && at >= receiveOpensAt(e)) markReceived(d, e, by, at)
    }
  }
  d.clock = { date: c.date, time: next }
}

/** 10 pm: list_posted (a server event) and the owner's reminder, which stays until the order is placed. */
export function postList(d: DB, f: Flat, e: Evening) {
  const lines = buildList(e)
  const fromCook = lines.filter((l) => l.addedBy === 'cook').length
  track(d, 'list_posted', { flatId: f.id, who: '', at: DEADLINES.list, date: e.date, once: 'list_posted' }, {
    item_count: lines.length,
    from_cook_count: fromCook,
    from_flatmates_count: lines.length - fromCook,
    minutes_after_note: e.note ? toMin(DEADLINES.list) - toMin(e.note.at) : null,
    owner_person_id: hashPerson(d, e.ownerId, f.id),
    turn_number: e.turnIndex + 1,
  })
  if (lines.length && !e.ordered)
    track(d, 'ask_sent', { flatId: f.id, who: '', at: DEADLINES.list, date: e.date, once: 'owner_reminder' }, { ask_type: 'owner_reminder', recipient: hashPerson(d, e.ownerId, f.id), channel: 'in_app' })
}

export const finalDish = (e: Evening) => e.dish || (e.suggestionAnswer === 'accepted' ? e.suggestion : '')

/** In the simulation, Didi's note arrives at 8 pm if she has not sent one herself. */
export function autoNote(db: DB, flat: Flat, e: Evening) {
  const seed = toMin(db.clock?.time ?? '20:00') + e.date.split('-').reduce((n, x) => n + Number(x), 0)
  const daily = INGREDIENTS.filter((i) => !i.staple)
  const items: string[] = []
  for (let k = 0; items.length < 3 && k < daily.length; k++) {
    const key = daily[(seed + k * 7) % daily.length].key
    if (!items.includes(key)) items.push(key)
  }
  // "Did today have everything?" follows from last night's order.
  const prev = findEvening(db, flat.id, addDays(e.date, -1))
  const prevLines = prev && !prev.skipped ? buildList(prev) : []
  const gotAll = !prev || prev.skipped || !prevLines.length || !!prev.received
  const missing = gotAll ? [] : prevLines.slice(0, 1).map((l) => l.key)
  // She doesn't name a dish in the simulated note, so the flat sees the dish decision.
  e.note = {
    at: DEADLINES.note, todayAllGood: gotAll, todayMissing: missing, dish: '', items, voiceUrl: '', voiceSecs: 19, staplesChecked: false, dayOffTomorrow: false,
    plannedDishCooked: prev && finalDish(prev) ? true : null, topUp: false, notFresh: [], dishWasSuggested: false, prompted: wasPrompted(db, flat.id, e.date),
  }
  if (missing.length) removeFromPantry(db, flat.id, missing)
  fireNoteEvents(db, flat, e, flat.cookId ?? 'cook')
}

/** Whether the cook's prompt reached her before her note ("came back" when it didn't). */
export const wasPrompted = (d: DB, flatId: string, date: string) =>
  (d.events ?? []).some((x) => x.flat_id === flatId && x.evening_date === date && x.event_name === 'ask_sent' && x.props.ask_type === 'cook_prompt')

const itemId = (k: string) => (byKey(k) ? k : 'custom')
const qtyParts = (q: string) => {
  const [a, u] = q.split(' ')
  return { quantity: Number(a) || null, unit: u || null }
}

/** Everything the cook's note sends (spec section 5): the note, her visit check, items, dish, day off, top-up, freshness. */
export function fireNoteEvents(d: DB, f: Flat, e: Evening, who: string, edited = false) {
  const n = e.note
  if (!n) return
  const ctx = { flatId: f.id, who, at: n.at, date: e.date }
  track(d, 'cook_note_received', ctx, {
    minutes_vs_8pm: toMin(n.at) - toMin(DEADLINES.note),
    dish_named: !!n.dish,
    dish_was_suggested: !!n.dishWasSuggested,
    running_out_count: n.items.length,
    has_voice_note: n.voiceSecs > 0,
    voice_seconds: n.voiceSecs,
    prompted: n.prompted ?? true,
    edited,
  })
  for (const slot of f.cookVisits === 2 ? ['morning', 'evening'] : ['evening'])
    track(d, 'cook_visit_checked', ctx, {
      visit_date: e.date,
      visit_slot: slot,
      nothing_missing: n.todayAllGood === true,
      missing_item_ids: n.todayMissing.map(itemId),
      planned_dish_cooked: n.plannedDishCooked ?? null,
    })
  if (n.topUp) track(d, 'top_up_reported', ctx, { visit_date: e.date, items_count: n.todayMissing.length || 1, reported_by_role: 'cook' })
  for (const k of n.notFresh ?? []) track(d, 'freshness_reported', ctx, { item_id: itemId(k), reported_by_role: 'cook' })
  if (!edited)
    for (const k of n.items)
      track(d, 'item_added', ctx, {
        source: byKey(k)?.staple && n.staplesChecked ? 'staples_day' : 'cook_note',
        item_id: itemId(k),
        ...qtyParts(byKey(k)?.qty ?? '1 Nos'),
        list_for: 'tonight',
        before_list_posted: true,
      })
  if (n.dish) track(d, 'dish_decided', ctx, { method: 'cook_named', dish_id: n.dish, decided_by_role: 'cook' })
  if (n.dayOffTomorrow) track(d, 'cook_day_off_marked', ctx, { for_date: addDays(e.date, 1) })
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

/** Put an item on an evening's list (tonight's, or tomorrow's once tonight's order is placed). Returns false if already there. */
export function addToEvening(d: DB, flatId: string, date: string, key: string, qty: string, by: string, source = 'flatmate_sheet') {
  const f = d.flats.find((x) => x.id === flatId)
  if (!f) return false
  let e = findEvening(d, flatId, date)
  if (!e) {
    e = newEvening(d, f, date)
    d.evenings.push(e)
  }
  e.removed = e.removed.filter((r) => r !== key)
  if (e.extras.some((x) => x.key === key) || e.note?.items.includes(key)) return false
  e.extras.push({ key, qty, addedBy: by })
  const clock = now(d)
  track(d, 'item_added', { flatId, who: by, date: clock.date }, {
    source,
    item_id: itemId(key),
    ...qtyParts(qty),
    list_for: date === clock.date ? 'tonight' : 'tomorrow',
    before_list_posted: clock.time < DEADLINES.list,
  })
  return true
}
