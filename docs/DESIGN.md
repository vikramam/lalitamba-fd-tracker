# Lalitamba FD Gadag — Visual Design

Product name: **Lalitamba FD Gadag**.

Direction: the **MIG Design System** applied to this family ledger. Dark is the default. Light is the same layout with swapped tokens. See [design-system.md](./design-system.md) for the portable source spec.

---

## Fonts

Loaded from Google Fonts.

| Role | Family | Use |
| --- | --- | --- |
| Display / headings | Space Grotesk 600–700 | Screen titles 20px, greeting and hero amounts 26px, wordmark 22px. Tracking −0.02em. |
| Body / UI | Inter 400–700 | Base 13–14px, secondary 11–12px, micro labels 9.5–10.5px uppercase. |
| Numbers / codes | JetBrains Mono 500–600 | Currency, CID, FD-A/c, dates in tables, file names. |

---

## Color

Dark tokens live on `:root`. Light tokens live on `html.light`. Settings writes `lalitamba.theme` and toggles that class.

| Token | Dark | Light | Use |
| --- | --- | --- | --- |
| `bg` | `#09090b` | `#fafafa` | Page |
| `card` | `#18181b` | `#ffffff` | Cards, inputs, list rows |
| `border` | `#27272a` | `rgba(15,23,42,0.08)` | 1px card and input edges |
| `text` | `#F4F4F5` | `#0f172a` | Primary type |
| `textSecondary` | `#A1A1AA` | `#64748b` | Helper copy, inactive tabs |
| `textTertiary` | `#71717a` | `#64748b` | Chevrons, disabled |
| Accent | `#C97A2B` | same | Links, active tab underline |
| Brand gradient | `135deg #E0A461 → #C97A2B 60% → #9C5D1E` | same | Primary buttons, selected chips |
| Text on gradient | `#1B1710` | same | Button and selected-chip type |
| Success | `#5FB158` | same | Active status, From receipt confirmed |
| Warning | `#D9822B` | same | Due soon, Check this |
| Danger | `#E5564A` | same | Past due, premature, sign out |

Do not invent extra hues. Badge backgrounds are `rgba()` of these colors at ~14% opacity.

---

## Patterns in this app

- **Hero card** — dashboard principal and FD detail amount. 20px radius, inset highlight + amber glow.
- **Surface card** — settings blocks, receipt picker, field lists. 16px radius, 1px border, no extra shadow.
- **List rows** — card + chevron. Members show an initials tile. Renewed and closed rows dim.
- **Chips** — Dark / Light, member, interest mode, status, family. Selected = gradient. Sets wrap.
- **Primary button** — brand gradient, inset highlight, tap `scale(0.96)`. Disabled is flat border fill.
- **OCR badges** — From receipt (muted), Corrected (success), Check this (warning).
- **Tab bar** — translucent `barBg` + blur, accent underline on the active item. Desktop uses a text rail.
- **Motion** — `page-enter` fade-up on each screen.

No dropdown `<select>`. No icon fonts. No second brand color.

---

## Screens

Login, Home, Members, FDs, Add / Edit / Renew, Close, FD detail, receipt viewer, Settings. Empty, loading, and error states stay short typographic copy.

Phone first. Desktop is the same language with a 208px rail.

---

## Implementation

Tokens and utilities live in `src/index.css`. Theme helpers in `src/lib/theme.ts`. Stroke icons in `src/components/icons.tsx`. Chips, list rows, and badges are shared components.

Rupee format remains `₹1,00,000`. One society only — no bank picker.
