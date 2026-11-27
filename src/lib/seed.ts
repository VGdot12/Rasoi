// A sample flat so the prototype can be explored straight away:
// Quad 3, three flatmates who share a cook (our persona, Rohan), with two weeks of history.

import { personId, track } from './analytics'
import { addDays, buildList, DEADLINES, fireNoteEvents, isoDate, newEvening, postList, SIM, toMin, weekday } from './logic'
import type { DB, Evening, Flat, OrderApp, User } from './types'

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
    createdAt: addDays(today, -14),
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

  const db: DB = { version: 6, users, flats: [flat], evenings: [], sessionUserId: null, clock: { date: today, time: SIM.start }, events: [] }

  // Two weeks of evenings, built in order so turns rotate exactly as the app would rotate them.
  const itemsPool = [['onion', 'tomato', 'curd'], ['milk', 'coriander'], ['potato', 'chilli', 'ginger'], ['paneer', 'tomato'], ['bhindi', 'onion'], ['egg', 'bread', 'milk'], ['spinach', 'garlic'], ['lemon', 'curd']]
  const apps: OrderApp[] = ['Blinkit', 'Zepto', 'Blinkit', 'Instamart']
  for (let i = 13; i >= 1; i--) {
    const date = addDays(today, -i)
    const e: Evening = newEvening(db, flat, date)
    if (i === 9) {
      e.skipped = true
      db.evenings.push(e)
      continue
    }
    const missedYesterday = i === 6 || i === 11
    e.note = {
      at: `19:${String(10 + ((i * 7) % 45)).padStart(2, '0')}`,
      todayAllGood: !missedYesterday,
      todayMissing: missedYesterday ? ['curd'] : [],
      dish: i % 3 === 0 ? '' : flat.usualDishes[(i * 5) % flat.usualDishes.length],
      items: itemsPool[i % itemsPool.length],
      voiceUrl: '',
      voiceSecs: 14 + i,
      staplesChecked: weekday(date) === flat.staplesWeekday,
      dayOffTomorrow: false,
    }
    if (e.note.dish) {
      e.dish = e.note.dish
      e.dishSource = 'cook'
    } else {
      e.suggestionAnswer = 'accepted'
      e.dish = e.suggestion
      e.dishSource = 'suggestion'
    }
    // i === 7: the owner did not order (one of the missed visits followed it)
    if (i !== 7) {
      e.ordered = { by: i === 4 ? (e.ownerId === 'u_rohan' ? 'u_karan' : 'u_rohan') : e.ownerId, at: `22:${String(5 + i * 3).padStart(2, '0')}`, app: apps[i % apps.length], amount: 180 + i * 23 }
      e.received = { by: db.flats[0].memberIds[i % 3], at: `22:${String(20 + i * 3).padStart(2, '0')}` }
    }
    // One hand-over in the history: the owner couldn't order and another flatmate took the turn.
    if (i === 4) {
      e.handedOverFrom = e.ownerId
      e.ownerId = e.ordered!.by
    }
    e.note.prompted = i % 5 !== 0 // two notes came without a prompt: the "came back" signal
    e.note.plannedDishCooked = i === 12 ? false : true
    e.note.topUp = i === 6
    e.note.notFresh = i === 3 ? ['tomato'] : []
    db.evenings.push(e)
  }
  backfillEvents(db, flat)
  return db
}

/** The sample flat's two weeks as events, so the Metrics view has history (all flagged is_simulated). */
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

  for (const e of db.evenings) {
    const ctx = (who: string, at: string) => ({ flatId: f, who, at, date: e.date })
    track(db, 'ask_sent', { ...ctx('', DEADLINES.prompt), once: 'cook_prompt' }, { ask_type: 'cook_prompt', recipient: personId(db, 'u_sunita', f), channel: 'in_app' })
    if (e.skipped) {
      track(db, 'cook_day_off_marked', ctx('u_sunita', '19:40'), { for_date: e.date })
      continue
    }
    fireNoteEvents(db, flat, e, 'u_sunita')
    if (e.dishSource === 'suggestion') {
      track(db, 'dish_suggested', { ...ctx('u_rohan', '20:05'), once: 'dish_suggested' }, { dish_id: e.suggestion, reason: 'not_made_this_week' })
      track(db, 'dish_decided', ctx('u_rohan', '20:10'), { method: 'suggestion_accepted', dish_id: e.suggestion, decided_by_role: 'flatmate' })
    }
    if (e.handedOverFrom) {
      track(db, 'ask_sent', ctx('', '22:02'), { ask_type: 'handover_request', recipient: personId(db, e.ownerId, f), channel: 'in_app' })
      track(db, 'turn_handed_over', ctx(e.ownerId, '22:04'), { from_person_id: personId(db, e.handedOverFrom, f), to_person_id: personId(db, e.ownerId, f), accepted: true, minutes_after_list: 4 })
    }
    postList(db, flat, e)
    // The owner's 10 pm reminder (postList skips it here only because the seed already holds the order).
    track(db, 'ask_sent', { ...ctx('', DEADLINES.list), once: 'owner_reminder' }, { ask_type: 'owner_reminder', recipient: personId(db, e.handedOverFrom ?? e.ownerId, f), channel: 'in_app' })
    if (e.ordered) {
      track(db, 'order_confirmed', ctx(e.ordered.by, e.ordered.at), { app_used: e.ordered.app.toLowerCase(), item_count: buildList(e).length, bill_entered: true, bill_amount_inr: e.ordered.amount, minutes_after_list: toMin(e.ordered.at) - toMin(DEADLINES.list) })
      if (e.received)
        track(db, 'order_received', ctx(e.received.by, e.received.at), { received_by_owner: e.received.by === e.ownerId, minutes_after_order: toMin(e.received.at) - toMin(e.ordered.at), items_moved_to_kitchen: buildList(e).length })
    }
  }
  const d10 = addDays(isoDate(new Date()), -10)
  track(db, 'duplicate_reported', { flatId: f, who: 'u_karan', date: d10, at: '21:00' }, { item_id: 'egg', reported_by_role: 'flatmate' })
}

/** The three journeys you can take in the prototype. Picked once, at the start. */
export const PERSONAS = [
  { userId: 'u_aditya', phone: DEMO_PHONES.aditya, name: 'Aditya', role: 'Orders tonight', blurb: 'It’s your turn. Get the list, place the order, see it arrive.', emoji: '🛒' },
  { userId: 'u_rohan', phone: DEMO_PHONES.rohan, name: 'Rohan', role: 'Flatmate', blurb: 'Not your turn. Add what you need and relax while Aditya orders.', emoji: '🛋️' },
  { userId: 'u_sunita', phone: DEMO_PHONES.cook, name: 'Sunita didi', role: 'Cook', blurb: 'Tell the flat tomorrow’s dish and what’s running out.', emoji: '👩‍🍳' },
] as const
