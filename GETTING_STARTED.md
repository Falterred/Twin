# 🚀 Getting Started with Twin

Welcome! This guide walks you through using Twin for the first time, from setup to making your first financial decision.

---

## 📥 Installation (5 minutes)

### Prerequisites
- **Node.js 20+** (check with `node --version`)
- **npm** (comes with Node)
- A modern web browser (Chrome, Firefox, Safari, Edge)

### Install & Launch
```bash
git clone https://github.com/Falterred/Twin.git
cd Twin
npm install
npm run dev
```

Your browser opens automatically to **http://localhost:5173**. You're ready to go!

---

## 🎯 Your First Analysis (10 minutes)

### Scenario: Should you buy a laptop now or wait?

**Step 1: Enter Your Financial Situation**

Left panel → **"Cash & Income"** section:
- **Liquid Cash**: How much do you have in savings? (e.g., ₹150,000)
- **Monthly Income**: Your net pay. (e.g., ₹80,000)
- **Monthly Expenses**: Rent + food + bills + essentials. (e.g., ₹40,000)
- **Existing EMI**: Any active loans. (e.g., ₹0)

💡 **Pro Tip**: Be realistic about expenses—include things you often forget (insurance, subscriptions, transportation).

**Step 2: Define the Laptop Purchase**

Left panel → **"Purchase & Loan"** section:
- **Item Price**: The laptop you want. (e.g., ₹80,000 for a mid-range laptop)
- **Emergency Buffer**: How many months of expenses you want always saved. (Recommended: 6 months)
- **EMI Tenure**: If you finance, how many months? (Default: 12)
- **EMI Interest Rate**: Annual rate offered by the bank. (Typical: 12–14%)

✨ **Key Point**: Emergency buffer is crucial! It keeps you safe if income drops unexpectedly.

**Step 3: Reveal Your Recommendation**

Look at the **right panel**:
- The **ranked list** shows your six options sorted by smartness.
- **#1 OPTIMAL** is highlighted—this is the best choice for your situation.
- **Score %** shows how "safe and efficient" each option is.
- **Shock Safe** or **Shock Risk** indicates if the strategy survives a sudden crisis.

### Example Output

```
#1 EMI                    ████████░░ 80%  ✅ Shock Safe
   → Why it wins: Spreads cost over 12 months; preserves emergency fund

#2 Invest & Delay         ███░░░░░░░ 30%  ⚠️ Shock Risk  
   → Good alternative, but riskier to emergency buffer

❌ Buy Now                (Unsafe)
   → Why skipped: Would reduce emergency fund below 6 months

❌ Buy Refurbished        (Unsafe)
   → Why skipped: Same issue as Buy Now
```

---

## 🔧 Understanding the Results

### The Ranking System

Twin scores each strategy across five factors:

| Factor | What It Means | Goal |
|--------|--------------|------|
| **Safety Buffer** 🛡️ | How much cushion you keep after the purchase | Higher = safer |
| **Opportunity Cost** 📈 | Money you could invest elsewhere | Lower is better |
| **Delay Cost** ⏱️ | The cost of waiting (prices go up, needs change) | Lower is better |
| **Debt Burden** 💳 | How much EMI impacts your monthly budget | Lower is better |
| **Utility Value** ⚡ | Immediate satisfaction of owning now vs. later | Context-dependent |

**How Twin Scores**:
- All factors are normalized to 0–100%
- Your **risk profile** adjusts the weights (conservative = prioritizes safety)
- A "disqualified" strategy violates your constraints (e.g., drops emergency fund below target)

### The Shock Test

Every strategy is tested against a month-2 crisis:
- **Income loss**: Your income drops to 0 for one month
- **Unexpected expense**: An extra ₹15,000 pops up (car repair, medical bill, etc.)

If your strategy survives this shock → **✅ Shock Safe**  
If it would wipe out your emergency fund → **⚠️ Shock Risk**

---

## 💡 Using the Chart

### Deterministic Mode (Solid Lines)
Shows the most likely scenario:
- Exact 12-month cash flow for each strategy
- Assumes income/expenses stay constant
- Best for: Understanding the "expected case"

**Example**: 
- "If I buy now, I'll have ₹20k left by month 6"
- "If I wait 3 months, I'll have ₹35k left by month 6"

### Probabilistic Mode (Shaded Bands)
Runs 300 random scenarios:
- **Shaded area** = the p10–p90 range (90% of possible outcomes)
- **Middle line** = median (p50, most likely)
- Best for: Understanding **uncertainty & risk**

**Example**: 
- "EMI will likely leave me with ₹15k–₹40k by month 6, median ₹25k"
- "This shows EMI is stable even if income dips"

**Interpretation**:
- Narrow bands = low uncertainty (strategy is predictable)
- Wide bands = high uncertainty (more risk, but also opportunity)

---

## 🎯 Calibrating Your Risk Profile

### When to Calibrate

Your risk profile affects how Twin weighs factors:
- **Conservative**: Prioritizes keeping 6+ months of emergency savings
- **Balanced**: Balances safety with opportunity (recommended for most)
- **Aggressive**: Maximizes investment potential, accepts more risk

### How to Calibrate

Top-right button → Click your current profile → **3-question wizard**

**Question 1**: "How much debt makes you uncomfortable?"
- *Option A (Safe)* → Emergency buffer = 8 months
- *Option B (Balanced)* → Emergency buffer = 6 months
- *Option C (Risk-taking)* → Emergency buffer = 3 months

**Question 2**: "If income dropped 20%, could you adjust?"
- *Option A (Safe)* → Need immediate financial cushion
- *Option B (Balanced)* → Can adjust after 2–3 months
- *Option C (Risk-taking)* → Confident in adapting

**Question 3**: "How do you feel about investment upside?"
- *Option A (Safe)* → Prefer guaranteed outcomes
- *Option B (Balanced)* → Comfortable with some volatility
- *Option C (Risk-taking)* → Love optimizing for maximum returns

After answering, Twin shows your new profile and **recalculates instantly**.

---

## 🤔 Interpreting "What-If Insights"

At the bottom-right, you'll see: 

> 💡 **What-If Insight**: *If your liquid savings were ₹50,000 higher, EMI would remain #1.*

This tells you the **sensitivity** of the recommendation:
- Small "If" = recommendation is fragile (small changes flip it)
- Large "If" = recommendation is solid (you'd need big changes to flip it)

### Use Cases

**"I expect a bonus of ₹40,000 next month"**
- Check if it changes the recommendation
- Plan your purchase timing accordingly

**"I'm considering a side hustle"**
- Adjust income and see if it opens up new options

**"The laptop might be cheaper in 3 months"**
- Adjust item price and compare strategies

---

## 📊 Real-World Examples

### Example 1: Emergency vs. Opportunity

**Your Situation**:
- Liquid: ₹150k, Monthly Income: ₹80k, Expenses: ₹40k
- Emergency buffer: 6 months (₹240k)
- Laptop price: ₹80k

**Twin's Recommendation**: EMI (Rank #1)

**Why**: Buying now would drop your emergency fund from ₹150k to ₹70k (too low). EMI spreads the cost, keeping you safer.

**The Trade-off**: You pay interest (₹8–12k over 12 months), but you protect yourself.

---

### Example 2: Rich & Urgent

**Your Situation**:
- Liquid: ₹500k, Monthly Income: ₹100k, Expenses: ₹30k
- Emergency buffer: 6 months (₹180k)
- Laptop price: ₹80k

**Twin's Recommendation**: Buy Now (Rank #1)

**Why**: You have ₹500k saved. After buying (₹80k), you still have ₹420k—way above the ₹180k target. Buying now avoids interest and gives immediate value.

**The Trade-off**: None! You're financially strong enough.

---

### Example 3: Uncertain Income

**Your Situation**:
- Liquid: ₹100k, Monthly Income: ₹60k (freelance), Expenses: ₹35k
- Emergency buffer: 8 months (₹280k—you're cautious)
- Income Stability: **Variable**

**Twin's Recommendation**: Invest & Delay (Rank #1)

**Why**: Your income varies. Twin suggests waiting 3+ months, building savings, and investing to generate returns while you save. This gives you a bigger buffer before the purchase.

**Probabilistic View**: The bands are wider (more uncertainty), but Invest & Delay handles it better.

---

## 🎓 Advanced Usage

### Testing Scenarios

**Scenario A: "What if I get a 20% raise?"**
1. Adjust **Monthly Income** +20%
2. Observe how rankings change
3. Note the "What-If Insight" delta

**Scenario B: "What if prices drop 15%?"**
1. Adjust **Item Price** -15%
2. See if it flips the recommendation
3. Use this to decide: should you wait for a sale?

**Scenario C: "I can only save ₹25k/month, not ₹80k/month"**
1. Adjust **Monthly Expenses** +₹10k (realistic living costs)
2. See how tight the budget becomes
3. Reconsider purchase urgency

### Toggling Modes

- **Stuck between two strategies?** Switch to **Probabilistic mode** to see uncertainty.
  - If bands overlap → Both are roughly equivalent
  - If bands diverge → One is clearly safer

- **Want to impress with numbers?** Use **Deterministic mode** for exact month-by-month breakdown.

---

## ❓ Frequently Asked Questions

**Q: Is Twin giving me financial advice?**  
A: No. Twin is a decision-support tool showing math-based comparisons. Always consult a financial advisor for personalized advice.

**Q: Why does Buy Now never win if I'm not very rich?**  
A: The model prioritizes emergency-fund safety. If buying drains your buffer, Twin disqualifies it. This is intentional—financial stability matters.

**Q: Can I save my scenario?**  
A: Not yet! It's a post-v0.4.0 feature. For now, take screenshots or write down the values.

**Q: What if my income changes monthly?**  
A: Use **Income Stability: Variable** in Preferences. Twin will model more volatility in Probabilistic mode.

**Q: Does Twin account for inflation?**  
A: For now, it uses 12-month static assumptions. Multi-year inflation modeling is a future feature.

---

## 🛠️ Tips & Tricks

### 1. Start Conservative, Then Adjust
- First run: Set emergency buffer to **8 months** (safest)
- Second run: Try **6 months** (standard)
- Third run: Try **4 months** (adventurous)
- Compare rankings to see risk levels

### 2. Use the Shock Test as a Filter
- If a top strategy fails the shock test, reconsider
- A "Shock Safe" strategy is more robust than "Shock Risk"

### 3. Check Sensitivity via "What-If"
- If the delta is small (< ₹20k), the recommendation is fragile
- If the delta is large (> ₹100k), the recommendation is solid

### 4. Dark Mode for Late-Night Browsing
- Click the 🌙 icon in the top-right to toggle dark mode
- Easier on your eyes while you research

### 5. Mobile-Friendly Design
- Twin works on phones! Try it on your mobile browser
- Useful for comparing options while shopping

---

## 🚀 Next Steps

1. **Run your first scenario**: Plug in your real numbers
2. **Check the chart**: Switch between Deterministic & Probabilistic
3. **Adjust your risk profile**: See how it changes rankings
4. **Test a "What-If"**: Imagine a bonus or salary change
5. **Make your decision**: Use Twin's insights + your gut + advisor feedback

---

## 📞 Need Help?

- **Report a bug**: https://github.com/Falterred/Twin/issues
- **Suggest a feature**: https://github.com/Falterred/Twin/issues/new
- **Want to contribute**: Pull requests welcome!

---

**Happy decision-making! 🎯**
