// Analytics, as the tracking spec describes (sections 2, 3 and 9).
// track() adds the common properties, hashes the person, flags test data and appends to the
// event log. In the prototype the log lives with the app's data on the device; with a backend
// it would be sent in batches to one append-only events table.

import type { AnalyticsEvent, DB, Role } from './types'

export const APP_VERSION = '0.8.0'
const SALT = 'rasoi-ready-pilot-salt-v1' // app-wide salt; rotated and held by the team in production

// ---------- SHA-256 (small, synchronous, so events can be built inside a state update) ----------
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])
export function sha256(text: string): string {
  const bytes = new TextEncoder().encode(text)
  const len = bytes.length
  const padded = new Uint8Array(((len + 9 + 63) >> 6) << 6)
  padded.set(bytes)
  padded[len] = 0x80
  const view = new DataView(padded.buffer)
  view.setUint32(padded.length - 4, len * 8)
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19])
  const w = new Uint32Array(64)
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n))
  for (let o = 0; o < padded.length; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(o + i * 4)
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0
    }
    let [a, b, c, d, e, f, g, hh] = h
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh
  }
  return Array.from(h).map((x) => x.toString(16).padStart(8, '0')).join('')
}

/** person_id: SHA-256 of the phone number plus the app-wide salt. Never a name or a number. */
export function personId(d: DB, who: string, flatId: string): string {
  if (!who) return ''
  const f = d.flats.find((x) => x.id === flatId)
  const u = d.users.find((x) => x.id === who)
  const phone = u?.phone || (who === 'cook' ? f?.cookPhone || `cook:${flatId}` : who)
  const key = phone.replace(/\D/g, '') || phone
  return sha256(SALT + key).slice(0, 24)
}

const platform = (): AnalyticsEvent['platform'] => {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent
  return /Android/i.test(ua) ? 'web-android' : /iPhone|iPad|iPod/i.test(ua) ? 'web-ios' : 'web-desktop'
}

const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
      })

/** IST evening date + HH:MM (24:00 allowed) to a UTC ISO timestamp. */
export function istToUtc(date: string, time: string) {
  const [y, m, dd] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  return new Date(Date.UTC(y, m - 1, dd, hh, mm) - 330 * 60000).toISOString().replace('.000Z', 'Z')
}

export interface TrackCtx {
  flatId: string
  /** user id, 'cook' for a cook without an account, or '' for a server event */
  who: string
  at?: string // HH:MM on the evening's clock; defaults to now
  date?: string // evening date; defaults to the clock's date
  /** Fire at most once with this key (per flat, per evening). */
  once?: string
}

/** Append one event with the common properties. Call inside a state update. */
export function track(d: DB, name: string, ctx: TrackCtx, props: AnalyticsEvent['props'] = {}) {
  const clock = d.clock ?? (() => {
    const n = new Date(Date.now() + 330 * 60000)
    return { date: n.toISOString().slice(0, 10), time: n.toISOString().slice(11, 16) }
  })()
  const date = ctx.date ?? clock.date
  const at = ctx.at ?? clock.time
  const once = ctx.once ? `${ctx.flatId}|${date}|${ctx.once}` : undefined
  d.events = d.events ?? []
  if (once && d.events.some((e) => e._once === once)) return
  const f = d.flats.find((x) => x.id === ctx.flatId)
  const u = d.users.find((x) => x.id === ctx.who)
  const e = d.evenings.find((x) => x.flatId === ctx.flatId && x.date === date)
  const role: Role | '' = !ctx.who ? '' : ctx.who === 'cook' || u?.role === 'cook' || (f && f.cookId === ctx.who) ? 'cook' : 'flatmate'
  d.events.push({
    event_id: uuid(),
    event_name: name,
    occurred_at: istToUtc(date, at),
    evening_date: date,
    flat_id: ctx.flatId,
    person_id: personId(d, ctx.who, ctx.flatId),
    role,
    is_owner_tonight: !!e && !!ctx.who && e.ownerId === ctx.who,
    ui_language: role === 'cook' ? u?.lang ?? f?.cookLang ?? 'hi' : u?.lang ?? 'en',
    app_version: APP_VERSION,
    platform: platform(),
    // Test data is flagged, not deleted: the Simulate clock, the sample flat Quad 3, team test accounts.
    is_simulated: !!d.clock || f?.code === 'QUAD03',
    props,
    _once: once,
  })
}

/** The person ids a flat's members map to, for showing names beside metrics on the team view only. */
export function personNames(d: DB) {
  const m = new Map<string, string>()
  for (const f of d.flats) {
    for (const id of f.memberIds) m.set(personId(d, id, f.id), d.users.find((u) => u.id === id)?.name ?? id)
    m.set(personId(d, f.cookId ?? 'cook', f.id), f.cookName || 'Cook')
  }
  return m
}

// ---------- effort tracking: task_completed / task_abandoned (spec section 7) ----------

interface Task { name: string; taps: number; chars: number; started: number; step: string }
const tasks = new Map<string, Task>()
let listening = false

/** Count taps on controls and typed characters while tasks are open. Autofill counts as 0. */
export function startEffortListener() {
  if (listening || typeof document === 'undefined') return
  listening = true
  document.addEventListener(
    'click',
    (ev) => {
      const el = (ev.target as HTMLElement | null)?.closest('button, a, input[type=checkbox], label, [role=tab]')
      if (el) tasks.forEach((t) => t.taps++)
    },
    true,
  )
  document.addEventListener('change', (ev) => {
    if ((ev.target as HTMLElement | null)?.tagName === 'SELECT') tasks.forEach((t) => t.taps++)
  }, true)
  document.addEventListener('beforeinput', (ev) => {
    const ie = ev as InputEvent
    if (ie.inputType?.startsWith('insert') && ie.data) tasks.forEach((t) => (t.chars += ie.data!.length))
  }, true)
}

/** Open a task. `firstTap` counts the tap that opened it (its click has already been counted or not). */
export function startTask(name: string, firstTap = 0) {
  tasks.set(name, { name, taps: firstTap, chars: 0, started: Date.now(), step: 'start' })
}
export const taskOpen = (name: string) => tasks.has(name)
export function taskStep(name: string, step: string) {
  const t = tasks.get(name)
  if (t) t.step = step
}

/** Close a task; returns the task_completed properties, or null if it wasn't open. */
export function finishTask(name: string) {
  const t = tasks.get(name)
  if (!t) return null
  tasks.delete(name)
  return { task: name, taps: t.taps, typed_chars: t.chars, duration_ms: Date.now() - t.started, started_at: new Date(t.started).toISOString() }
}
/** Close a task without finishing; returns the task_abandoned properties. */
export function abandonTask(name: string) {
  const t = tasks.get(name)
  if (!t) return null
  tasks.delete(name)
  return { task: name, taps_so_far: t.taps, step_reached: t.step }
}

/** The prototype test counts are the bar a release must not exceed (spec section 7). */
export const TASK_BARS: Record<string, { taps: number; chars: number; label: string }> = {
  sign_in: { taps: 3, chars: 0, label: 'Sign in' },
  add_item: { taps: 4, chars: 0, label: 'Add an item' },
  reorder_from_kitchen: { taps: 1, chars: 0, label: 'Re-order from the kitchen' },
  place_order: { taps: 3, chars: 3, label: 'Place the order' },
  confirm_delivery: { taps: 1, chars: 0, label: 'Confirm delivery' },
  cook_note: { taps: 9, chars: 0, label: "Cook's note" },
  hand_over: { taps: 3, chars: 0, label: 'Hand over' },
  flat_setup: { taps: 21, chars: 43, label: 'Set up a flat' },
}
