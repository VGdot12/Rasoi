// Metric definitions from the tracking spec (section 8) and the derived flat_evening table (section 9).
// Every metric is a count or ratio over stored events, read flat by flat, with the count beside the %.

import { TASK_BARS } from './analytics'
import { addDays } from './logic'
import type { AnalyticsEvent, DB } from './types'

export interface Ratio {
  num: number
  den: number
  value: number | null
}
const ratio = (num: number, den: number): Ratio => ({ num, den, value: den ? num / den : null })
export const pct = (r: Ratio) => (r.value === null ? '—' : `${Math.round(r.value * 100)}%`)
export const frac = (r: Ratio) => `${r.num} of ${r.den}`
const median = (xs: number[]) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
}

/** Monday to Sunday, IST. */
export function weekOf(date: string) {
  const d = new Date(date + 'T12:00:00')
  const back = (d.getDay() + 6) % 7
  const mon = addDays(date, -back)
  return { start: mon, end: addDays(mon, 6) }
}

/** The events a metric may use: one flat's. */
export function eventsFor(d: DB, flatId: string) {
  return (d.events ?? []).filter((e) => e.flat_id === flatId)
}

const isName = (n: string) => (e: AnalyticsEvent) => e.event_name === n
const inRange = (a: string, b: string) => (e: AnalyticsEvent) => e.evening_date >= a && e.evening_date <= b
const minutesOf = (e: AnalyticsEvent) => {
  const t = new Date(e.occurred_at).getTime() + 330 * 60000
  const ist = new Date(t)
  const day = ist.toISOString().slice(0, 10)
  const mins = ist.getUTCHours() * 60 + ist.getUTCMinutes()
  return day > e.evening_date ? mins + 1440 : mins
}

/** Last of an event per evening (an edited note replaces the first). */
function latestPerEvening(evs: AnalyticsEvent[], name: string, key = (e: AnalyticsEvent) => e.evening_date) {
  const m = new Map<string, AnalyticsEvent>()
  for (const e of evs.filter(isName(name))) m.set(key(e), e)
  return [...m.values()]
}

/** flat_evening: one row per flat per evening (spec section 9). */
export interface FlatEvening {
  date: string
  isVisitDay: boolean
  note: AnalyticsEvent | undefined
  noteMinutesVs8: number | null
  notePrompted: boolean | null
  dishNamed: boolean
  dishMethod: string
  fallbackUsed: boolean
  list: AnalyticsEvent | undefined
  listItems: number
  ownerPid: string
  handedOver: boolean
  ordered: AnalyticsEvent | undefined
  received: AnalyticsEvent | undefined
  asksMax: number
  ready: boolean | null // about this evening's visit (cook_visit_checked with this visit_date)
  topUp: boolean
}

export function flatEvenings(evs: AnalyticsEvent[]): FlatEvening[] {
  const dates = [...new Set(evs.filter((e) => e.event_name !== 'task_completed' && e.event_name !== 'task_abandoned').map((e) => e.evening_date))].sort()
  const notes = latestPerEvening(evs, 'cook_note_received')
  const firstNotes = new Map<string, AnalyticsEvent>()
  for (const n of evs.filter(isName('cook_note_received'))) if (!firstNotes.has(n.evening_date)) firstNotes.set(n.evening_date, n)
  const visits = latestPerEvening(evs, 'cook_visit_checked', (e) => `${e.props.visit_date}|${e.props.visit_slot}`)
  return dates
    .filter((date) => evs.some((e) => e.evening_date === date && ['ask_sent', 'cook_note_received', 'list_posted', 'cook_day_off_marked'].includes(e.event_name)))
    .map((date) => {
      const on = evs.filter((e) => e.evening_date === date)
      const note = notes.find((n) => n.evening_date === date)
      const first = firstNotes.get(date)
      const dish = [...on.filter(isName('dish_decided'))].pop()
      const list = on.find(isName('list_posted'))
      const asks = new Map<string, number>()
      for (const a of on.filter(isName('ask_sent'))) {
        const k = String(a.props.recipient) + '|' + a.props.ask_type
        asks.set(k, 1) // a reminder that stays on screen counts once
      }
      const perPerson = new Map<string, number>()
      asks.forEach((_, k) => perPerson.set(k.split('|')[0], (perPerson.get(k.split('|')[0]) ?? 0) + 1))
      const myVisits = visits.filter((v) => v.props.visit_date === date)
      const topUp = evs.some((e) => e.event_name === 'top_up_reported' && e.props.visit_date === date)
      return {
        date,
        isVisitDay: !on.some(isName('cook_day_off_marked')),
        note,
        noteMinutesVs8: first ? Number(first.props.minutes_vs_8pm) : null,
        notePrompted: first ? !!first.props.prompted : null,
        dishNamed: !!note?.props.dish_named,
        dishMethod: dish ? String(dish.props.method) : '',
        fallbackUsed: on.some(isName('owner_fallback_completed')),
        list,
        listItems: list ? Number(list.props.item_count) : 0,
        ownerPid: list ? String(list.props.owner_person_id) : '',
        handedOver: on.some((e) => e.event_name === 'turn_handed_over' && e.props.accepted === true),
        ordered: on.find(isName('order_confirmed')),
        received: on.find(isName('order_received')),
        asksMax: Math.max(0, ...perPerson.values()),
        ready: myVisits.length ? myVisits.every((v) => v.props.nothing_missing === true) && !topUp : null,
        topUp,
      }
    })
}

export interface Report {
  /** The days the numbers cover: every day played so far, or one day. */
  range: { start: string; end: string }
  /** Days played (one row per evening), oldest first, numbered from Day 1. */
  days: (FlatEvening & { n: number })[]
  baselineWeek: { start: string; end: string } | null
  rows: FlatEvening[]
  northStar: { ready: number; visitDays: number; share: Ratio; noNoteDays: number; prevDayReady: number | null }
  inputs: { active: boolean; noteCoverage: Ratio; orderThrough: Ratio; cameBack: Ratio }
  g1: { firstNoteWithin3: { ok: boolean | null; days: number | null }; missing: Ratio; missingBaseline: Ratio | null }
  g2: { rotation: Ratio; afterReminder: Ratio; concentration: Ratio & { applies: boolean }; duplicates: number; feeSplit: Ratio }
  g3: { dishList: { count: number; ok: boolean }; dishNamed: Ratio; suggestionAccepted: Ratio; plannedCooked: Ratio; dishReasonToPay: number }
  guardrails: { asksMax: number; asksOver: { date: string; n: number }[]; optOuts: number; dupSpoiled: number; freshness: number }
  money: { prepay: Ratio; noteToList: number | null; noteToOrder: number | null }
  effort: { task: string; label: string; n: number; taps: number | null; chars: number | null; bar: { taps: number; chars: number }; abandoned: number }[]
}

/**
 * The report for one flat. `day` is 'all' (every day played up to today, the default) or one evening's date.
 * It is rebuilt from the events on every render, so it is live: a finished day adds a row straight away.
 */
export function buildReport(d: DB, flatId: string, today: string, day: 'all' | string = 'all'): Report {
  const flat = d.flats.find((f) => f.id === flatId)!
  const evs = eventsFor(d, flatId)
  const rows = flatEvenings(evs).filter((r) => r.date <= today)
  const days = rows.map((r, i) => ({ ...r, n: i + 1 }))
  const week = day === 'all' ? { start: rows[0]?.date ?? today, end: today } : { start: day, end: day }
  const inWeek = inRange(week.start, week.end)
  const weekRows = rows.filter((r) => r.date >= week.start && r.date <= week.end)
  const visitRows = weekRows.filter((r) => r.isVisitDay)

  // North Star: ready cook visits this week (visit_date in the week), and ready share.
  const visitChecks = latestPerEvening(evs, 'cook_visit_checked', (e) => `${e.props.visit_date}|${e.props.visit_slot}`)
  const tops = new Set(evs.filter(isName('top_up_reported')).map((e) => String(e.props.visit_date)))
  const readyIn = (a: string, b: string) =>
    visitChecks.filter((v) => String(v.props.visit_date) >= a && String(v.props.visit_date) <= b && v.props.nothing_missing === true && !tops.has(String(v.props.visit_date))).length
  const ready = readyIn(week.start, week.end)
  const prevDay = day === 'all' ? null : rows.filter((r) => r.date < day).pop()?.date ?? null
  const noNoteDays = visitRows.filter((r) => !r.note).length

  // Inputs
  const notesOnTime = visitRows.filter((r) => r.noteMinutesVs8 !== null && r.noteMinutesVs8 <= 0).length
  const listed = weekRows.filter((r) => r.listItems > 0)
  const cameBack = visitRows.filter((r) => r.notePrompted === false).length

  // G1
  const created = evs.find(isName('flat_created'))
  const firstNote = evs.find(isName('cook_note_received'))
  const firstDays = created && firstNote ? Math.round((new Date(firstNote.evening_date).getTime() - new Date(created.evening_date).getTime()) / 86400000) : null
  const checksIn = (a: string, b: string) => visitChecks.filter((v) => String(v.props.visit_date) >= a && String(v.props.visit_date) <= b)
  const missing = (a: string, b: string) => {
    const c = checksIn(a, b)
    return ratio(c.filter((v) => v.props.nothing_missing === false).length, c.length)
  }
  // "Week 1" is the first seven days played; later days are compared with it.
  const firstDate = rows[0]?.date
  const baselineWeek = firstDate ? { start: firstDate, end: addDays(firstDate, 6) } : null

  // G2
  const lastRotation = new Map<string, boolean>()
  for (const r of evs.filter(isName('rotation_changed'))) lastRotation.set(r.person_id, !!r.props.in_rotation)
  const inRot = [...lastRotation.values()].filter(Boolean).length
  const reminders = evs.filter((e) => e.event_name === 'ask_sent' && e.props.ask_type === 'owner_reminder' && inWeek(e))
  const orderedAfter = reminders.filter((r) => evs.some((o) => o.event_name === 'order_confirmed' && o.evening_date === r.evening_date && o.person_id === r.props.recipient)).length
  const since14 = addDays(today, -13)
  const orders14 = evs.filter((e) => e.event_name === 'order_confirmed' && e.evening_date >= since14 && e.evening_date <= today)
  const byPerson = new Map<string, number>()
  for (const o of orders14) byPerson.set(o.person_id, (byPerson.get(o.person_id) ?? 0) + 1)
  const top = Math.max(0, ...byPerson.values())
  const dups14 = evs.filter((e) => e.event_name === 'duplicate_reported' && e.evening_date >= since14 && e.evening_date <= today).length
  const fresh14 = evs.filter((e) => e.event_name === 'freshness_reported' && e.evening_date >= since14 && e.evening_date <= today).length
  const pre = latestPerEvening(evs, 'prepayment_answered', () => 'flat')
  const paid = pre.filter((p) => p.props.answer === 'paid')

  // G3
  const dishShared = [...evs.filter(isName('usual_dishes_shared'))].pop()
  const dishNamed = visitRows.filter((r) => r.dishNamed && r.noteMinutesVs8 !== null && r.noteMinutesVs8 <= 0).length
  const suggested = evs.filter((e) => e.event_name === 'dish_suggested' && inWeek(e)).length
  const accepted = evs.filter((e) => e.event_name === 'dish_decided' && e.props.method === 'suggestion_accepted' && inWeek(e)).length
  const withPlan = checksIn(week.start, week.end).filter((v) => v.props.planned_dish_cooked !== null && v.props.planned_dish_cooked !== undefined)

  // Guardrails
  const asksOver = rows.filter((r) => r.asksMax >= 2).map((r) => ({ date: r.date, n: r.asksMax }))

  // Money and effort
  const noteToList = median(evs.filter((e) => e.event_name === 'list_posted' && inWeek(e) && e.props.minutes_after_note !== null).map((e) => Number(e.props.minutes_after_note)))
  const noteToOrder = median(
    weekRows.filter((r) => r.note && r.ordered).map((r) => minutesOf(r.ordered!) - minutesOf(r.note!)),
  )
  const effort = Object.entries(TASK_BARS).map(([task, bar]) => {
    const done = evs.filter((e) => e.event_name === 'task_completed' && e.props.task === task)
    return {
      task,
      label: bar.label,
      n: done.length,
      taps: median(done.map((e) => Number(e.props.taps))),
      chars: median(done.map((e) => Number(e.props.typed_chars))),
      bar,
      abandoned: evs.filter((e) => e.event_name === 'task_abandoned' && e.props.task === task).length,
    }
  })

  return {
    range: week,
    days,
    baselineWeek,
    rows,
    northStar: { ready, visitDays: visitRows.length, share: ratio(visitRows.filter((r) => r.ready === true).length, visitRows.length), noNoteDays, prevDayReady: prevDay ? readyIn(prevDay, prevDay) : null },
    inputs: { active: visitRows.some((r) => !!r.note), noteCoverage: ratio(notesOnTime, visitRows.length), orderThrough: ratio(listed.filter((r) => !!r.ordered).length, listed.length), cameBack: ratio(cameBack, visitRows.length) },
    g1: {
      firstNoteWithin3: { ok: firstDays === null ? null : firstDays <= 3, days: firstDays },
      missing: missing(week.start, week.end),
      missingBaseline: baselineWeek && week.end > baselineWeek.end ? missing(baselineWeek.start, baselineWeek.end) : null,
    },
    g2: {
      rotation: ratio(inRot, flat.memberIds.length),
      afterReminder: ratio(orderedAfter, reminders.length),
      concentration: { ...ratio(top, orders14.length), applies: flat.memberIds.length >= 3 },
      duplicates: dups14,
      feeSplit: ratio(paid.filter((p) => Number(p.props.split_across) === flat.memberIds.length).length, paid.length),
    },
    g3: {
      dishList: { count: dishShared ? Number(dishShared.props.dish_count) : 0, ok: !!dishShared && Number(dishShared.props.dish_count) >= 10 },
      dishNamed: ratio(dishNamed, visitRows.length),
      suggestionAccepted: ratio(accepted, suggested),
      plannedCooked: ratio(withPlan.filter((v) => v.props.planned_dish_cooked === true).length, withPlan.length),
      dishReasonToPay: paid.filter((p) => p.props.cites_dish_suggestion === true).length,
    },
    guardrails: {
      asksMax: Math.max(0, ...rows.map((r) => r.asksMax)),
      asksOver,
      optOuts: evs.filter(isName('flat_muted_or_left')).length,
      dupSpoiled: dups14 + fresh14,
      freshness: evs.filter((e) => e.event_name === 'freshness_reported' && inWeek(e)).length,
    },
    money: { prepay: ratio(paid.filter((p) => Number(p.props.price_asked_inr) === 149).length, pre.length), noteToList, noteToOrder },
    effort,
  }
}

