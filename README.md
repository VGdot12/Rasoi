# Rasoi Ready · Smart Grocery Planner (MVP prototype)

Team B14, Section B · Software Product Management, ISB (Prof Chandrashekhar V) · November 2026
Dishali Jain · Mayur Sanjay Deshpande · Vaibhav Ravindra Gurjar · Sai Kiran · Rudraksh Gupta

> For flatmates who share a cook, Rasoi Ready puts tomorrow's ingredients in the kitchen before the cook
> arrives, with no more effort than a WhatsApp message.

A mobile-first web app for the two people in the job: **flatmates** (our primary persona, Rohan) and
**the cook**, who is the only one who knows the kitchen.

## How it works

1. **The cook's evening note (by 8 pm).** The cook answers three questions in Hindi, Telugu or English,
   by tapping pictures or recording a voice note: *Did today have everything? What will you make tomorrow?
   What is running out?* On the flat's staples day she also checks atta, rice, oil and dal.
2. **List created (10 pm).** Her items and anything a flatmate adds merge into one list. Every item has a
   quantity picked from dropdowns: g (50, 100, 250, 500) or kg (1–5) for solids, ml (50, 100, 250, 500) or
   L (1–5) for liquids, Nos (1–12) for things you count, such as eggs, lemons and bread.
3. **Order placed.** Only tonight's owner orders. From 10 pm they see a reminder that stays until they place
   the order in Blinkit, Zepto or Instamart and tap **Order placed**. Everyone in the flat sees it. The bill
   can be split per flatmate and sent to Splitwise.
4. **Order received.** When the delivery arrives, any flatmate taps **Order received**.

These four milestones are shown at the top of the Tonight screen. If the cook hasn't sent her note by 8 pm,
tonight's owner is asked what's low instead. If she hasn't named a dish, the app suggests one from the
flat's usual dishes.

## Screens

| Who | Screen | Pain point it answers |
|---|---|---|
| Everyone | Choose who you are, then phone sign-in with a one-time code | — |
| Flatmate | Create a flat (cook, language, usual dishes, staples day, turn) or join with a 6-letter code; invite on WhatsApp | — |
| Flatmate | **Home** (tomorrow's cooking): the four milestones, the one thing to do now, the cook's note, and a dish decision only when Didi hasn't picked one | PR1 missing stock, PR4 what to cook |
| Flatmate | **Groceries**: *To order* on top (needed → ordered → received) and *In the kitchen* below; received items move into the kitchen, and anything running low can be added with **+ Order** | PR1, PR3 incomplete orders, duplicate buys |
| Flatmate | **Dishes**: usual dishes, what was cooked this week | PR4 |
| Flatmate | **Flat**: turns (who orders tonight and next, hand over, who's ordered this month), members, invite code, cook, staples day, plan (₹149 a month per flat, split) | PR2 no owner |
| Cook | One screen, big picture tiles, her language, voice note, "not coming tomorrow", order status | PR1 |

What it deliberately does not do (from our non-goals): order without approval, deliver, take payments,
scan barcodes, show spend dashboards. The *In the kitchen* list was added at the team's request; it fills
itself from received orders and the cook's "missing today" answers, so nobody has to count stock.

## Trying the prototype

There is no backend yet: data is kept in the browser, and login codes are not really sent. The sample flat
is **Quad 3** (Aditya, Rohan, Karan and their cook, Sunita didi). It has no made-up history: every
evening in it is one you play.

**Pick who you are on the first screen.** You live through the whole evening as that person and can't
switch mid-way; log out to try another. Signing in needs no typing: the number is filled in and the code
always fills itself after about 1.5 seconds, as SMS autofill does (for new numbers too). Then press **Simulate**: the clock runs from 7:30 pm to midnight at
about 6 seconds per hour (`SIM.minutesPerSecond` in `src/lib/logic.ts`), and **Restart** takes you back to 7:30 pm.

| Journey | What you do | What happens on its own |
|---|---|---|
| **Aditya · orders tonight** | Add anything you need; at 10 pm tap **Order now → Order placed**; about 20 minutes later tap **Order received** | Didi's note at 8 pm; the list at 10 pm, with a reminder that stays until you order |
| **Rohan · flatmate** | Add anything you need before 10 pm; tap **Order received** from 11:20 pm | Didi's note at 8 pm; the list at 10 pm; Aditya orders at 11 pm; if you haven't marked it, Aditya receives it at 11:45 pm |
| **Sunita didi · cook** | At 8 pm the clock waits for you: answer the three questions and send | The flat orders at 11 pm and receives it at 11:30 pm |

Each journey ends on a "Kitchen ready for tomorrow" screen with a recap of the evening.

## Analytics

The app records the 33 events in the team's analytics and event tracking spec (hashed people, no
content) and computes the North Star, its inputs, the GAME goals and the guardrails from them.
Analytics are for the team only: **Flat tab → 🔒 Analytics**, password `SWPMB14` (Didi's screen has the
same button after she sends her note). They are live and day by day: Day 1 appears as its evening runs,
and **Next day ›** at midnight adds Day 2. Details: `DOCUMENTATION.md`, section 10.

## Design principles applied

From [Design principles for reducing cognitive load](https://lawsofux.com/articles/2015/design-principles-for-reducing-cognitive-load/):

- **Avoid unnecessary elements:** Home shows one card with the one thing to do now; the dish card appears only when a decision is needed; turns live in the Flat tab. Four tabs: Home, Groceries, Dishes, Flat.
- **Common patterns:** bottom tab bar, phone and one-time-code sign-in with autofill, notification bell, progress steps.
- **Eliminate unnecessary tasks:** defaults everywhere (quantities, dish suggestion, number and code filled in); only tonight's owner is ever asked to order.
- **Minimise choices:** one primary button per state; less-used details ("Who's ordered this month", turn settings) open on request.
- **Show choices as a group:** all ingredients and all usual dishes are visible at once.
- **Readability:** body text 15–16 px, high contrast, plain sentences.
- **Icons with labels:** every icon has a text label (tabs, list items, persona cards, buttons).

From the [peak-end rule](https://lawsofux.com/peak-end-rule/):

- **Peak:** placing the order is quick and confirmed straight away ("Done! Everyone in Quad 3 can see the order").
- **End:** every journey closes on a celebratory "Kitchen ready for tomorrow" card with the evening's recap, your share of the bill and who orders tomorrow; the cook's closes on "All set for tomorrow!" in her language.
- **Soften negatives:** reminders and missing-note messages are worded calmly, never as alarms.

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm test
npm run build    # output in dist/
```

## Deploy on Vercel

1. Push to GitHub:
   ```bash
   git remote add origin https://github.com/<you>/rasoi-ready.git
   git push -u origin main
   ```
2. Vercel → **Add New → Project** → import the repo → **Deploy**. It is detected as a Vite app
   (`vercel.json` sets `npm run build` and `dist`). No environment variables.

## Code map

- `src/lib/logic.ts` — turns, the nightly cycle, the one list, dish suggestion, notifications (one reminder, owner only)
- `src/lib/catalogue.ts`, `src/lib/i18n.ts` — ingredients with pictures and Hindi/Telugu names, the cook's wording
- `src/lib/seed.ts` — the sample flat
- `src/screens/` — `Auth`, `FlatStart`, `Home`, `Groceries`, `Tabs` (Dishes, Flat), `Sheets` (add item, order), `Cook`

Stack: Vite 5, React 18, TypeScript, Vitest. Next step for a real launch: a backend for accounts and
shared flat data (e.g. Supabase or Firebase) and real OTP.
