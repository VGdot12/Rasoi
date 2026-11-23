import { describe, expect, it } from 'vitest'
import { addDays, autoNote, buildList, eveningOrDraft, milestones, newEvening, notificationsFor, stageOf, upcomingTurns } from './logic'
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
    const skipped = db.evenings.find((e) => e.skipped)!
    const next = db.evenings.find((e) => e.date === addDays(skipped.date, 1))!
    expect(next.turnIndex).toBe(skipped.turnIndex)
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
