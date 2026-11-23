import { useState } from 'react'
import { waShare } from '../components/ui'
import { DISH_IDEAS, type Lang } from '../lib/catalogue'
import { inviteCode, isoDate, uid } from '../lib/logic'
import { DEMO_CODE } from '../lib/seed'
import { useStore } from '../lib/store'
import type { Flat } from '../lib/types'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function FlatStart() {
  const { me, update } = useStore()
  const [mode, setMode] = useState<'pick' | 'create' | 'join'>(me?.role === 'cook' ? 'join' : 'pick')
  if (!me) return null

  if (mode === 'create') return <CreateFlat onBack={() => setMode('pick')} />
  if (mode === 'join') return <JoinFlat onBack={me.role === 'cook' ? undefined : () => setMode('pick')} />

  return (
    <div className="auth">
      <h2>Hi {me.name}! Set up your flat</h2>
      <p className="muted">Rasoi Ready works for the whole flat and your cook together.</p>
      <div className="role-pick">
        <button type="button" className="role" onClick={() => setMode('create')}>
          <span className="role-emoji">✨</span>
          <strong>Create a flat</strong>
          <span className="muted small">Add your cook, usual dishes and invite flatmates</span>
        </button>
        <button type="button" className="role" onClick={() => setMode('join')}>
          <span className="role-emoji">🔑</span>
          <strong>Join a flat</strong>
          <span className="muted small">A flatmate shared a code with you</span>
        </button>
      </div>
      <button type="button" className="link" onClick={() => update((d) => void (d.sessionUserId = null))}>Log out</button>
    </div>
  )
}

function JoinFlat({ onBack }: { onBack?: () => void }) {
  const { db, me, update } = useStore()
  const [code, setCode] = useState('')
  const [takeTurn, setTakeTurn] = useState(true)
  const flat = db.flats.find((f) => f.code === code.trim().toUpperCase())
  const isCook = me?.role === 'cook'
  const join = () =>
    update((d) => {
      const f = d.flats.find((x) => x.id === flat!.id)!
      const u = d.users.find((x) => x.id === d.sessionUserId)!
      u.flatId = f.id
      if (isCook) {
        f.cookId = u.id
        f.cookName = u.name
        f.cookPhone = u.phone
        f.cookLang = u.lang
      } else {
        if (!f.memberIds.includes(u.id)) f.memberIds.push(u.id)
        if (takeTurn && !f.rotation.includes(u.id)) f.rotation.push(u.id)
      }
    })
  return (
    <div className="auth">
      {onBack && <button type="button" className="back" onClick={onBack}>‹ Back</button>}
      <h2>{isCook ? 'Which flat do you cook for?' : 'Join your flat'}</h2>
      <p className="muted">{isCook ? 'Ask the flat for their 6-letter code.' : 'Enter the 6-letter code a flatmate shared.'}</p>
      <input className="otp code" autoFocus maxLength={6} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC123" aria-label="Flat code" />
      <p className="muted small">Prototype: the sample flat's code is <button type="button" className="link" onClick={() => setCode(DEMO_CODE)}>{DEMO_CODE}</button></p>
      {flat && (
        <div className="card join-card">
          <div className="row gap8">
            <span className="flat-badge">🏠</span>
            <div>
              <strong>{flat.name}</strong>
              <div className="muted small">{flat.area} · {flat.memberIds.length} flatmates · cook: {flat.cookName || 'not added'}</div>
            </div>
          </div>
          {!isCook && (
            <label className="toggle">
              <input type="checkbox" checked={takeTurn} onChange={(e) => setTakeTurn(e.target.checked)} />
              <span>
                <strong>I'll take a turn ordering</strong>
                <span className="muted small">One owner a night, turns rotate. You're only asked on your night.</span>
              </span>
            </label>
          )}
        </div>
      )}
      <button type="button" className="btn btn-primary btn-block" disabled={!flat} onClick={join}>
        {flat ? `Join ${flat.name}` : 'Enter a valid code'}
      </button>
    </div>
  )
}

function CreateFlat({ onBack }: { onBack: () => void }) {
  const { me, update } = useStore()
  const [step, setStep] = useState(0)
  const [f, setF] = useState({ name: '', area: '', cookName: '', cookPhone: '', cookLang: 'hi' as Lang, cookVisits: 1 as 1 | 2, dishes: [] as string[], staples: 0, takeTurn: true })
  const [custom, setCustom] = useState('')
  const [created, setCreated] = useState<Flat | null>(null)
  const steps = ['Flat', 'Cook', 'Usual dishes', 'Turns']

  const create = () => {
    const flat: Flat = {
      id: uid('flat'),
      name: f.name.trim(),
      area: f.area.trim(),
      code: inviteCode(),
      createdAt: isoDate(new Date()),
      memberIds: [me!.id],
      rotation: f.takeTurn ? [me!.id] : [],
      cookId: null,
      cookName: f.cookName.trim(),
      cookPhone: f.cookPhone.replace(/\D/g, '').slice(-10),
      cookLang: f.cookLang,
      cookVisits: f.cookVisits,
      usualDishes: f.dishes,
      staplesWeekday: f.staples,
    }
    setCreated(flat)
  }

  if (created) {
    const invite = `Join our flat "${created.name}" on Rasoi Ready so groceries are sorted the night before. Code: ${created.code}`
    const cookMsg = `${created.cookName || 'Didi'}, kal kya banana hai aur kya khatam ho raha hai, ab Rasoi Ready par bataiye. Code: ${created.code}`
    return (
      <div className="auth">
        <div className="done-mark">✓</div>
        <h2>{created.name} is ready</h2>
        <p className="muted">Invite your flatmates and your cook. They join with this code.</p>
        <div className="code-box">{created.code}</div>
        <a className="btn btn-wa btn-block" href={waShare(invite)} target="_blank" rel="noreferrer">Invite flatmates on WhatsApp</a>
        <a className="btn btn-outline btn-block" href={waShare(cookMsg)} target="_blank" rel="noreferrer">Send {created.cookName || 'your cook'} her link</a>
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() =>
            update((d) => {
              d.flats.push(created)
              const u = d.users.find((x) => x.id === d.sessionUserId)!
              u.flatId = created.id
            })
          }
        >
          Go to my flat
        </button>
      </div>
    )
  }

  const canNext = [f.name.trim(), f.cookName.trim(), f.dishes.length >= 3, true][step]
  return (
    <div className="auth">
      <button type="button" className="back" onClick={() => (step ? setStep(step - 1) : onBack())}>‹ Back</button>
      <div className="stepper">
        {steps.map((s, i) => <span key={s} className={i <= step ? 'on' : ''}>{s}</span>)}
      </div>

      {step === 0 && (
        <>
          <h2>Your flat</h2>
          <label className="field"><span>Flat name</span><input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Quad 3, Flat 402" /></label>
          <label className="field"><span>Area</span><input value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} placeholder="e.g. Gachibowli" /></label>
        </>
      )}

      {step === 1 && (
        <>
          <h2>Your cook</h2>
          <p className="muted">She is the only one who knows the kitchen. She'll tell the flat each evening what's running out, by voice or by tapping pictures.</p>
          <label className="field"><span>Cook's name</span><input autoFocus value={f.cookName} onChange={(e) => setF({ ...f, cookName: e.target.value })} placeholder="e.g. Sunita didi" /></label>
          <label className="field"><span>Her phone (optional)</span><input inputMode="numeric" value={f.cookPhone} onChange={(e) => setF({ ...f, cookPhone: e.target.value })} placeholder="She's connected when she signs in" /></label>
          <div className="field">
            <span>She speaks</span>
            <div className="seg seg-big">
              {(['hi', 'te', 'en'] as Lang[]).map((l) => (
                <button key={l} type="button" className={f.cookLang === l ? 'on' : ''} onClick={() => setF({ ...f, cookLang: l })}>{l === 'hi' ? 'Hindi' : l === 'te' ? 'Telugu' : 'English'}</button>
              ))}
            </div>
          </div>
          <div className="field">
            <span>She comes</span>
            <div className="seg seg-big">
              <button type="button" className={f.cookVisits === 1 ? 'on' : ''} onClick={() => setF({ ...f, cookVisits: 1 })}>Once a day</button>
              <button type="button" className={f.cookVisits === 2 ? 'on' : ''} onClick={() => setF({ ...f, cookVisits: 2 })}>Twice a day</button>
            </div>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <h2>Your usual dishes</h2>
          <p className="muted">Pick the 10 to 15 dishes your cook makes most. We'll suggest tomorrow's dish from these, so nobody has to answer "kya banau?". <strong>{f.dishes.length} picked.</strong></p>
          <div className="chips">
            {[...DISH_IDEAS, ...f.dishes.filter((d) => !DISH_IDEAS.includes(d))].map((d) => (
              <button key={d} type="button" className={`chip ${f.dishes.includes(d) ? 'chip-on' : ''}`} onClick={() => setF({ ...f, dishes: f.dishes.includes(d) ? f.dishes.filter((x) => x !== d) : [...f.dishes, d] })}>
                {f.dishes.includes(d) ? '✓ ' : ''}{d}
              </button>
            ))}
          </div>
          <div className="row gap8">
            <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Add another dish" />
            <button type="button" className="btn btn-outline" disabled={!custom.trim()} onClick={() => { setF({ ...f, dishes: [...f.dishes, custom.trim()] }); setCustom('') }}>Add</button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <h2>Turns and staples</h2>
          <label className="toggle">
            <input type="checkbox" checked={f.takeTurn} onChange={(e) => setF({ ...f, takeTurn: e.target.checked })} />
            <span>
              <strong>I'll take a turn ordering</strong>
              <span className="muted small">Each night one named owner orders. Only they are reminded, once.</span>
            </span>
          </label>
          <label className="field">
            <span>Weekly staples check (atta, rice, oil, dal)</span>
            <select value={f.staples} onChange={(e) => setF({ ...f, staples: Number(e.target.value) })}>
              {WEEKDAYS.map((w, i) => <option key={w} value={i}>{w}</option>)}
            </select>
          </label>
        </>
      )}

      <button type="button" className="btn btn-primary btn-block" disabled={!canNext} onClick={() => (step < 3 ? setStep(step + 1) : create())}>
        {step < 3 ? 'Next' : 'Create flat'}
      </button>
    </div>
  )
}
