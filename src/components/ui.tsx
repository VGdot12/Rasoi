import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AMOUNTS, formatQty, parseQty, UNITS_FOR, type Unit, type UnitType } from '../lib/qty'

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-head">
          <h3>{title}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}

export function Avatar({ name, size = 32, tone }: { name: string; size?: number; tone?: number }) {
  const hues = ['#1f4d3a', '#b5651d', '#5a4a9c', '#2f6f8f', '#8a3b52']
  const h = tone ?? name.split('').reduce((n, c) => n + c.charCodeAt(0), 0)
  return (
    <span className="avatar" style={{ width: size, height: size, background: hues[h % hues.length], fontSize: size * 0.42 }} aria-hidden>
      {name.trim().charAt(0).toUpperCase()}
    </span>
  )
}

export function CopyBtn({ text, label, className = 'btn btn-outline' }: { text: string; label: string; className?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
        } catch {
          /* blocked */
        }
        setDone(true)
        setTimeout(() => setDone(false), 1400)
      }}
    >
      {done ? '✓ Copied' : label}
    </button>
  )
}

export const waShare = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`

/** Voice note playback. Seeded history has no audio, so it shows the length only. */
export function VoiceNote({ url, secs, label }: { url: string; secs: number; label?: string }) {
  const ref = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  return (
    <div className="voice">
      <button
        type="button"
        className="voice-play"
        disabled={!url}
        aria-label={url ? (playing ? 'Pause voice note' : 'Play voice note') : 'Voice note'}
        onClick={() => {
          const a = ref.current
          if (!a) return
          if (a.paused) { void a.play(); setPlaying(true) } else { a.pause(); setPlaying(false) }
        }}
      >
        {playing ? '❚❚' : '▶'}
      </button>
      <span className="voice-wave" />
      <span className="voice-len">0:{String(Math.min(59, Math.max(1, Math.round(secs)))).padStart(2, '0')}</span>
      {label && <span className="voice-label">{label}</span>}
      {url && <audio ref={ref} src={url} onEnded={() => setPlaying(false)} />}
    </div>
  )
}

export function Recorder({ onDone, labels }: { onDone: (url: string, secs: number) => void; labels: { start: string; stop: string } }) {
  const [rec, setRec] = useState<{ mr: MediaRecorder | null; started: number } | null>(null)
  const [secs, setSecs] = useState(0)
  const chunks = useRef<Blob[]>([])
  useEffect(() => {
    if (!rec) return
    const t = setInterval(() => setSecs(Math.round((Date.now() - rec.started) / 1000)), 250)
    return () => clearInterval(t)
  }, [rec])

  const start = async () => {
    chunks.current = []
    setSecs(0)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      mr.ondataavailable = (e) => chunks.current.push(e.data)
      mr.start()
      setRec({ mr, started: Date.now() })
    } catch {
      setRec({ mr: null, started: Date.now() }) // no microphone here: record the length only
    }
  }
  const stop = () => {
    if (!rec) return
    const length = Math.max(1, Math.round((Date.now() - rec.started) / 1000))
    const mr = rec.mr
    setRec(null)
    if (!mr) return onDone('', length)
    mr.onstop = () => {
      mr.stream.getTracks().forEach((t) => t.stop())
      const blob = new Blob(chunks.current, { type: mr.mimeType || 'audio/webm' })
      const fr = new FileReader()
      fr.onload = () => onDone(String(fr.result), length)
      fr.readAsDataURL(blob)
    }
    mr.stop()
  }
  useEffect(() => {
    if (rec && secs >= 60) stop()
  })
  return (
    <button type="button" className={`mic ${rec ? 'mic-on' : ''}`} onClick={rec ? stop : start}>
      <span className="mic-dot">🎤</span>
      <span>{rec ? `${labels.stop} · 0:${String(secs).padStart(2, '0')}` : labels.start}</span>
    </button>
  )
}

/** Quantity as two dropdowns: unit, then amount for that unit. */
export function QtyPicker({ value, type, onChange, disabled, label }: { value: string; type: UnitType; onChange: (q: string) => void; disabled?: boolean; label: string }) {
  const q = parseQty(value, type)
  const units = UNITS_FOR[type]
  return (
    <span className="qty-pick">
      <select aria-label={`${label} amount`} disabled={disabled} value={q.amount} onChange={(e) => onChange(formatQty({ unit: q.unit, amount: Number(e.target.value) }))}>
        {AMOUNTS[q.unit].map((a) => <option key={a} value={a}>{a}</option>)}
      </select>
      <select aria-label={`${label} unit`} disabled={disabled || units.length < 2} value={q.unit} onChange={(e) => { const u = e.target.value as Unit; onChange(formatQty({ unit: u, amount: AMOUNTS[u][u === 'g' || u === 'ml' ? 2 : 0] })) }}>
        {units.map((u) => <option key={u} value={u}>{u}</option>)}
      </select>
    </span>
  )
}
