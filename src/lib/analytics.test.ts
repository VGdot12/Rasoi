import { describe, expect, it } from 'vitest'
import { personId, sha256 } from './analytics'
import { answerHandover, confirmOrder, findEvening, fireNoteEvents, markReceived, requestHandover, simTick } from './logic'
import { buildReport } from './metrics'
import { seedDB } from './seed'
import type { DB } from './types'

const tonightEvents = (db: DB) => db.events.filter((e) => e.evening_date === db.clock!.date)
const names = (db: DB) => tonightEvents(db).map((e) => e.event_name + (e.props.ask_type ? ':' + e.props.ask_type : ''))
const run = (db: DB, until: string) => { for (let i = 0; i < 200 && db.clock!.time < until; i++) simTick(db) }
/** Keep the first occurrence of each name, in order. */
const order = (xs: string[]) => xs.filter((x, i) => xs.indexOf(x) === i)

describe('event rules', () => {
  it('hashes people with SHA-256 and never stores names or numbers', () => {
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    const db = seedDB()
    const json = JSON.stringify(db.events)
    expect(json).not.toContain('9876500001')
    expect(json).not.toContain('Rohan')
    expect(personId(db, 'u_rohan', db.flats[0].id)).toHaveLength(24)
  })
  it('gives every event the common properties and flags test data', () => {
    const db = seedDB()
    for (const e of db.events) {
      expect(e.event_id).toBeTruthy()
      expect(e.flat_id).toBe(db.flats[0].id)
      expect(e.occurred_at).toMatch(/Z$/)
      expect(e.is_simulated).toBe(true)
    }
  })
})

describe('a full evening sends the expected events in order', () => {
  it('owner (Aditya): note, list, reminder, his order, his delivery', () => {
    const db = seedDB(); db.sessionUserId = 'u_aditya'
    run(db, '22:10')
    const e = findEvening(db, db.flats[0].id, db.clock!.date)!
    confirmOrder(db, e, 'u_aditya', '22:10', 'Zepto', 420)
    run(db, '22:30')
    markReceived(db, e, 'u_aditya', '22:30')
    expect(order(names(db))).toEqual(['ask_sent:cook_prompt', 'cook_note_received', 'cook_visit_checked', 'item_added', 'list_posted', 'ask_sent:owner_reminder', 'order_confirmed', 'order_received'])
    const conf = tonightEvents(db).find((x) => x.event_name === 'order_confirmed')!
    expect(conf.is_owner_tonight).toBe(true)
    expect(conf.props).toMatchObject({ app_used: 'zepto', bill_amount_inr: 420, minutes_after_list: 10 })
  })
  it('flatmate (Rohan): everyone else acts; Aditya orders at 11 and receives at 11:45', () => {
    const db = seedDB(); db.sessionUserId = 'u_rohan'
    run(db, '24:00')
    expect(order(names(db))).toEqual(['ask_sent:cook_prompt', 'cook_note_received', 'cook_visit_checked', 'item_added', 'list_posted', 'ask_sent:owner_reminder', 'order_confirmed', 'order_received'])
    const rec = tonightEvents(db).find((x) => x.event_name === 'order_received')!
    expect(rec.props).toMatchObject({ received_by_owner: true, minutes_after_order: 45 })
  })
  it('cook (Sunita didi): the clock waits for her note, then the flat orders and receives', () => {
    const db = seedDB(); db.sessionUserId = 'u_sunita'
    run(db, '20:00')
    expect(db.clock!.time).toBe('20:00')
    const f = db.flats[0]
    const e = findEvening(db, f.id, db.clock!.date)!
    e.note = { at: '20:00', todayAllGood: false, todayMissing: ['milk'], dish: 'Chole', items: ['onion', 'curd'], voiceUrl: '', voiceSecs: 4, staplesChecked: false, dayOffTomorrow: false, plannedDishCooked: true, topUp: true, notFresh: ['tomato'], prompted: true }
    fireNoteEvents(db, f, e, 'u_sunita')
    run(db, '24:00')
    expect(order(names(db))).toEqual(['ask_sent:cook_prompt', 'cook_note_received', 'cook_visit_checked', 'top_up_reported', 'freshness_reported', 'item_added', 'dish_decided', 'list_posted', 'ask_sent:owner_reminder', 'order_confirmed', 'order_received'])
    const visit = tonightEvents(db).find((x) => x.event_name === 'cook_visit_checked')!
    expect(visit.props).toMatchObject({ nothing_missing: false, missing_item_ids: ['milk'], planned_dish_cooked: true })
  })
})

describe('guardrails and hand-over', () => {
  it('asks nobody more than once in an evening', () => {
    const db = seedDB(); db.sessionUserId = 'u_rohan'
    run(db, '24:00')
    const r = buildReport(db, db.flats[0].id, db.clock!.date, true)
    expect(r.guardrails.asksMax).toBe(1)
  })
  it('switches the owner only when the other flatmate accepts', () => {
    const db = seedDB(); db.sessionUserId = 'u_aditya'
    run(db, '22:00')
    const e = findEvening(db, db.flats[0].id, db.clock!.date)!
    requestHandover(db, e, 'u_aditya', 'u_karan', '22:00')
    expect(e.ownerId).toBe('u_aditya')
    answerHandover(db, e, true, '22:10')
    expect(e.ownerId).toBe('u_karan')
    const ev = tonightEvents(db).find((x) => x.event_name === 'turn_handed_over')!
    expect(ev.props).toMatchObject({ accepted: true, minutes_after_list: 10 })
  })
})

describe('metrics from events', () => {
  it('computes the North Star and its inputs for the sample flat', () => {
    const db = seedDB()
    const r = buildReport(db, db.flats[0].id, db.clock!.date, true)
    expect(r.rows.length).toBe(13)
    expect(r.g2.rotation).toMatchObject({ num: 3, den: 3 })
    expect(r.g3.dishList.ok).toBe(true)
    expect(buildReport(db, db.flats[0].id, db.clock!.date, false).rows.length).toBe(0) // test data is left out
  })
  it('a Next day evening answers "did today have everything?" from last night', () => {
    const db = seedDB(); db.sessionUserId = 'u_rohan'
    run(db, '24:00')
    db.clock = { date: (() => { const d = new Date(db.clock!.date + 'T12:00:00'); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10) })(), time: '19:30' }
    run(db, '20:10')
    const visit = tonightEvents(db).find((x) => x.event_name === 'cook_visit_checked')!
    expect(visit.props.nothing_missing).toBe(true)
    expect(visit.props.planned_dish_cooked).toBe(null) // nobody decided last night's dish in this run
  })
})
