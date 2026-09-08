# MIG Design System — Native Mobile Reference

Portable style guide for reuse across other apps (Cursor/any codebase). Extracted from the MIG Stock native mobile redesign.

## Fonts
Load from Google Fonts: `Space+Grotesk:wght@600;700`, `Inter:wght@400;500;600;700`, `JetBrains+Mono:wght@500;600`

- **Display/headings** — `'Space Grotesk', sans-serif`, weight 700, letter-spacing -0.02em to -0.03em. Screen titles 20px, big numbers/greeting 26px, brand wordmark 22px.
- **Body/UI text** — `'Inter', sans-serif`, weights 400–700. Base 13–14px, secondary 11–12px, micro labels 9.5–10.5px.
- **Numbers/money/codes** — `'JetBrains Mono', monospace`, weight 500–600. Always use for currency, quantities, receipt numbers, timestamps in mono context.

## Color tokens

### Dark mode (default)
```
bg:            #09090b
card:          #18181b
border:        #27272a
text:          #F4F4F5
textSecondary: #A1A1AA
textTertiary:  #71717a
textFaint:     rgba(244,244,245,0.35)
chipText:      #D4D4D8
barBg:         rgba(9,9,11,0.96)
innerBg:       #09090b
dashedBorder:  #27272a
glow:          radial-gradient(circle at 50% -10%, rgba(201,122,43,0.16), transparent 55%)
cardShadow:    inset 0 1px 0 0 rgba(255,255,255,0.06), 0 1px 2px rgba(0,0,0,0.4)
```

### Light mode
```
bg:            #fafafa
card:          #ffffff
border:        rgba(15,23,42,0.08)
text:          #0f172a
textSecondary: #64748b
textTertiary:  #64748b
textFaint:     rgba(15,23,42,0.35)
chipText:      #334155
barBg:         rgba(255,255,255,0.96)
innerBg:       #f1f5f9
dashedBorder:  rgba(15,23,42,0.16)
cardShadow:    0 0 0 1px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.05), 0 8px 24px rgba(15,23,42,0.05)
```

### Brand accent (amber — same in both modes)
```
Primary gradient: linear-gradient(135deg, #E0A461 0%, #C97A2B 60%, #9C5D1E 100%)
Gradient text-on:  #1B1710 (near-black, used as text/icon color on the gradient)
Accent solid:      #C97A2B  (links, "See all", chart lines, active tab underline)
```

### Semantic colors
```
Success/green:  #5FB158  (bg tint rgba(95,177,88,0.14))   — positive %, paid status, discounts
Warning/amber:  #D9822B  (bg tint rgba(217,130,43,0.14))  — low stock, pending balance
Danger/red:     #E5564A  (bg tint rgba(229,86,74,0.14))   — out of stock, sign out, cancelled
```

Never invent new hues — derive tints via `rgba()` of these same base colors at 0.08–0.16 opacity for badges/icon backgrounds.

## Spacing & radius scale
- Screen padding: 20–26px horizontal
- Card/row radius: 14–16px; large hero cards 20px; sheets 22–26px (top corners only); pills/chips 10–12px; avatars/icon tiles 8–16px depending on size; fully round for badges/dots
- Gaps: 6–10px between related items, 16–20px between sections
- Card border: always `1px solid {border token}` — never borderless cards on dark bg

## Component patterns

**Chips (filter/selector rows)** — pill buttons, 9px vertical / 15px horizontal padding, 12px radius, 12.5px font-weight 600. Unselected: `card` bg + `border` outline + `chipText` color. Selected: brand gradient bg + `#1B1710` text. Wrap (`flex-wrap:wrap`) when the set can grow past ~4 items rather than horizontal-scrolling — scroll only for short, bounded rows (e.g. date-range presets).

**Cards** — `card` bg, `1px solid border`, radius 14–20px, optional `cardShadow` token for elevation (hero/stat cards only — list rows stay flat).

**List rows** — full-width flex row, space-between, `card` bg + `border`, 13px padding, 14px radius, trailing chevron icon (`textTertiary` stroke) for drill-down navigation.

**Bottom sheets** (modals) — slide up from bottom, `card` bg, 22px top radius only, drag handle bar (36×4px, `border` color, centered), backdrop `rgba(0,0,0,0.5)` fade-in. Use for menus, pickers, receipts — never full-screen modals.

**Bottom tab bar** — 5 icons max, `barBg` (translucent + blur feel), `1px solid border` top edge, active tab = accent stroke + 2px accent underline dot; inactive = `textSecondary` stroke, weight 500 label.

**Buttons (primary/CTA)** — brand gradient bg, `#1B1710` text, 12–14px radius, inset highlight (`inset 0 1px 0 rgba(255,255,255,0.25)`) + soft amber glow shadow. Disabled state: flat `border`-color bg, `textTertiary` text, no shadow.

**Inputs** — `card` bg (or `innerBg` for nested/settings contexts), `1px solid border`, 12px radius, 13–14px padding, `text` color, no focus ring styling beyond browser default.

**Icons** — custom line icons only (stroke-based SVG, 1.8–2px stroke, round caps/joins), never a filled icon font or brand-name icon library. Default stroke color `textSecondary`; active/selected state switches to accent or `text`.

**Status badges** — pill shape, uppercase, 10–11px bold, tinted bg (10-14% opacity of the semantic color) + solid semantic-color text.

## Motion
```
sheetUp:    translateY(100%) → 0, 0.28–0.32s cubic-bezier(0.22,1,0.36,1)
backdropIn: opacity 0 → 1, 0.2–0.25s ease
fadeUp:     opacity 0 + translateY(8px) → opacity 1 + translateY(0), 0.35s ease  — apply to each screen's root on mount
active state: scale(0.96) on tap for primary action buttons
```

## Layout principles
1. Native patterns over web dialogs: chip pickers, bottom sheets, drill-down lists — never MUI-style modal dialogs or dropdown `<select>`.
2. Progressive disclosure: reveal the next choice only once the prior one is made (Product → Type → Size), each appearing with `fadeUp`.
3. Max 1–2 accent colors (amber gradient + semantic red/green/amber) — no rainbow palettes.
4. Dark mode is the default/primary; light mode is a faithful token swap, not a redesign.
5. Grids wrap instead of scrolling once item count is unbounded (e.g. type chips, size grid at 4 columns).

## How to apply to a new app
1. Copy the color tokens and font stack verbatim into your theme file.
2. Rebuild pickers/dialogs as chips or bottom sheets per the patterns above.
3. Reuse the exact button/card/chip inline-style formulas (radius, padding, shadow) for visual consistency.
4. Keep icons as custom stroke SVGs matching the stroke-width/cap conventions above.
