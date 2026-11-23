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
}

export interface DB {
  version: 4
  users: User[]
  flats: Flat[]
  evenings: Evening[]
  sessionUserId: string | null
  /** Prototype clock: lets a demo move through the evening. null = real time. */
  clock: { date: string; time: string } | null
}
