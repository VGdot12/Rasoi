import { useEffect, useState } from 'react'
import { Milestones, SimBar } from '../components/Sim'
import { Recorder, VoiceNote } from '../components/ui'
import { INGREDIENTS, nameOf as ingName, STAPLE_KEYS, type Lang } from '../lib/catalogue'
import { t } from '../lib/i18n'
import { finishTask, startTask, taskOpen, track } from '../lib/analytics'
import { addDays, buildList, finalDish, findEvening, fireNoteEvents, firstName, nameOf, removeFromPantry, wasPrompted, weekday } from '../lib/logic'
import { useStore } from '../lib/store'
import { AnalyticsEntry } from './Metrics'
import type { CookNote } from '../lib/types'

const DAILY = INGREDIENTS.filter((i) => !i.staple)

/** The cook's side: big pictures, her language, one note a day. No typing needed. */
export function CookApp() {
  const { db, me, flat, tonight, today, time, update, updateTonight } = useStore()
  const [editing, setEditing] = useState(false)
  const lang: Lang = me?.lang ?? 'hi'
  const existing = tonight?.note
  const [draft, setDraft] = useState<Omit<CookNote, 'at'>>(() => ({
    todayAllGood: existing?.todayAllGood ?? null,
    todayMissing: existing?.todayMissing ?? [],
    dish: existing?.dish ?? '',
    items: existing?.items ?? [],
    voiceUrl: existing?.voiceUrl ?? '',
    voiceSecs: existing?.voiceSecs ?? 0,
    staplesChecked: existing?.staplesChecked ?? false,
    dayOffTomorrow: existing?.dayOffTomorrow ?? false,
    plannedDishCooked: existing?.plannedDishCooked ?? null,
    topUp: existing?.topUp ?? false,
    notFresh: existing?.notFresh ?? [],
  }))
  // Effort: cook_note runs from her screen opening to Send.
  const writing = !existing || editing
  useEffect(() => {
    if (writing && !taskOpen('cook_note')) startTask('cook_note', editing ? 1 : 0)
  }, [writing]) // eslint-disable-line react-hooks/exhaustive-deps
  // The end of her evening: evening_recap_viewed, once.
  const done = !!tonight?.received && !writing
  useEffect(() => {
    if (done && me && flat) update((d) => track(d, 'evening_recap_viewed', { flatId: flat.id, who: me.id, once: 'recap:' + me.id }, { role: 'cook', share_shown_inr: 0 }))
  }, [done]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!me || !flat || !tonight) return null
  const prevDish = (() => {
    const p = findEvening(db, flat.id, addDays(today, -1))
    return p && !p.skipped ? finalDish(p) : ''
  })()

  const staplesDay = weekday(today) === flat.staplesWeekday
  const toggle = (list: string[], k: string) => (list.includes(k) ? list.filter((x) => x !== k) : [...list, k])
  const L = (k: Parameters<typeof t>[0]) => t(k, lang)
  const label = (k: string) => (lang === 'en' ? ingName(k, 'en') : ingName(k, lang))

  const send = () => {
    const task = finishTask('cook_note')
    updateTonight((e, d) => {
      const edited = !!e.note
      e.note = {
        ...draft,
        at: time,
        staplesChecked: staplesDay,
        plannedDishCooked: prevDish ? draft.plannedDishCooked ?? null : null,
        prompted: wasPrompted(d, flat.id, e.date),
        dishWasSuggested: !!draft.dish && draft.dish === e.suggestion,
        edited,
      }
      if (draft.todayAllGood === false) removeFromPantry(d, e.flatId, draft.todayMissing)
      e.skipped = draft.dayOffTomorrow
      if (draft.dish) {
        e.dish = draft.dish
        e.dishSource = 'cook'
      } else if (e.dishSource === 'cook') {
        e.dish = ''
        e.dishSource = ''
      }
      fireNoteEvents(d, flat, e, me.id, edited)
      if (task) track(d, 'task_completed', { flatId: flat.id, who: me.id }, task)
    })
    setEditing(false)
  }

  const header = (
    <>
    <SimBar />
    <div className="cook-head">
      <div>
        <div className="cook-hello">{L('greeting')}, {firstName(me.name)} 🙏</div>
        <div className="muted small">{flat.name} · {flat.area}</div>
      </div>
      <div className="lang-switch">
        {(['hi', 'te', 'en'] as Lang[]).map((l) => (
          <button key={l} type="button" className={lang === l ? 'on' : ''} onClick={() => update((d) => void (d.users.find((u) => u.id === me.id)!.lang = l))}>
            {l === 'hi' ? 'हिं' : l === 'te' ? 'తె' : 'EN'}
          </button>
        ))}
      </div>
    </div>
    <Milestones />
    </>
  )

  if (existing && !editing) {
    const lines = buildList(tonight)
    return (
      <div className="screen cook">
        {header}
        {tonight.received ? (
          <section className="finale cook-finale" aria-live="polite">
            <div className="confetti" aria-hidden>{Array.from({ length: 14 }, (_, i) => <i key={i} />)}</div>
            <div className="finale-mark">✓</div>
            <h3>{L('allSet')}</h3>
            <p>{L('allSetSub')}</p>
          </section>
        ) : (
          <section className="cook-done">
            <div className="done-mark">✓</div>
            <h2>{L('sent')}</h2>
            <p>{L('sentSub')}</p>
          </section>
        )}
        <section className="card">
          <div className="card-title">{L('tomorrowList')}{tonight.dish ? ` · ${tonight.dish}` : ''}</div>
          <div className="cook-tiles small-tiles">
            {lines.map((l) => (
              <div key={l.key} className="ctile on"><span className="ctile-emoji">{l.emoji}</span><span>{label(l.key)}</span></div>
            ))}
          </div>
          {existing.voiceSecs > 0 && <VoiceNote url={existing.voiceUrl} secs={existing.voiceSecs} />}
          {!tonight.received && <p className={`order-status ${tonight.ordered ? 'ok' : ''}`}>
            {tonight.ordered ? `🛵 ${L('ordered')}: ${firstName(nameOf(db, tonight.ordered.by))}` : `⏳ ${L('waitingOrder')}`}
          </p>}
        </section>
        <button type="button" className="btn btn-outline btn-block" onClick={() => setEditing(true)}>{L('edit')}</button>
        <button type="button" className="link center-block" onClick={() => update((d) => void (d.sessionUserId = null))}>Log out</button>
        <div className="cook-team"><AnalyticsEntry /></div>
      </div>
    )
  }

  const ready = draft.todayAllGood !== null
  return (
    <div className="screen cook">
      {header}
      <p className="cook-prompt">{L('prompt')}</p>

      <section className="cook-q">
        <h3><span className="qn">1</span>{L('q1')}</h3>
        <div className="big-choice">
          <button type="button" className={draft.todayAllGood === true ? 'on good' : ''} onClick={() => setDraft({ ...draft, todayAllGood: true, todayMissing: [] })}>👍<span>{L('yesAll')}</span></button>
          <button type="button" className={draft.todayAllGood === false ? 'on bad' : ''} onClick={() => setDraft({ ...draft, todayAllGood: false })}>👎<span>{L('noSomething')}</span></button>
        </div>
        {draft.todayAllGood === false && (
          <>
            <div className="muted small">{L('whatMissing')}</div>
            <div className="cook-tiles">
              {DAILY.map((i) => (
                <button key={i.key} type="button" className={`ctile ${draft.todayMissing.includes(i.key) ? 'on bad' : ''}`} onClick={() => setDraft({ ...draft, todayMissing: toggle(draft.todayMissing, i.key) })}>
                  <span className="ctile-emoji">{i.emoji}</span><span>{label(i.key)}</span>
                </button>
              ))}
            </div>
            <div className="muted small">🥀 {L('notFresh')}</div>
            <div className="cook-tiles small-pick">
              {DAILY.filter((i) => i.veg).map((i) => (
                <button key={i.key} type="button" className={`ctile ${(draft.notFresh ?? []).includes(i.key) ? 'on bad' : ''}`} onClick={() => setDraft({ ...draft, notFresh: toggle(draft.notFresh ?? [], i.key) })}>
                  <span className="ctile-emoji">{i.emoji}</span><span>{label(i.key)}</span>
                </button>
              ))}
            </div>
            <label className="toggle">
              <input type="checkbox" checked={!!draft.topUp} onChange={(e) => setDraft({ ...draft, topUp: e.target.checked })} />
              <span><strong>🛵 {L('topUp')}</strong></span>
            </label>
          </>
        )}
        {prevDish && draft.todayAllGood !== null && (
          <div className="planned">
            <div className="muted small">{L('planned')} <strong>{prevDish}</strong>?</div>
            <div className="seg">
              <button type="button" className={draft.plannedDishCooked === true ? 'on' : ''} onClick={() => setDraft({ ...draft, plannedDishCooked: true })}>✓ {L('plannedYes')}</button>
              <button type="button" className={draft.plannedDishCooked === false ? 'on' : ''} onClick={() => setDraft({ ...draft, plannedDishCooked: false })}>{L('plannedNo')}</button>
            </div>
          </div>
        )}
      </section>

      <section className="cook-q">
        <h3><span className="qn">2</span>{L('q2')}</h3>
        <div className="dish-chips">
          {[tonight.suggestion, ...flat.usualDishes.filter((d) => d !== tonight.suggestion)].filter(Boolean).map((d, i) => (
            <button key={d} type="button" className={`dchip ${draft.dish === d ? 'on' : ''}`} onClick={() => setDraft({ ...draft, dish: draft.dish === d ? '' : d })}>
              {i === 0 && tonight.suggestion && <span className="sugg">⭐ {L('suggested')}</span>}
              {d}
            </button>
          ))}
          <button type="button" className={`dchip ${!draft.dish ? 'on soft' : ''}`} onClick={() => setDraft({ ...draft, dish: '' })}>🤷 {L('notSure')}</button>
        </div>
      </section>

      <section className="cook-q">
        <h3><span className="qn">3</span>{L('q3')}</h3>
        <div className="cook-tiles">
          {DAILY.map((i) => (
            <button key={i.key} type="button" className={`ctile ${draft.items.includes(i.key) ? 'on' : ''}`} onClick={() => setDraft({ ...draft, items: toggle(draft.items, i.key) })}>
              <span className="ctile-emoji">{i.emoji}</span><span>{label(i.key)}</span>
            </button>
          ))}
        </div>
        {staplesDay && (
          <>
            <div className="staples-head">📦 {L('staples')}</div>
            <div className="cook-tiles">
              {STAPLE_KEYS.map((k) => {
                const i = INGREDIENTS.find((x) => x.key === k)!
                return (
                  <button key={k} type="button" className={`ctile ${draft.items.includes(k) ? 'on' : ''}`} onClick={() => setDraft({ ...draft, items: toggle(draft.items, k) })}>
                    <span className="ctile-emoji">{i.emoji}</span><span>{label(k)}</span>
                  </button>
                )
              })}
            </div>
          </>
        )}
        <div className="voice-box">
          <div className="muted small">{L('voice')}</div>
          <Recorder labels={{ start: L('hold'), stop: L('stop') }} onDone={(url, secs) => setDraft((d) => ({ ...d, voiceUrl: url, voiceSecs: secs }))} />
          {draft.voiceSecs > 0 && <VoiceNote url={draft.voiceUrl} secs={draft.voiceSecs} />}
        </div>
      </section>

      <label className="toggle dayoff">
        <input type="checkbox" checked={draft.dayOffTomorrow} onChange={(e) => setDraft({ ...draft, dayOffTomorrow: e.target.checked })} />
        <span><strong>🏖️ {L('dayOff')}</strong></span>
      </label>

      <button type="button" className="btn btn-primary btn-block btn-xl" disabled={!ready} onClick={send}>{L('send')} ➜</button>
      {!ready && <p className="muted small center">① {L('q1')}</p>}
    </div>
  )
}
