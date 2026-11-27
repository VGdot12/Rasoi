import { describe, expect, it } from 'vitest'
import { addDays, AUTO, autoNote, findEvening, markReceived, removeFromPantry, simTick, buildList, eveningOrDraft, milestones, newEvening, notificationsFor, stageOf, upcomingTurns } from './logic'
import { AMOUNTS, parseQty, UNITS_FOR } from './qty'
import { seedDB } from './seed'

describe('turns rotate', () => {
  const db = seedDB()
  const flat = db.flats[0]
  const today = db.clock!.date
  it('gives each night exactly one owner, cycling through the flatmates', () => {
    const turns = upcomingTurns(db, flat, today, 6).map((t) => t.ownerId)
    expect(new Set(turns.slice(0, 3)).size).toBe(3)
    expect(turns.slice(0, 3)).toEqual(turns.slice(3, 6))
  })
  it('does not move the turn on a skipped night', () => {
    const skipped = newEvening(db, flat, today)
    skipped.skipped = true
    db.evenings.push(skipped)
    const next = newEvening(db, flat, addDays(today, 1))
    expect(next.turnIndex).toBe(skipped.turnIndex)
    expect(next.ownerId).toBe(skipped.ownerId)
  })
})

describe('one list', () => {
  it('merges the cook’s items and flatmates’ additions without duplicates', () => {
    const db = seedDB()
    const e = newEvening(db, db.flats[0], '2030-01-01')
    e.note = { at: '19:00', todayAllGood: true, todayMissing: [], dish: '', items: ['onion', 'curd'], voiceUrl: '', voiceSecs: 0, staplesChecked: false, dayOffTomorrow: false }
    e.extras.push({ key: 'curd', qty: '', addedBy: 'u_rohan' }, { key: 'milk', qty: '', addedBy: 'u_rohan' })
    const lines = buildList(e)
    expect(lines.map((l) => l.key)).toEqual(['onion', 'curd', 'milk'])
    expect(lines[0].qty).toBe('1 kg')
    expect(lines.find((l) => l.key === 'milk')!.qty).toBe('1 L')
  })
})

describe('reminder from 10 pm, owner only, until the order is placed', () => {
  it('nudges tonight’s owner once after 10 pm, nobody else', () => {
    const db = seedDB()
    const flat = db.flats[0]
    const e = eveningOrDraft(db, flat, db.clock!.date)
    e.note = { at: '19:00', todayAllGood: true, todayMissing: [], dish: 'Chole', items: ['onion'], voiceUrl: '', voiceSecs: 0, staplesChecked: false, dayOffTomorrow: false }
    db.evenings.push(e)
    db.clock = { date: db.clock!.date, time: '22:15' }
    expect(stageOf(e, '21:00')).toBe('collecting')
    expect(stageOf(e, '22:15')).toBe('list')
    for (const id of flat.memberIds) {
      const u = db.users.find((x) => x.id === id)!
      const nudges = notificationsFor(db, u, flat).filter((n) => n.id === 'remind')
      expect(nudges.length).toBe(id === e.ownerId ? 1 : 0)
    }
  })
})

describe('quantities', () => {
  it('offers the right units and amounts per item type', () => {
    expect(UNITS_FOR.solid).toEqual(['g', 'kg'])
    expect(UNITS_FOR.liquid).toEqual(['ml', 'L'])
    expect(AMOUNTS.g).toEqual([50, 100, 250, 500])
    expect(AMOUNTS.kg).toEqual([1, 2, 3, 4, 5])
    expect(parseQty('6 Nos', 'count')).toEqual({ amount: 6, unit: 'Nos' })
    expect(parseQty('2 L', 'liquid')).toEqual({ amount: 2, unit: 'L' })
    expect(parseQty('nonsense', 'solid')).toEqual({ amount: 250, unit: 'g' })
  })
})

describe('milestones', () => {
  it('ticks note at 8, list at 10, then placed and received', () => {
    const db = seedDB()
    const flat = db.flats[0]
    const e = newEvening(db, flat, db.clock!.date)
    db.clock = { date: e.date, time: '20:00' }
    autoNote(db, flat, e)
    expect(milestones(e, '20:00').map((m) => m.done)).toEqual([true, false, false, false])
    expect(milestones(e, '22:00').map((m) => m.done)).toEqual([true, true, false, false])
    e.ordered = { by: e.ownerId, at: '22:20', app: 'Blinkit', amount: null }
    e.received = { by: flat.memberIds[0], at: '23:10' }
    expect(milestones(e, '23:10').every((m) => m.done)).toBe(true)
  })
})

describe('the three journeys', () => {
  const run = (userId: string, until = '24:00') => {
    const db = seedDB()
    db.sessionUserId = userId
    for (let i = 0; i < 200 && db.clock!.time < until; i++) simTick(db)
    return { db, e: findEvening(db, db.flats[0].id, db.clock!.date)! }
  }
  it('makes Aditya tonight\u2019s owner', () => {
    expect(run('u_rohan', '19:33').e.ownerId).toBe('u_aditya')
  })
  it('Rohan: note at 8, Aditya orders at 11, receives at 11:45 if Rohan does not', () => {
    const { e } = run('u_rohan')
    expect(e.note!.at).toBe('20:00')
    expect(e.ordered).toMatchObject({ by: 'u_aditya', at: AUTO.orderAt })
    expect(e.received).toMatchObject({ by: 'u_aditya', at: '23:45' })
  })
  it('Aditya: nothing is ordered for him', () => {
    const { e } = run('u_aditya')
    expect(e.note).not.toBeNull()
    expect(e.ordered).toBeNull()
  })
  it('Didi: the clock waits at 8 pm for her note', () => {
    const { db, e } = run('u_sunita')
    expect(db.clock!.time).toBe('20:00')
    expect(e.note).toBeNull()
  })
})

describe('kitchen stock', () => {
  it('moves received items into the kitchen and removes what ran out', () => {
    const db = seedDB()
    const flat = db.flats[0]
    const e = newEvening(db, flat, db.clock!.date)
    e.extras.push({ key: 'paneer', qty: '250 g', addedBy: 'u_rohan' }, { key: 'milk', qty: '2 L', addedBy: 'u_rohan' })
    db.evenings.push(e)
    expect(flat.pantry.some((p) => p.key === 'paneer')).toBe(false)
    markReceived(db, e, 'u_rohan', '23:30')
    expect(flat.pantry.find((p) => p.key === 'paneer')!.qty).toBe('250 g')
    expect(flat.pantry.find((p) => p.key === 'milk')!.qty).toBe('2 L')
    expect(flat.pantry.filter((p) => p.key === 'milk')).toHaveLength(1)
    removeFromPantry(db, flat.id, ['milk'])
    expect(flat.pantry.some((p) => p.key === 'milk')).toBe(false)
  })
  it('in Rohan\u2019s journey the evening ends with tonight\u2019s items in the kitchen', () => {
    const db = seedDB()
    db.sessionUserId = 'u_rohan'
    for (let i = 0; i < 200 && db.clock!.time < '24:00'; i++) simTick(db)
    const e = findEvening(db, db.flats[0].id, db.clock!.date)!
    for (const l of buildList(e)) expect(db.flats[0].pantry.some((p) => p.key === l.key && p.since === e.date)).toBe(true)
    expect(e.dish).toBe('') // Didi left the dish open, so the flat decides
  })
})
