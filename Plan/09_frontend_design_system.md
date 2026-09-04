# Part 9: Frontend Design System & Theme Support

## 1. Design Philosophy & Aesthetic Guidelines
- **Ultra-Premium Fintech Aesthetic**: The UI must feel like a modern, high-precision financial terminal (inspired by Stripe, Linear, and Bloomberg terminals).
- **Data Clarity & Visual Hierarchy**: Visual distinction between primary metrics (Liquid Cash, Emergency Fund Buffer, Normalized Utility Scores, and Percentile Bands) using clear typography, soft backdrop blurs, and distinct color codes.
- **Theme Support (Dark/Light)**: Seamless switching between a crisp, vibrant Light mode and a high-contrast, sleek Dark mode using Tailwind CSS.
- **Micro-Interactions & Animations**: Responsive hover effects, smooth color transitions, and animated chart re-draws when adjusting sliders.

## 2. Color Tokens & Semantic Palettes

### Base Background & Card Tokens
| Token / Element | Light Mode | Dark Mode | CSS / Tailwind Utility |
| :--- | :--- | :--- | :--- |
| **App Background** | `#f8fafc` | `#020617` | `bg-slate-50 dark:bg-slate-950` |
| **Card / Surface (Glass)** | `rgba(255, 255, 255, 0.85)` | `rgba(15, 23, 42, 0.80)` | `bg-white/85 dark:bg-slate-900/80 backdrop-blur-md` |
| **Card Border** | `#e2e8f0` | `#1e293b` | `border-slate-200 dark:border-slate-800` |
| **Text Primary** | `#0f172a` | `#f8fafc` | `text-slate-900 dark:text-slate-50` |
| **Text Muted / Subtitle** | `#64748b` | `#94a3b8` | `text-slate-500 dark:text-slate-400` |
| **Card Hover Effect** | `shadow-lg border-blue-400/50` | `shadow-2xl shadow-blue-500/10 border-blue-500/40` | `transition-all duration-200` |

### Action Semantic Colors (Consistent Across Modes)
Defined to match the mathematical engine color conventions:
- **Buy Now (`buy_now`)**: Electric Blue (`#2563eb` / `bg-blue-600` / `border-blue-500`)
- **EMI / Loan (`emi`)**: Royal Violet (`#8b5cf6` / `bg-violet-500` / `border-violet-500`)
- **Wait 3 Months (`wait_3m`)**: Warm Amber (`#f59e0b` / `bg-amber-500` / `border-amber-500`)
- **Buy Cheaper (`cheaper`)**: Emerald Green (`#10b981` / `bg-emerald-500` / `border-emerald-500`)
- **Buy Refurbished (`refurb`)**: Magenta Pink (`#ec4899` / `bg-pink-500` / `border-pink-500`)
- **Invest + Delay (`invest_delay`)**: Cyan Teal (`#06b6d4` / `bg-cyan-500` / `border-cyan-500`)

### Status Badges
- **Recommended (Rank #1)**: Gold/Emerald gradient glow (`from-amber-400 to-emerald-500`)
- **Disqualified Action**: Slate muted opacity with Crimson warning tag (`text-rose-500 bg-rose-500/10 border-rose-500/20`)
- **Stress-Test Shock Failed**: Amber shield caution badge (`text-amber-500 bg-amber-500/10 border-amber-500/30`)

## 3. Typography & Layout Specifications
- **Font Family**: Inter, Outfit, or standard modern Sans-serif (`font-sans tracking-tight`)
- **App Layout Grid**:
  - **Header / Nav**: Sticky top bar with App Brand (`Twin Financial Engine`), Calibration Button, and Dark/Light Mode Toggle.
  - **Left / Control Column (Width: 380px - 420px)**: `<ConstraintPanel>` with organized slider groups (Income & Cash, Purchase & EMI, Expense Ratios) and Select Dropdowns (`urgency`, `incomeStability`).
  - **Right / Visualization Column (Flex 1)**:
    - Top: `<ModeToggle>` (Deterministic 12M Line View vs Probabilistic Monte Carlo 300-Run 10th-90th Percentile Band View).
    - Middle: `<TimelineChart>` (Interactive Recharts `ComposedChart` with custom tooltip formatted in INR currency `₹`).
    - Bottom: `<CounterfactualNote>` (Dynamic algorithmic "What-if" advice pill).
    - Bottom Grid: `<RankedActionList>` (6 Interactive Decision Cards with score progress breakdowns, shock survivability, and status tags).

## 4. Relationship between Part 7 and Part 9

| Attribute | Part 7: UI Components (`07_ui_components.md`) | Part 9: Design System (`09_frontend_design_system.md`) |
| :--- | :--- | :--- |
| **Focus** | Component Contracts, Props, and React structure | Visual Tokens, Styling, Theme Switcher, and Glassmorphic aesthetics |
| **What it specifies** | `<CalibrationModal>`, `<ConstraintPanel>`, `<ModeToggle>`, `<TimelineChart>`, `<RankedActionList>`, `<CounterfactualNote>` props & events | Tailwind color classes, dark/light token matrix, glassmorphism, responsive breakpoints, and animations |
| **Role in Build** | "What components exist and what data they receive" | "How components look, animate, and adapt to themes" |

## 5. Verification & Aesthetics Checklist
1. **Light / Dark Mode Switcher**: Toggling dark mode seamlessly inverts colors without layout shift or chart flash.
2. **Chart Responsiveness**: Recharts `<ResponsiveContainer>` cleanly resizes on window resizing.
3. **Currency Formatting**: All rupee values rendered using Indian number formatting standard (`₹1,50,000`).
4. **Disqualification Visualization**: Disqualified actions have clear, unambiguous visual reasons (e.g., `"Liquid cash drops below ₹0 at month 1"`).
