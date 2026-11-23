import { useState } from 'react'
import type { Lang } from '../lib/catalogue'
import { uid } from '../lib/logic'
import { DEMO_PHONES } from '../lib/seed'
import { useStore } from '../lib/store'
import type { Role } from '../lib/types'

type Step = 'welcome' | 'phone' | 'otp' | 'profile'

export function Auth() {
  const { db, update } = useStore()
  const [step, setStep] = useState<Step>('welcome')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('flatmate')
  const [lang, setLang] = useState<Lang>('hi')
  const digits = phone.replace(/\D/g, '').slice(-10)

  const verify = () => {
    const existing = db.users.find((u) => u.phone === digits)
    if (existing) update((d) => void (d.sessionUserId = existing.id))
    else setStep('profile')
  }

  const createUser = () =>
    update((d) => {
      const id = uid('u')
      // A cook whose number the flat already saved is connected to that flat straight away.
      const flat = role === 'cook' ? d.flats.find((f) => f.cookPhone.replace(/\D/g, '').slice(-10) === digits) : undefined
      d.users.push({ id, name: name.trim(), phone: digits, role, lang: role === 'cook' ? lang : 'en', flatId: flat?.id ?? null })
      if (flat) flat.cookId = id
      d.sessionUserId = id
    })

  if (step === 'welcome')
    return (
      <div className="auth welcome">
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
        <ul className="welcome-points">
          <li><span>🎤</span>Your cook tells the flat what's running out, the evening before</li>
          <li><span>📝</span>One clean list with quantities, ready for Blinkit or Zepto</li>
          <li><span>🔁</span>One owner each night, turns rotate. Nobody chases anyone</li>
        </ul>
        <button type="button" className="btn btn-primary btn-block" onClick={() => setStep('phone')}>Get started</button>
        <p className="fine">We never order, pay or deliver. Your Blinkit or Zepto account stays yours.</p>
      </div>
    )

  if (step === 'phone')
    return (
      <div className="auth">
        <button type="button" className="back" onClick={() => setStep('welcome')}>‹ Back</button>
        <h2>Your phone number</h2>
        <p className="muted">We'll send a one-time code. No password to remember.</p>
        <label className="field">
          <span>Mobile number</span>
          <div className="phone-input">
            <span>+91</span>
            <input inputMode="numeric" autoFocus value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" maxLength={14} />
          </div>
        </label>
        <button type="button" className="btn btn-primary btn-block" disabled={digits.length !== 10} onClick={() => setStep('otp')}>Send code</button>
        <div className="demo-accounts">
          <div className="muted small">Prototype: try a sample account in the flat "Quad 3"</div>
          <div className="row wrap gap8">
            <button type="button" className="chip" onClick={() => setPhone(DEMO_PHONES.rohan)}>Rohan · flatmate</button>
            <button type="button" className="chip" onClick={() => setPhone(DEMO_PHONES.aditya)}>Aditya · flatmate</button>
            <button type="button" className="chip" onClick={() => setPhone(DEMO_PHONES.cook)}>Sunita didi · cook</button>
          </div>
        </div>
      </div>
    )

  if (step === 'otp')
    return (
      <div className="auth">
        <button type="button" className="back" onClick={() => setStep('phone')}>‹ Back</button>
        <h2>Enter the code</h2>
        <p className="muted">Sent to +91 {digits.replace(/(\d{5})(\d{5})/, '$1 $2')}</p>
        <input className="otp" inputMode="numeric" autoFocus maxLength={4} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} placeholder="• • • •" aria-label="One-time code" />
        <p className="muted small">Prototype: any 4 digits work.</p>
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
