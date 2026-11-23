import { byKey } from './catalogue'
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
  const ap = h >= 12 ? 'pm' : 'am'
  return `${((h + 11) % 12) + 1}:${pad(m)} ${ap}`
}

export const fmtDay = (date: string, today: string) => {
  if (date === today) return 'Today'
  if (date === addDays(today, -1)) return 'Yesterday'
  if (date === addDays(today, 1)) return 'Tomorrow'
  return new Date(date + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}

export const DEADLINES = { prompt: '17:30', note: '20:00', list: '21:00', nudge: '22:00' }

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
    nudgeSeenAt: null,
    skipped: false,
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
    lines.push({ key, addedBy, qty: e.qtyEdits[key] ?? qty ?? byKey(key)?.qty ?? '' })
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

export type Stage = 'skipped' | 'before-note' | 'no-note' | 'list' | 'nudged' | 'ordered'

export function stageOf(e: Evening, time: string): Stage {
  if (e.skipped) return 'skipped'
  if (e.ordered) return 'ordered'
  if (!e.note && time < DEADLINES.note) return 'before-note'
  if (!e.note && !e.fallbackAnswered) return 'no-note'
  if (time >= DEADLINES.nudge) return 'nudged'
  return 'list'
}

export const finalDish = (e: Evening) => e.dish || (e.suggestionAnswer === 'accepted' ? e.suggestion : '')

// ---------- notifications (derived, so there is never a second nudge) ----------

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
  if (e.skipped) return [{ id: 'skip', at: '17:00', title: 'No cook tomorrow', body: 'Nobody orders tonight. Turns do not move.', tone: 'info' }]
  if (user.role === 'cook') {
    if (time >= DEADLINES.prompt && !e.note)
      out.push({ id: 'prompt', at: DEADLINES.prompt, title: `${flat.name}`, body: 'Didi, kal kya banana hai aur kya khatam ho raha hai? Ek voice note bhej dijiye.', tone: 'action' })
    if (e.ordered) out.push({ id: 'ord', at: e.ordered.at, title: 'Ordered', body: `${nameOf(db, e.ordered.by)} ordered tomorrow's list.`, tone: 'done' })
    return out
  }
  if (e.note) out.push({ id: 'note', at: e.note.at, title: `${flat.cookName} sent tomorrow's note`, body: e.note.todayAllGood === false ? `Today something was missing: ${e.note.todayMissing.join(', ') || 'not named'}.` : 'Today she had everything.', tone: 'info' })
  if (!e.note && time >= DEADLINES.note && user.id === e.ownerId && !e.fallbackAnswered)
    out.push({ id: 'fallback', at: DEADLINES.note, title: 'Didi’s note has not come in', body: `You are tonight's owner. If tomorrow is ${e.suggestion || 'the usual'}, what is low?`, tone: 'action' })
  if ((e.note || e.fallbackAnswered) && time >= DEADLINES.list)
    out.push({
      id: 'list',
      at: DEADLINES.list,
      title: 'Tomorrow’s list',
      body: `Tomorrow: ${finalDish(e) || 'not decided'}. Needed: ${lines.map((l) => `${l.name.toLowerCase()} ${l.qty}`).join(', ') || 'nothing'}. Owner tonight: ${owner}.`,
      tone: 'info',
    })
  if (!e.ordered && lines.length && time >= DEADLINES.nudge && user.id === e.ownerId)
    out.push({ id: 'nudge', at: DEADLINES.nudge, title: 'One reminder', body: `${user.name}, you are tonight's owner. Tap ‘ordered’ once it is placed.`, tone: 'action' })
  if (e.ordered) out.push({ id: 'ord', at: e.ordered.at, title: `${nameOf(db, e.ordered.by)} ordered on ${e.ordered.app}`, body: `${lines.length} items for tomorrow. Nothing else to do tonight.`, tone: 'done' })
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
