import { describe, expect, it } from 'vitest'
import { addDays, buildList, eveningOrDraft, newEvening, notificationsFor, stageOf, upcomingTurns } from './logic'
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
  })
})

describe('one reminder, owner only', () => {
  it('nudges tonight’s owner once after 10 pm, nobody else', () => {
    const db = seedDB()
    const flat = db.flats[0]
    const e = eveningOrDraft(db, flat, db.clock!.date)
    e.note = { at: '19:00', todayAllGood: true, todayMissing: [], dish: 'Chole', items: ['onion'], voiceUrl: '', voiceSecs: 0, staplesChecked: false, dayOffTomorrow: false }
    db.evenings.push(e)
    db.clock = { date: db.clock!.date, time: '22:15' }
    expect(stageOf(e, '22:15')).toBe('nudged')
    for (const id of flat.memberIds) {
      const u = db.users.find((x) => x.id === id)!
      const nudges = notificationsFor(db, u, flat).filter((n) => n.id === 'nudge')
      expect(nudges.length).toBe(id === e.ownerId ? 1 : 0)
    }
  })
})
