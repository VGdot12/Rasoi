import { useState } from 'react'
import { DemoBar } from './components/DemoBar'
import { Sheet } from './components/ui'
import { fmtTime, notificationsFor } from './lib/logic'
import { useStore } from './lib/store'
import { Auth } from './screens/Auth'
import { CookApp } from './screens/Cook'
import { FlatStart } from './screens/FlatStart'
import { Home } from './screens/Home'
import { DishesTab, FlatTab, ListTab, TurnsTab } from './screens/Tabs'

const TABS = [
  { id: 'home', label: 'Tonight', icon: '🌙' },
  { id: 'list', label: 'List', icon: '📝' },
  { id: 'turns', label: 'Turns', icon: '🔁' },
  { id: 'dishes', label: 'Dishes', icon: '🍛' },
  { id: 'flat', label: 'Flat', icon: '🏠' },
]

export default function App() {
  const { me, flat } = useStore()
  return (
    <div className="stage">
      <DemoBar />
      <div className="device">
        {!me ? <Auth /> : !flat ? <FlatStart /> : me.role === 'cook' ? <CookShell /> : <FlatmateShell key={me.id} />}
      </div>
    </div>
  )
}

function CookShell() {
  const { me, today } = useStore()
  return <div className="app-scroll"><CookApp key={today + me!.id} /></div>
}

function FlatmateShell() {
  const { db, me, flat, today } = useStore()
  const [tab, setTab] = useState('home')
  const [bell, setBell] = useState(false)
  const [seen, setSeen] = useState<string[]>([])
  const notes = notificationsFor(db, me!, flat!)
  const unread = notes.filter((n) => !seen.includes(today + n.id)).length

  return (
    <>
      <header className="appbar">
        <div className="appbar-flat">
          <span className="flat-badge">🏠</span>
          <div>
            <strong>{flat!.name}</strong>
            <div className="muted small">{flat!.memberIds.length} flatmates · {flat!.cookName}</div>
          </div>
        </div>
        <button type="button" className="bell" aria-label={`Notifications, ${unread} new`} onClick={() => { setBell(true); setSeen(notes.map((n) => today + n.id)) }}>
          🔔{unread > 0 && <span className="badge">{unread}</span>}
        </button>
      </header>
      <div className="app-scroll" key={tab}>
        {tab === 'home' && <Home goTo={setTab} />}
        {tab === 'list' && <ListTab />}
        {tab === 'turns' && <TurnsTab />}
        {tab === 'dishes' && <DishesTab />}
        {tab === 'flat' && <FlatTab />}
      </div>
      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            <span className="tab-icon">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
      <Sheet open={bell} onClose={() => setBell(false)} title="Notifications">
        {notes.length === 0 ? (
          <p className="muted">Nothing tonight yet. You'll hear when the list is ready, and only tonight's owner gets one reminder.</p>
        ) : (
          <ul className="notes">
            {notes.map((n) => (
              <li key={n.id} className={`note note-${n.tone}`}>
                <div className="note-head"><strong>{n.title}</strong><span className="muted small">{fmtTime(n.at)}</span></div>
                <p>{n.body}</p>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </>
  )
}
