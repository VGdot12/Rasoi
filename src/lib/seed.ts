// A sample flat so the prototype can be explored straight away:
// Quad 3, three flatmates who share a cook (our persona, Rohan). It has no made-up history:
// the flat was set up the day before, and every evening in it is one somebody played.

import { track } from './analytics'
import { addDays, isoDate, SIM, weekday } from './logic'
import type { DB, Flat, User } from './types'

export const DEMO_CODE = 'QUAD03'
export const DEMO_PHONES = { rohan: '9876500001', aditya: '9876500002', karan: '9876500003', cook: '9876500009' }

export function seedDB(): DB {
  const today = isoDate(new Date())
  const users: User[] = [
    { id: 'u_rohan', name: 'Rohan', phone: DEMO_PHONES.rohan, role: 'flatmate', lang: 'en', flatId: 'flat_quad3' },
    { id: 'u_aditya', name: 'Aditya', phone: DEMO_PHONES.aditya, role: 'flatmate', lang: 'en', flatId: 'flat_quad3' },
    { id: 'u_karan', name: 'Karan', phone: DEMO_PHONES.karan, role: 'flatmate', lang: 'en', flatId: 'flat_quad3' },
    { id: 'u_sunita', name: 'Sunita didi', phone: DEMO_PHONES.cook, role: 'cook', lang: 'hi', flatId: 'flat_quad3' },
  ]
  const flat: Flat = {
    id: 'flat_quad3',
    name: 'Quad 3',
    area: 'ISB campus, Gachibowli',
    code: DEMO_CODE,
    createdAt: addDays(today, -1),
    memberIds: ['u_rohan', 'u_aditya', 'u_karan'],
    rotation: ['u_aditya', 'u_karan', 'u_rohan'],
    cookId: 'u_sunita',
    cookName: 'Sunita didi',
    cookPhone: DEMO_PHONES.cook,
    cookLang: 'hi',
    cookVisits: 1,
    usualDishes: ['Rajma chawal', 'Aloo gobi', 'Dal tadka', 'Chole', 'Paneer bhurji', 'Bhindi masala', 'Kadhi chawal', 'Aloo paratha', 'Matar paneer', 'Egg curry', 'Jeera aloo', 'Palak dal'],
    staplesWeekday: weekday(today),
    pantry: [
      { key: 'atta', qty: '5 kg', since: addDays(today, -9) },
      { key: 'rice', qty: '5 kg', since: addDays(today, -9) },
      { key: 'dal', qty: '1 kg', since: addDays(today, -6) },
      { key: 'oil', qty: '1 L', since: addDays(today, -6) },
      { key: 'onion', qty: '1 kg', since: addDays(today, -3) },
      { key: 'potato', qty: '1 kg', since: addDays(today, -3) },
      { key: 'tomato', qty: '500 g', since: addDays(today, -2) },
      { key: 'garlic', qty: '100 g', since: addDays(today, -5) },
      { key: 'chilli', qty: '100 g', since: addDays(today, -2) },
      { key: 'milk', qty: '1 L', since: addDays(today, -1) },
      { key: 'egg', qty: '6 Nos', since: addDays(today, -1) },
    ],
  }

  const db: DB = { version: 7, users, flats: [flat], evenings: [], sessionUserId: null, clock: { date: today, time: SIM.start }, events: [] }

  backfillEvents(db, flat)
  return db
}

/** How the sample flat was set up, as events (the day before the first evening), so setup metrics have a start. */
function backfillEvents(db: DB, flat: Flat) {
  const start = flat.createdAt
  const f = flat.id
  for (const id of ['u_rohan', 'u_aditya', 'u_karan', 'u_sunita'])
    track(db, 'user_signed_up', { flatId: f, who: id, date: start, at: '18:00' }, { role: id === 'u_sunita' ? 'cook' : 'flatmate', ...(id === 'u_sunita' ? { cook_language: 'hi' } : {}) })
  track(db, 'flat_created', { flatId: f, who: 'u_rohan', date: start, at: '18:05' }, { area: flat.area, cook_visits_per_day: flat.cookVisits, cook_language: flat.cookLang, staples_day: flat.staplesWeekday, usual_dish_count: flat.usualDishes.length })
  track(db, 'usual_dishes_shared', { flatId: f, who: 'u_rohan', date: start, at: '18:05' }, { dish_count: flat.usualDishes.length, source: 'setup', custom_dish_count: 0 })
  track(db, 'invite_sent', { flatId: f, who: 'u_rohan', date: start, at: '18:06' }, { invitee: 'flatmate', channel: 'whatsapp' })
  track(db, 'invite_sent', { flatId: f, who: 'u_rohan', date: start, at: '18:06' }, { invitee: 'cook', channel: 'whatsapp' })
  flat.rotation.forEach((id, i) => {
    if (id !== 'u_rohan') track(db, 'flat_joined', { flatId: f, who: id, date: start, at: '18:20' }, { joined_via: 'code', flatmate_count_after: i + 2 })
    track(db, 'rotation_changed', { flatId: f, who: id, date: start, at: '18:20' }, { in_rotation: true, turn_position: i + 1, at_setup: true })
  })
  track(db, 'cook_joined', { flatId: f, who: 'u_sunita', date: start, at: '18:40' }, { connected_via: 'saved_number', cook_language: 'hi' })
}

/** The three journeys you can take in the prototype. Picked once, at the start. */
export const PERSONAS = [
  { userId: 'u_aditya', phone: DEMO_PHONES.aditya, name: 'Aditya', role: 'Orders tonight', blurb: 'It’s your turn. Get the list, place the order, see it arrive.', emoji: '🛒' },
  { userId: 'u_rohan', phone: DEMO_PHONES.rohan, name: 'Rohan', role: 'Flatmate', blurb: 'Not your turn. Add what you need and relax while Aditya orders.', emoji: '🛋️' },
  { userId: 'u_sunita', phone: DEMO_PHONES.cook, name: 'Sunita didi', role: 'Cook', blurb: 'Tell the flat tomorrow’s dish and what’s running out.', emoji: '👩‍🍳' },
] as const
