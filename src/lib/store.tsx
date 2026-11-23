import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { eveningOrDraft, findEvening, newEvening, now } from './logic'
import { seedDB } from './seed'
import type { DB, Evening, Flat, User } from './types'

const KEY = 'rasoi-ready:app:v2'

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const db = JSON.parse(raw) as DB
      if (db.version === 2) return db
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

  const me = db.users.find((u) => u.id === db.sessionUserId) ?? null
  const flat = me?.flatId ? db.flats.find((f) => f.id === me.flatId) ?? null : null
  const { date: today, time } = now(db)
  const tonight = flat ? eveningOrDraft(db, flat, today) : null

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
    <Ctx.Provider value={{ db, me, flat, today, time, tonight, update, updateTonight, reset: () => setDb(seedDB()) }}>
      {children}
    </Ctx.Provider>
  )
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside provider')
  return s
}
