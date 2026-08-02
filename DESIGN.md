# Spark v3 — Design Specification

## App Overview
Mobile-first PWA idea-capture app called "Spark" (⚡).
Single user, offline-first, localStorage persistence.
5 screens: Overview / Ideas / Journey / Profile + Quick Capture modal.

---

## DESIGN DIRECTION — Apple-inspired, ultra-clean dark mode

### PHILOSOPHY
- Think iPhone Settings app meets Linear.app
- Every element must earn its place — no decoration for decoration's sake
- "Quiet luxury" dark theme: deep blacks, not harsh
- SF Pro-style typography (use Inter font)
- Generous whitespace, tight hierarchy

---

## COLOR PALETTE

```
Background:    #07070f   (deepest layer)
Surface:       #0f0f1c   (cards, sheets)
Elevated:      #161627   (headers, modals)
Border:        rgba(255,255,255,0.07)  — hairline only
Accent:        #6366f1   (indigo — primary, used sparingly)
Text primary:  #f8f8ff
Text secondary:#6b7280
Text dim:      #374151

Stage colors:
  ⚡ Spark:   #f59e0b  (amber)
  📋 Outline: #3b82f6  (blue)
  🛠️ Demo:   #8b5cf6  (violet)
  ✅ Shipped: #10b981  (green)
  📦 Archive: #374151  (dim)
```

---

## TYPOGRAPHY

```
Font: Inter (Google Fonts) — weights 400, 500, 600, 700, 800

H1:    28px / weight 700 / letter-spacing -0.5px
H2:    20px / weight 600
Body:  15px / weight 450 / line-height 1.6
Label: 11px / weight 600 / UPPERCASE / letter-spacing 0.8px

Rule: Use weight + color for hierarchy, NOT bold everywhere.
```

---

## ICONS

- Use Lucide icons (SVG line-only, stroke-width: 1.5px)
- Size: 20px for nav, 16px for inline actions
- NO emoji as icons — pure SVG line icons only
- Color: #6b7280 (dim) by default
- Hover: 200ms transition → color #f8f8ff + scale(1.05)
- Active nav icon: #6366f1 + 4px dot indicator below

---

## BOTTOM NAVIGATION

```
5 tabs: [Overview] [Ideas] [⊕ FAB] [Journey] [Profile]

Height: 64px + env(safe-area-inset-bottom)
Background: rgba(7,7,15,0.92) + backdrop-filter: blur(24px)
Border-top: 1px solid rgba(255,255,255,0.06)

Tab item:
  - Icon only (NO text labels — Apple style)
  - Inactive: icon #6b7280
  - Active: icon #6366f1 + 4px rounded dot below
  - Hover: icon #f8f8ff, 200ms ease

Center FAB (+):
  - Size: 48×48px, border-radius: 14px
  - Background: linear-gradient(135deg, #6366f1, #4f46e5)
  - Box-shadow: 0 4px 20px rgba(99,102,241,0.35)
  - Icon: plus, white, 22px
```

---

## SCREENS

### 1. OVERVIEW (Übersicht — Home)

```
┌─────────────────────────────────────┐
│  Good evening ⚡           [avatar] │
│  Monday, 30 June                    │
├─────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────┐ │
│  │    15    │ │     3    │ │ 🔥 7 │ │
│  │  IDEAS   │ │ PROJECTS │ │STREAK│ │
│  └──────────┘ └──────────┘ └──────┘ │
├─────────────────────────────────────┤
│  PIPELINE                           │
│  ⚡ Spark   ━━━━━━━░░░  5           │
│  📋 Outline ━━━░░░░░░░  3           │
│  🛠️ Demo   ━━░░░░░░░░  2           │
│  ✅ Shipped ━━━━░░░░░░  4           │
├─────────────────────────────────────┤
│  RECENT ACTIVITY                    │
│  · Added "App idea for..."  2h ago  │
│  · Moved "X" → Demo         1d ago  │
└─────────────────────────────────────┘
```

Stats bento boxes: #161627 bg, border-radius 14px, centered content
Pipeline rows: stage icon + name + thin progress bar (4px) + count
Bars animate from 0 on mount (600ms ease-out)
Numbers count-up animate on mount

---

### 2. IDEAS LIST

Header:
  - Title "Ideas" left, count badge right
  - View toggle: list / compact / grid (3 small icon buttons)
  - Stage filter chips: scrollable horizontal row

Idea Card (List view):
```
┌──────────────────────────────────────┐
│▌ [stage color left bar]              │
│  App for tracking coffee habits      │
│  ─────────────────────────────────  │
│  ⚡ Spark   #productivity   2h ago   │
└──────────────────────────────────────┘
```
  - Background: #0f0f1c
  - Border: 1px solid rgba(255,255,255,0.07)
  - Border-radius: 16px
  - Left accent bar: 3px, colored by stage
  - Hover: border rgba(255,255,255,0.14), translateY(-1px), 200ms
  - Active: scale(0.98), 100ms

Compact view: single line per idea, stage pill right-aligned
Grid view: 2-col, square-ish cards with emoji/color gradient top

Swipe gestures:
  - Swipe right → advance stage (with confetti micro-animation)
  - Swipe left → archive
  - Long press → context menu (blur backdrop + options sheet)

---

### 3. QUICK CAPTURE MODAL (center FAB)

Bottom sheet, slides up:
  - Large textarea, placeholder "What's sparking?"
  - Voice input button (mic icon, inline right)
  - Stage selector: horizontal pills (⚡📋🛠️✅)
  - Tag input: inline chip input
  - Save button: full-width indigo gradient

---

### 4. JOURNEY (Projects)

Each project card:
  - Cover image OR gradient + emoji (auto-generated)
  - Title + status badge
  - Progress bar: Idea → Planning → Building → Shipped (4 steps)
  - Last updated date

Project Detail:
  - Hero image/gradient (full width)
  - Milestones checklist
  - Update log (journal entries with dates)
  - Reactions + Comments section
  - Links section

---

### 5. PROFILE

```
┌─────────────────────────────────────┐
│         😎  Linh                    │
│    Member since June 2026           │
├─────────────────────────────────────┤
│  ┌──────┐ ┌──────┐ ┌──────┐         │
│  │  15  │ │   3  │ │ 🔥7  │         │
│  │Ideas │ │Proj. │ │Streak│         │
│  └──────┘ └──────┘ └──────┘         │
├─────────────────────────────────────┤
│  ACHIEVEMENTS                       │
│  🌱 First Idea   ⚡ Power User       │
│  🚀 First Ship   📦 10 Ideas         │
├─────────────────────────────────────┤
│  SETTINGS                           │
│  Edit name & emoji          ›       │
│  Export data                ›       │
│  Clear all data           🗑️  ›     │
└─────────────────────────────────────┘
```

---

## MODALS / SHEETS (Apple Maps style)

```
Handle: 36px wide, 4px tall, rgba(255,255,255,0.15), centered top
Background: #0f0f1c
Top corners: 20px radius
Header: 56px, title centered, X button right (24px circle bg)
Body: 20px padding, scrollable
```

---

## INPUTS & FORMS

```
Background: rgba(255,255,255,0.05)
Border: 1px solid rgba(255,255,255,0.08)
Border-radius: 12px
Padding: 14px 16px
Font-size: 16px (prevent iOS zoom)
Focus: border #6366f1, box-shadow 0 0 0 3px rgba(99,102,241,0.15)
Placeholder: #374151
```

---

## BUTTONS

```
Primary:     gradient(#6366f1 → #4f46e5), h:50px, radius:12px, fw:600
Secondary:   rgba(255,255,255,0.07), same radius
Outline:     transparent bg, border rgba(255,255,255,0.15)
Destructive: rgba(239,68,68,0.1) bg, red border + text

All: active → scale(0.97), 100ms
NO box-shadows — flat & clean
```

---

## MICRO-ANIMATIONS

```
View transition:       fade 200ms
Cards entering feed:   stagger fadeUp (translateY 12px→0, opacity 0→1, 50ms delay each)
Stats numbers:         count-up on Overview mount
Pipeline bars:         width 0→value, 600ms ease-out, stagger 100ms each
Stage advance:         confetti burst (tiny colored particles)
Toast:                 slide up, auto-dismiss 2.5s
FAB press:             scale(0.92) + glow pulse
```

---

## WHAT TO REMOVE

- ❌ Board/community tab → replaced by Overview
- ❌ Settings tab → merged into Profile
- ❌ Emoji used as navigation icons
- ❌ Heavy box-shadows and glassmorphism blur on cards
- ❌ Color picker in capture (simplify: auto-color from stage)
- ❌ Vote/claim/community features

---

## DATA STRUCTURE (keep intact)

```javascript
// DB object in data.js — DO NOT CHANGE
// Keys used: spark_ideas, spark_projects, spark_comments, spark_reactions, spark_user

// Idea object:
{
  id: string,
  content: string,
  tags: string[],
  stage: 'spark' | 'outline' | 'demo' | 'shipped' | 'archived',
  isPinned: boolean,
  color: string | null,
  createdAt: number,
  updatedAt: number,
  stageHistory: { stage, note, author, ts }[]
}

// Project object:
{
  id: string,
  name: string,
  description: string,
  status: 'concept' | 'in_progress' | 'completed' | 'on_hold',
  tags: string[],
  cover: base64 | null,
  gallery: base64[],
  link: string,
  sourceIdeaId: string | null,
  createdAt: number
}
```

---

## TECH STACK

- Vanilla HTML5 + CSS3 + JavaScript (ES6+)
- No frameworks, no build tools
- Google Fonts: Inter
- Lucide Icons: via CDN `<script src="https://unpkg.com/lucide@latest"></script>`
- PWA: manifest.json + service worker (sw.js)
- Storage: localStorage only

---

*Output: Complete index.html + css/app.css + js/app.js files, preserving all DB/data logic.*
