import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { addDays, autoNote, DEADLINES, eveningOrDraft, findEvening, fromMin, isoDate, newEvening, now, SIM, toMin } from './logic'
import { seedDB } from './seed'
import type { DB, Evening, Flat, User } from './types'

const KEY = 'rasoi-ready:app:v3'

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const db = JSON.parse(raw) as DB
      if (db.version === 3) return db
    }
  } catch {
    /* storage unavailable */
  }
  return seedDB()
}

function save(db: DB) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    // Voice notes can fill storage: keep everything else.
    try {
      const slim: DB = { ...db, evenings: db.evenings.map((e) => (e.note ? { ...e, note: { ...e.note, voiceUrl: '' } } : e)) }
      localStorage.setItem(KEY, JSON.stringify(slim))
    } catch {
      /* ignore */
    }
  }
}

interface Store {
  db: DB
  me: User | null
  flat: Flat | null
  today: string
  time: string
  tonight: Evening | null
  update: (fn: (d: DB) => void) => void
  /** Change tonight's evening for my flat, creating it on first touch. */
  updateTonight: (fn: (e: Evening, d: DB) => void) => void
  reset: () => void
  sim: {
    running: boolean
    waitingForCook: boolean
    toggle: () => void
    resetEvening: () => void
    nextEvening: () => void
    viewAs: (userId: string) => void
  }
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(load)
  useEffect(() => save(db), [db])

  const update = useCallback((fn: (d: DB) => void) => {
    setDb((prev) => {
      const d = structuredClone(prev)
      fn(d)
      return d
    })
  }, [])

  // ---- prototype simulation: 7:30 pm to midnight, 20 s per hour ----
  const [running, setRunning] = useState(false)
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => {
      update((d) => {
        const c = d.clock ?? { date: isoDate(new Date()), time: SIM.start }
        let next = fromMin(Math.min(toMin(SIM.end), toMin(c.time) + SIM.minutesPerSecond))
        const viewer = d.users.find((u) => u.id === d.sessionUserId)
        if (next >= DEADLINES.note) {
          for (const f of d.flats) {
            let e = findEvening(d, f.id, c.date)
            if (e?.note || e?.skipped || e?.fallbackAnswered) continue
            if (viewer?.role === 'cook' && viewer.flatId === f.id) {
              // Didi's own flow: the clock stops at 8 pm until she sends her note.
              next = DEADLINES.note
              continue
            }
            // Flatmates' flow: Didi's note arrives on its own at 8 pm.
            if (!e) {
              e = newEvening(d, f, c.date)
              d.evenings.push(e)
            }
            autoNote(d, f, e)
          }
        }
        d.clock = { date: c.date, time: next }
      })
    }, 1000)
    return () => clearInterval(t)
  }, [running, update])

  const me = db.users.find((u) => u.id === db.sessionUserId) ?? null
  const flat = me?.flatId ? db.flats.find((f) => f.id === me.flatId) ?? null : null
  const { date: today, time } = now(db)
  const tonight = flat ? eveningOrDraft(db, flat, today) : null

  useEffect(() => {
    if (running && time >= SIM.end) setRunning(false)
  }, [running, time])

  // Didi's flow: pause at 8 pm while her note is due, and carry on once she sends it.
  const [waitingForCook, setWaitingForCook] = useState(false)
  const cookNoteDue = me?.role === 'cook' && !!tonight && !tonight.note && !tonight.skipped && time >= DEADLINES.note
  useEffect(() => {
    if (running && cookNoteDue) {
      setRunning(false)
      setWaitingForCook(true)
    }
  }, [running, cookNoteDue])
  useEffect(() => {
    if (waitingForCook && tonight?.note) {
      setWaitingForCook(false)
      setRunning(true)
    }
  }, [waitingForCook, tonight?.note])
  useEffect(() => {
    if (waitingForCook && me?.role !== 'cook') setWaitingForCook(false)
  }, [waitingForCook, me?.role])

  const resetEvening = () => {
    setRunning(false)
    setWaitingForCook(false)
    update((d) => {
      const date = now(d).date
      d.evenings = d.evenings.filter((e) => !(e.date === date && d.flats.some((f) => f.id === e.flatId)))
      d.clock = { date, time: SIM.start }
    })
  }
  const sim = {
    running,
    waitingForCook,
    toggle: () => {
      if (!running && time >= SIM.end) resetEvening()
      if (!running && !db.clock) update((d) => void (d.clock = { date: today, time: SIM.start }))
      setRunning(!running)
    },
    resetEvening,
    nextEvening: () => {
      setRunning(false)
      setWaitingForCook(false)
      update((d) => void (d.clock = { date: addDays(now(d).date, 1), time: SIM.start }))
    },
    viewAs: (userId: string) => update((d) => void (d.sessionUserId = userId)),
  }

  const updateTonight = useCallback(
    (fn: (e: Evening, d: DB) => void) =>
      update((d) => {
        const u = d.users.find((x) => x.id === d.sessionUserId)
        const f = d.flats.find((x) => x.id === u?.flatId)
        if (!f) return
        const date = now(d).date
        let e = findEvening(d, f.id, date)
        if (!e) {
          e = newEvening(d, f, date)
          d.evenings.push(e)
        }
        fn(e, d)
      }),
    [update],
  )

  return (
    <Ctx.Provider value={{ db, me, flat, today, time, tonight, update, updateTonight, reset: () => { setRunning(false); setDb(seedDB()) }, sim }}>
      {children}
    </Ctx.Provider>
  )
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside provider')
  return s
}
