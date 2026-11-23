# Rasoi Ready · Smart Grocery Planner (MVP prototype)

Team B14, Section B · Software Product Management, ISB (Prof Chandrashekhar V) · November 2026
Dishali Jain · Mayur Sanjay Deshpande · Vaibhav Ravindra Gurjar · Sai Kiran · Rudraksh Gupta

> For flatmates who share a cook, Rasoi Ready puts tomorrow's ingredients in the kitchen before the cook
> arrives, with no more effort than a WhatsApp message.

A mobile-first web app for the two people in the job: **flatmates** (our primary persona, Rohan) and
**the cook**, who is the only one who knows the kitchen.

## How it works

1. **The cook's evening note.** Each evening the cook answers three questions in Hindi, Telugu or English,
   by tapping pictures or recording a voice note: *Did today have everything? What will you make tomorrow?
   What is running out?* On the flat's staples day she also checks atta, rice, oil and dal.
2. **One clean list.** Her items and anything a flatmate adds merge into one list with quantities, so an
   item is bought once, not twice.
3. **One named owner.** Turns rotate on their own. Only tonight's owner orders, and only they get one
   reminder at 10 pm, never a second. They copy the list into Blinkit, Zepto or Instamart, order, and tap
   **Ordered**. The bill can be split per flatmate and sent to Splitwise.
4. **Checked the next evening.** The cook's next note says whether she had everything.

If the cook hasn't sent her note by 8 pm, tonight's owner is asked what's low instead. If she hasn't named
a dish, the app suggests one from the flat's 10–15 usual dishes that hasn't been made this week.

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
work). A sample flat, **Quad 3** (Rohan, Aditya, Karan and Sunita didi), comes with two weeks of history.

- On the login screen tap a sample account, or sign up with any other number and create your own flat.
- **Prototype controls** above the phone move the clock through the evening (6 pm, 8:30, 9:15, 10:15,
  next day) and switch between people, so one person can play the whole flat. They are not part of the product.

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
