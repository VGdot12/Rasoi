// A sample flat so the prototype can be explored straight away:
// Quad 3, three flatmates who share a cook (our persona, Rohan), with two weeks of history.

import { addDays, isoDate, newEvening, SIM, weekday } from './logic'
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
  }

  const db: DB = { version: 3, users, flats: [flat], evenings: [], sessionUserId: null, clock: { date: today, time: SIM.start } }

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
      e.ordered = { by: i === 4 ? 'u_rohan' : e.ownerId, at: `22:${String(5 + i * 3).padStart(2, '0')}`, app: apps[i % apps.length], amount: 180 + i * 23 }
      e.received = { by: db.flats[0].memberIds[i % 3], at: `22:${String(20 + i * 3).padStart(2, '0')}` }
    }
    if (i === 4) e.handedOverFrom = e.ownerId
    if (i === 4) e.ownerId = 'u_rohan'
    db.evenings.push(e)
  }
  return db
}
