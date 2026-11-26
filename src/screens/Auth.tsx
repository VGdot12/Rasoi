import { useEffect, useState } from 'react'
import type { Lang } from '../lib/catalogue'
import { uid } from '../lib/logic'
import { PERSONAS } from '../lib/seed'
import { useStore } from '../lib/store'
import type { Role } from '../lib/types'

type Step = 'pick' | 'phone' | 'otp' | 'profile'

/**
 * Start: pick whose evening to live through (Aditya, Rohan or Sunita didi), then sign in as them.
 * The phone number is filled in and the code auto-fills, as SMS autofill does, so there is nothing to type.
 */
export function Auth() {
  const { db, update, sim } = useStore()
  const [step, setStep] = useState<Step>('pick')
  const [phone, setPhone] = useState('')
  const [persona, setPersona] = useState<(typeof PERSONAS)[number] | null>(null)
  const [otp, setOtp] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('flatmate')
  const [lang, setLang] = useState<Lang>('hi')
  const digits = phone.replace(/\D/g, '').slice(-10)

  // The code always fills itself after about 1.5 seconds, as SMS autofill does. Nobody types it.
  useEffect(() => {
    if (step !== 'otp') return
    setOtp('')
    const t = setTimeout(() => setOtp('4821'), 1500)
    return () => clearTimeout(t)
  }, [step])

  const verify = () => {
    const existing = db.users.find((u) => u.phone === digits)
    if (existing) {
      if (persona) sim.resetEvening() // every journey starts fresh at 7:30 pm
      update((d) => void (d.sessionUserId = existing.id))
    }
    else setStep('profile')
  }

  const createUser = () =>
    update((d) => {
      const id = uid('u')
      const flat = role === 'cook' ? d.flats.find((f) => f.cookPhone.replace(/\D/g, '').slice(-10) === digits) : undefined
      d.users.push({ id, name: name.trim(), phone: digits, role, lang: role === 'cook' ? lang : 'en', flatId: flat?.id ?? null })
      if (flat) flat.cookId = id
      d.sessionUserId = id
    })

  if (step === 'pick')
    return (
      <div className="auth pick">
        <div className="welcome-top">
          <div className="welcome-art" aria-hidden>
            <div className="pot">🍲</div>
            <div className="steam s1" />
            <div className="steam s2" />
            <div className="steam s3" />
          </div>
          <h1>Rasoi Ready</h1>
          <p className="welcome-lead">Tomorrow's ingredients, in the kitchen before your cook arrives.</p>
        </div>
        <h2 className="pick-title">Who are you tonight?</h2>
        <p className="muted pick-sub">Flat: Quad 3. You'll go through the whole evening as this person.</p>
        <div className="personas">
          {PERSONAS.map((p) => (
            <button
              key={p.userId}
              type="button"
              className="persona"
              onClick={() => {
                setPersona(p)
                setPhone(p.phone)
                setOtp('')
                setStep('phone')
              }}
            >
              <span className="persona-emoji" aria-hidden>{p.emoji}</span>
              <span className="persona-text">
                <strong>{p.name}</strong>
                <span className="persona-role">{p.role}</span>
                <span className="muted small">{p.blurb}</span>
              </span>
              <span className="persona-go" aria-hidden>›</span>
            </button>
          ))}
        </div>
        <button type="button" className="link center-block" onClick={() => { setPersona(null); setPhone(''); setStep('phone') }}>
          New here? Set up your own flat
        </button>
      </div>
    )

  if (step === 'phone')
    return (
      <div className="auth">
        <button type="button" className="back" onClick={() => setStep('pick')}>‹ Back</button>
        <h2>{persona ? `Sign in as ${persona.name}` : 'Your phone number'}</h2>
        <p className="muted">We'll send a one-time code. No password.</p>
        <label className="field">
          <span>Mobile number</span>
          <div className="phone-input">
            <span>+91</span>
            <input inputMode="numeric" autoFocus={!persona} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" maxLength={14} />
          </div>
        </label>
        <button type="button" className="btn btn-primary btn-block" disabled={digits.length !== 10} onClick={() => setStep('otp')}>Send code</button>
      </div>
    )

  if (step === 'otp')
    return (
      <div className="auth">
        <button type="button" className="back" onClick={() => setStep('phone')}>‹ Back</button>
        <h2>Enter the code</h2>
        <p className="muted">Sent to +91 {digits.replace(/(\d{5})(\d{5})/, '$1 $2')}</p>
        <input className={`otp ${otp ? 'otp-filled' : ''}`} inputMode="numeric" autoComplete="one-time-code" readOnly maxLength={4} value={otp} placeholder="• • • •" aria-label="One-time code" />
        <p className="muted small center">{otp ? '✓ Filled in from your SMS' : 'Reading the code from your SMS…'}</p>
        <button type="button" className="btn btn-primary btn-block" disabled={otp.length !== 4} onClick={verify}>Verify</button>
      </div>
    )

  return (
    <div className="auth">
      <h2>Welcome! Who are you?</h2>
      <label className="field">
        <span>Your name</span>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rohan" />
      </label>
      <div className="role-pick">
        <button type="button" className={`role ${role === 'flatmate' ? 'on' : ''}`} onClick={() => setRole('flatmate')}>
          <span className="role-emoji">🏠</span>
          <strong>I live in the flat</strong>
          <span className="muted small">Share a cook with flatmates</span>
        </button>
        <button type="button" className={`role ${role === 'cook' ? 'on' : ''}`} onClick={() => setRole('cook')}>
          <span className="role-emoji">👩‍🍳</span>
          <strong>I cook for a flat</strong>
          <span className="muted small">Didi / bhaiya</span>
        </button>
      </div>
      {role === 'cook' && (
        <div className="field">
          <span>Language</span>
          <div className="seg seg-big">
            {(['hi', 'te', 'en'] as Lang[]).map((l) => (
              <button key={l} type="button" className={lang === l ? 'on' : ''} onClick={() => setLang(l)}>
                {l === 'hi' ? 'हिंदी' : l === 'te' ? 'తెలుగు' : 'English'}
              </button>
            ))}
          </div>
        </div>
      )}
      <button type="button" className="btn btn-primary btn-block" disabled={!name.trim()} onClick={createUser}>Continue</button>
    </div>
  )
}
