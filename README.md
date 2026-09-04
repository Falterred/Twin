# 💰 Twin: Financial Decision Optimizer

> **Smart financial decisions, powered by mathematics—not guesswork.**

Twin is a **complete financial decision optimizer** that evaluates major purchase strategies across deterministic, probabilistic, and stress-test scenarios. It tells you whether to **buy now, finance through EMI, wait and invest, or go refurbished**—based on your real cash flow, debt, emergency fund, and risk tolerance.

---

## 🚀 Quick Start (2 Minutes)

### 1️⃣ **Install**
```bash
git clone https://github.com/Falterred/Twin.git
cd Twin
npm install
```

### 2️⃣ **Run Locally**
```bash
npm run dev
```
Your browser will open to **http://localhost:5173** automatically. 

### 3️⃣ **Start Using**
- **Adjust your financial inputs** using the left-side sliders (liquid cash, income, expenses, item price, etc.).
- **View the recommendation** in the ranked action list on the right—sorted by financial safety and opportunity cost.
- **Toggle between Deterministic and Probabilistic modes** to see single-scenario vs. 300 Monte Carlo futures.
- **Calibrate your risk profile** using the 3-question wizard (top-right button).

---

## 📋 Feature Overview

### Six Financial Strategies Evaluated
1. **Buy Now** — Pay the full price immediately.
2. **EMI/Loan** — Monthly installments over 12 months (or custom tenure).
3. **Wait 3 Months** — Delay and invest surplus income.
4. **Buy Cheaper Model** — 30% discount alternative.
5. **Buy Refurbished** — Certified refurbished at 45% discount.
6. **Invest & Delay** — Invest savings until compound growth funds the purchase.

### Engine Capabilities
- ✅ **Deterministic Simulation**: Exact 12-month cash flow for each strategy.
- ✅ **Probabilistic Analysis**: 300 Monte Carlo runs per strategy, showing p10–p50–p90 ranges.
- ✅ **Stress Testing**: Simulates month-2 income loss + unexpected ₹15,000 expense.
- ✅ **Counterfactual Search**: Automatically finds "what if" adjustments that flip the recommendation.
- ✅ **Safety Constraints**: Disqualifies strategies that breach emergency-fund or debt-to-income limits.
- ✅ **Smart Scoring**: Balances safety, opportunity cost, delay cost, debt burden, and immediate utility.

---

## 📖 How to Use (Step-by-Step)

### **Step 1: Set Your Financial Situation**
**Left Panel → "Cash & Income" Section**
- **Liquid Cash**: How much emergency money do you have right now?
- **Monthly Income**: Your average monthly take-home pay.
- **Monthly Expenses**: Rent, food, bills, etc.
- **Existing EMI**: Any active loan payments (car, credit card, etc.).

### **Step 2: Define the Purchase**
**Left Panel → "Purchase & Loan" Section**
- **Item Price**: The full price of what you want to buy.
- **Emergency Buffer**: How many months of expenses you want saved (6 months recommended).
- **EMI Tenure**: How long (in months) would you stretch a loan? 12 months is common.
- **EMI Interest Rate**: Annual interest rate (typical: 12–14% for personal loans).

### **Step 3: Set Your Priorities**
**Left Panel → "Preferences" Section (Collapsed by default)**
- **Purchase Urgency**: Do you need it now, can wait a few months, or is it flexible?
- **Income Stability**: Is your income predictable (salaried) or variable (freelance)?

### **Step 4: Calibrate Your Risk Profile**
**Top-Right Button ("Conservative" / "Balanced" / "Aggressive")**
- Click to open a 3-question wizard.
- Choose answers that match your comfort with debt, emergency buffers, and investment risk.
- Your profile adjusts the scoring weights toward safety or growth.

### **Step 5: Compare the Results**
**Right Panel → Chart & Action List**
- **Chart**: See the 12-month cash flow for each strategy. Deterministic mode = solid lines. Probabilistic mode = shaded bands.
- **Ranked Cards**: The top strategy is marked "OPTIMAL". Each card shows:
  - Your action's rank
  - Safety score
  - Whether it survives the stress shock
  - Score breakdown across five factors

### **Step 6: Check the Counterfactual**
**Right Panel → "What-If Insight" Card**
- This tells you the smallest tweak to your inputs that would flip the recommendation.
- E.g., "*If your liquid savings were ₹50,000 higher, EMI would overtake Buy Now.*"

### **Step 7: Toggle Probabilistic Mode**
**Top-Right of the Chart**
- **Deterministic**: Shows a single expected path (fixed income/expenses).
- **Probabilistic**: Runs 300 random scenarios, showing the range of possible outcomes.
- Compare to see how sensitive your recommendation is to market uncertainty.

---

## 🎨 Visual Guide

```
┌────────────────────────────────────────────────────────────────────┐
│  Twin Financial Decision Optimizer  [Risk Profile ▼] [🌙]          │
└────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐   ┌─────────────────────────────────────────┐
│  Input Controls      │   │  Chart & Results                        │
│  ───────────────────│   │  ────────────────────────────────────────│
│  💰 Cash & Income   │   │  📈 12-Month Projection                 │
│    • Liquid: ₹150k  │   │     [Deterministic | Probabilistic]      │
│    • Income: ₹80k   │   │     [Shaded bands for p10/p90]          │
│    • Expenses: ₹40k │   │                                          │
│                      │   │  🎯 Ranked Strategies                   │
│  🛒 Purchase & Loan  │   │     #1 EMI          ████████░░ 80%     │
│    • Item: ₹60k      │   │     #2 Invest+Delay ███░░░░░░ 30%      │
│    • Buffer: 6 mo    │   │     #3 Wait 3M      ██░░░░░░░ 20%      │
│    • Tenure: 12 mo   │   │     ❌ Buy Now      (Unsafe)            │
│                      │   │                                          │
│  📊 Preferences      │   │  💡 What-If Insight                     │
│    (Collapsed)       │   │     "If cash were 50k higher..."        │
│                      │   │                                          │
└──────────────────────┘   └─────────────────────────────────────────┘
```

---

## 🔧 Running Tests

```bash
# Run all 95 engine verification tests
npm test

# Build for production
npm run build

# Check code quality
npm run lint

# Preview the production build locally
npm run preview
```

Expected output:
```
✅ 95 assertions passed
✅ TypeScript: 0 errors
✅ Build: dist/ folder ready
✅ Lint: No issues
```

---

## 🚀 Deploy to the Web

### Option A: Vercel (Recommended)
```bash
npm run build
# Then push to GitHub and connect via https://vercel.com
```

### Option B: Netlify
```bash
npm run build
# Drag-and-drop the `dist/` folder to https://app.netlify.com/drop
```

### Option C: GitHub Pages
```bash
npm run build
# Push dist/ to gh-pages branch or enable Pages in repo settings
```

### Option D: Docker / Cloud
The static `dist/` folder can be deployed to any cloud provider (AWS S3, Google Cloud, Heroku, etc.).

---

## 🔒 Privacy & Security

✅ **100% Client-Side**: No servers, no data uploads.  
✅ **No Tracking**: No analytics, cookies, or telemetry.  
✅ **Open Source**: Full code available for audit.  
✅ **Offline-Ready**: Works without internet after first load.

Your financial data **never leaves your browser**. Close the tab, and it's gone.

---

## 🏗️ Architecture

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Engine** | TypeScript (src/engine/) | Pure math: simulations, scoring, stress tests, counterfactuals |
| **UI** | React 19 + Tailwind + Recharts | Interactive dashboard with real-time updates |
| **State** | React hooks + useMemo | Unidirectional data flow, 120ms input debounce |
| **Build** | Vite + TypeScript | Fast dev server, optimized production bundle |
| **Tests** | tsx harness | 95 assertions covering all engine parts |
| **CI** | GitHub Actions | Auto-lint, test, and build on every push |

---

## 🐛 Troubleshooting

### **"I don't see probabilistic bands in Probabilistic mode"**
- Hard refresh your browser: **Ctrl+F5** (Windows) or **Cmd+Shift+R** (Mac).
- The dev server may not have picked up the latest code.

### **"The app feels slow when I drag sliders"**
- Sliders are intentionally debounced 120ms to batch updates.
- This prevents re-running 300 Monte Carlo simulations on every pixel of movement.

### **"Buy Now is never recommended, always Refurbished"**
- The scoring model favors **lower capital usage** when strategies have equal urgency.
- Refurbished uses 55% of the price; Buy Now uses 100%.
- To favor Buy Now: increase urgency to "urgent", increase liquid cash, or reduce emergency-fund months.

### **"I'm getting error messages"**
- All error messages are **intentionally friendly** (not technical jargon).
- Common causes:
  - Negative financial values (all should be ≥ 0)
  - EMI tenure must be a whole number
  - Item price cannot be 0

### **"The page doesn't load"**
- Ensure Node.js 20+ is installed: `node --version`
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check that port 5173 isn't already in use

---

## 📚 Version History

| Version | Release Date | Highlights |
|---------|-------------|-----------|
| v0.1.0 | 2026-03 | Parts 1–5: Foundation + Monte Carlo |
| v0.2.0 | 2026-04 | Hardened stress tests |
| v0.3.0 | 2026-08 | Part 6: Counterfactual search |
| v0.3.1 | 2026-09 | Error handling improvements |
| **v0.4.0** | **2026-09** | **Parts 1–8: Complete, Accessible, Ready** |

---

## 📝 Post-v0.4.0 Roadmap

- [ ] Browser E2E tests (Playwright)
- [ ] Multi-year life-event simulation
- [ ] Job-loss and salary-change event chains
- [ ] LLM-powered natural-language explanations
- [ ] Persistent data storage (optional)
- [ ] Mobile app (React Native)
- [ ] Compare multiple users' scenarios

---

## 🤝 Contributing

Found a bug or have a feature request?  
1. Open an issue at https://github.com/Falterred/Twin/issues
2. Describe the behavior and expected result
3. Include your browser and OS version

---

## 📄 License

MIT License. See LICENSE file for details.

---

## 💡 Questions?

- **"How accurate is this?"** → Twin uses standard financial-math formulas. Results are illustrative, not professional financial advice.
- **"Can I export my scenario?"** → Not yet, but it's a post-v0.4.0 feature.
- **"Does it support international currencies?"** → Currently uses Indian Rupees (₹). Multi-currency support is a future feature.
- **"What if my income varies month-to-month?"** → Use the Probabilistic mode—it samples income variance automatically based on stability settings.

---

**Built with ❤️ for smarter financial decisions.**  
**[Open Twin →](https://falterred.github.io/Twin)** (when deployed)
