import type { Lang } from './catalogue'

export type Role = 'flatmate' | 'cook'
export type OrderApp = 'Blinkit' | 'Zepto' | 'Instamart' | 'Other'

export interface User {
  id: string
  name: string
  phone: string
  role: Role
  lang: Lang
  flatId: string | null
  /** Turned off reminders (flat_muted_or_left, scope person). */
  muted?: boolean
}

export interface Flat {
  id: string
  name: string
  area: string
  code: string // invite code
  createdAt: string // ISO date
  memberIds: string[] // flatmates
  /** Flatmates who accepted a place in the ordering turn, in turn order. */
  rotation: string[]
  cookId: string | null
  cookName: string
  cookPhone: string
  cookLang: Lang
  cookVisits: 1 | 2
  usualDishes: string[]
  staplesWeekday: number // 0 = Sunday
  /** What is in the kitchen. Received orders move in here. */
  pantry: PantryItem[]
}

/** Something in the kitchen right now. */
export interface PantryItem {
  key: string
  qty: string
  since: string // ISO date it arrived
}

export interface ListLine {
  key: string // ingredient key, or a custom name
  qty: string
  addedBy: string // user id, or 'cook'
  inCart?: boolean
}

export interface CookNote {
  at: string // HH:MM
  todayAllGood: boolean | null // "did today have everything?"
  todayMissing: string[]
  dish: string // tomorrow's dish named by the cook ('' = not decided)
  items: string[] // what is running out
  voiceUrl: string // data URL of the voice note, if any
  voiceSecs: number
  staplesChecked: boolean
  dayOffTomorrow: boolean
  /** "Did you cook <yesterday's planned dish>?" null when nothing was planned. */
  plannedDishCooked?: boolean | null
  /** "We had to order extra today" (a same-day top-up: the visit is not ready). */
  topUp?: boolean
  /** Vegetables that were not fresh (freshness guardrail). */
  notFresh?: string[]
  /** Whether she picked the suggested (starred) dish. */
  dishWasSuggested?: boolean
  /** Whether a cook_prompt reached her before the note. */
  prompted?: boolean
  edited?: boolean
}

/** One evening for one flat: the note, the list, the owner, the order. Keyed by date. */
export interface Evening {
  flatId: string
  date: string // ISO date
  turnIndex: number // position in the rotation for this evening
  ownerId: string
  handedOverFrom: string | null
  note: CookNote | null
  extras: ListLine[] // added by flatmates
  qtyEdits: Record<string, string>
  removed: string[]
  dish: string // final dish for tomorrow
  dishSource: 'cook' | 'suggestion' | 'flatmate' | ''
  suggestion: string
  suggestionAnswer: 'accepted' | 'changed' | null
  fallbackAnswered: boolean
  ordered: { by: string; at: string; app: OrderApp; amount: number | null } | null
  /** Any flatmate taps "Order received" when the delivery arrives. */
  received: { by: string; at: string } | null
  nudgeSeenAt: string | null
  skipped: boolean // cook's day off: nobody orders, the turn does not move
  /** The kitchen as it was when the evening began, so a prototype restart can put it back. */
  pantryAtStart: PantryItem[]
  /** A hand-over waiting for the other flatmate to accept. */
  handoverPending?: { from: string; to: string; at: string } | null
}

/** One analytics event, with the common properties from the tracking spec (section 3). */
export interface AnalyticsEvent {
  event_id: string
  event_name: string
  occurred_at: string // UTC ISO 8601
  evening_date: string // IST date of the evening it belongs to
  flat_id: string
  person_id: string // SHA-256 of phone + salt (short form); '' for server events
  role: Role | ''
  is_owner_tonight: boolean
  ui_language: Lang
  app_version: string
  platform: 'web-android' | 'web-ios' | 'web-desktop'
  is_simulated: boolean
  props: Record<string, string | number | boolean | null | string[]>
  /** Prototype only: keeps a once-per-evening event from firing twice. Never sent. */
  _once?: string
}

export interface DB {
  version: 6
  users: User[]
  flats: Flat[]
  evenings: Evening[]
  sessionUserId: string | null
  /** Prototype clock: lets a demo move through the evening. null = real time. */
  clock: { date: string; time: string } | null
  /** Append-only analytics event log (the events table, kept on the device in the prototype). */
  events: AnalyticsEvent[]
}
