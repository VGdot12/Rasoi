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
| Everyone | Welcome, phone login with a one-time code, name and role | — |
| Flatmate | Create a flat (cook, language, usual dishes, staples day, turn) or join with a 6-letter code; invite on WhatsApp | — |
| Flatmate | **Tonight**: what to do now, owner, progress (note → list → ordered → all there), today's cooking, tomorrow's dish, week summary | PR1 missing stock, PR4 what to cook |
| Flatmate | **List**: one list with quantities, who added what, copy / share; adding after the order moves to tomorrow's list | PR1, PR3 incomplete orders, duplicate buys |
| Flatmate | **Turns**: next 7 owners, hand over tonight, who ordered in the last 30 days against a fair share | PR2 no owner |
| Flatmate | **Dishes**: usual dishes, what was cooked this week | PR4 |
| Flatmate | **Flat**: members, invite code, cook, staples day, plan (₹149 a month per flat, split) | — |
| Cook | One screen, big picture tiles, her language, voice note, "not coming tomorrow", order status | PR1 |

What it deliberately does not do (from our non-goals): order without approval, deliver, take payments,
track pantry stock or scan barcodes, show spend dashboards.

## Trying the prototype

There is no backend yet: data is kept in the browser, and login codes are not really sent (any 4 digits
work). The sample flat **Quad 3** (Rohan, Aditya, Karan and Sunita didi) has two weeks of history.

On the login screen pick one of the three views: **Tonight's owner**, **Roommate** or **Didi**. Inside the
app, the dark **Simulate** bar runs the evening from 7:30 pm to midnight at 20 seconds per hour, and lets you
switch between the three views at any time. ↺ restarts the evening; ⏭ moves to the next evening (turns rotate).

There are two flows:

- **Flatmate flow** (Tonight's owner or Roommate): press Simulate. Didi's note arrives on its own at 8 pm, the
  list is created at 10 pm and the owner's reminder appears. As the owner, tap **Order now → Order placed**.
  Switch to Roommate (or stay) and tap **Order received**.
- **Didi's flow**: press Simulate in Didi's view. The clock stops at 8 pm until you fill in and send her
  note; then it carries on, and you can switch to the owner to place the order.

The Simulate bar is a prototype tool, not part of the product.

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
- `src/screens/` — `Auth`, `FlatStart`, `Home`, `Tabs` (List, Turns, Dishes, Flat), `Sheets` (add item, order), `Cook`

Stack: Vite 5, React 18, TypeScript, Vitest. Next step for a real launch: a backend for accounts and
shared flat data (e.g. Supabase or Firebase) and real OTP.
