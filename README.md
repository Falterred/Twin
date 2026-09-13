# 🪞 Financial Twin

**Don't calculate your future. Watch it happen — a hundred different ways.**

Financial Twin isn't a budgeting app, and it isn't a calculator. It's a simulator. Tell it about your money — your income, your debts, your emergency fund — and describe one decision you're weighing (a new EMI, a job change, a big purchase). Then watch a *twin* of your financial life live out the next 12 months, over and over, across dozens of randomly-generated possible years. Job loss. Medical bills. A surprise bonus. A rent hike. Sometimes your twin sails through untouched. Sometimes it doesn't.

That's the point. Real life isn't one projection — it's a hundred overlapping ones, and luck is part of the math. This is the first tool that shows you that honestly.

---

## Why this exists

Every financial calculator you've ever used tells you a single number: *"you'll have ₹X in a year."* That's a quiet lie. It hides the fact that the version of you who gets a bonus in month 4 ends up somewhere completely different than the version who loses their job in month 4 — and you have no idea, going in, which version you'll actually be.

Financial Twin doesn't pretend to know your future. It runs your decision through dozens of *possible* futures at once and shows you the whole spread — the lucky years, the rough ones, and everything in between — side by side with what would've happened if you'd done nothing at all.

No score. No verdict. No "you should." Just your decision, played out honestly, so you can decide for yourself whether the risk is one you're comfortable taking.

---

## What it actually does

- 📊 **Baseline vs. Decision, side by side.** Every simulation runs *with* and *without* your decision, using the same random luck for both — so what you're seeing is the actual effect of the decision, not just noise.
- 🎲 **Real randomness, not a smooth curve.** Job loss, medical expenses, rent spikes, windfalls, bonuses — each with its own realistic likelihood, compounding month over month. A bad month makes the next one riskier, just like real life.
- 🧵 **See individual years, not just averages.** Toggle past the summary band to watch dozens of individual simulated years thread through — including the rare disaster case and the rare lucky break.
- 📖 **Click into any year and read its story.** A plain-language narrative log of what happened, month by month — not a wall of statistics.
- 🔀 **Fork a scenario and ask "what if."** Found a bad year? Rewind to any month, tweak something — a bigger emergency fund, a different fallback order — and watch the rest of that same year play out differently.
- ⚙️ **Every assumption is yours to tune.** Job-loss odds, medical cost distributions, income volatility, your own debt payoff priorities — nothing is a locked black box.

---

## Tech stack

Built as a fully client-side app — no backend, no server, no data ever leaves your browser:

- **React 19** + **TypeScript**
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **Recharts** for the fan charts and drilldown visualizations
- **Lucide React** for icons

---

## Getting started

```bash
pnpm install
pnpm dev
```

That's it — open the local URL it gives you, fill in your numbers, and describe a decision.

To build for production:

```bash
pnpm build
pnpm preview
```

To run the test suite:

```bash
pnpm test
```

---

## A quick tour

1. **Fill in your snapshot** — income sources, debts, expenses, your emergency fund.
2. **Describe one decision** — a new loan, a job change, a new recurring expense, or a one-time purchase.
3. **Watch the chart** — a band of outcomes appears for both your current path and the path with your decision applied.
4. **Toggle "Show individual scenarios"** — see the individual threads, not just the summary.
5. **Click into any scenario** — read its story, and if you're curious, fork it and change something to see what would've happened instead.

---

## A note on what this is *not*

This isn't financial advice, and it doesn't pretend to predict your actual future — it's a simulation built on reasonable, editable assumptions, meant to help you *feel* a range of outcomes rather than anchor on a single guess. Treat it as a reality check, not a prophecy.

---

## License

MIT — see `LICENSE`.
