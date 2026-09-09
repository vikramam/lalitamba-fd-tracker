# Typography Scale

A consistent type scale used across a family of mobile-first PWAs (Investment
Tracker, MIG Stock). Apply this scale to keep visual weight/hierarchy
consistent with those apps.

## Fonts

| Role | Font | Notes |
|---|---|---|
| Headings / titles | **Space Grotesk** (700 weight, tight negative letter-spacing e.g. `-0.02em` to `-0.03em`) | Page titles, card names, hero numbers |
| Body / UI text | **Inter** | Everything else — labels, buttons, paragraphs |
| Numbers | **JetBrains Mono** (500–600 weight) | **Every** numeric value shown to the user — money, counts, dates-as-numbers. Never render a number in the body font. |

Load all three via Google Fonts (or self-hosted equivalents):
`Space+Grotesk:wght@600;700`, `Inter:wght@400;500;600;700`,
`JetBrains+Mono:wght@500;600`.

## The scale

Sizes are in `px`. Don't rely on the framework's theme-level default font
size (e.g. MUI's `typography.fontSize`) — set an explicit size per element
using the roles below, the same way every component in the reference apps
does.

| Role | Size | Weight | Example |
|---|---|---|---|
| **Page title** (top of each screen) | **28px** | 700, Space Grotesk | "Family", "Analytics", "Settings" |
| **App-bar / top-bar title** | **18px** | 700, Space Grotesk | Persistent header title next to the menu button |
| **Greeting / hero heading** (Dashboard-style) | **30px** | 700, Space Grotesk | "Good morning" |
| **Login / splash title** | **26px** | 700, Space Grotesk | |
| **Section header** (e.g. member name atop a detail page) | **22px** | 700, Space Grotesk | |
| **Card/list-item title** (a name, a group header) | **15–15.5px** | 600–700, Inter | Member name in a list row, group header in a collapsible section |
| **Headline stat value** (the single most important number on a card) | **22–24px** | 600, JetBrains Mono | The dashboard's main "Invested"-style figure |
| **Secondary stat value** (2-3 supporting numbers alongside a headline, or a card's primary number when it's not the page's single hero figure) | **17–19px** | 600, JetBrains Mono | Row of 3 stats (Invested / Withdrawn / Interest), a deposit's outstanding amount |
| **List-row value** (money/amount in a flat list row) | **14.5–15px** | 600, JetBrains Mono | A withdrawal row's amount, a "Ready to collect" total |
| **Body text** | **13.5–14px** | 400–500, Inter | Descriptive sentences, dialog copy |
| **Secondary label** (a field's caption, e.g. "Invested" above its value) | **12–12.5px** | 400–500, Inter, `text.secondary` color | |
| **Small/tertiary label** ("Not due yet", timestamps, counts) | **11–12px** | 400, Inter, `text.secondary` color | |
| **Micro label** (rarely — smallest text on screen) | **10.5–11.5px** | 400, Inter, `text.secondary` color | |
| **Button text** | **12–12.5px** (small buttons), **14–15px** (full-width primary CTAs, often just inherit the framework default) | 700, Inter, no text-transform | |

## Principles

1. **Every number is monospace.** Money, counts, percentages — anything
   numeric — uses the mono font, even inline in a sentence. This is what
   gives the "ledger/receipt" feel.
2. **One hero number per screen/card.** Don't make every stat the same
   size — the single most important figure on a card should be
   noticeably bigger (22-24px) than the 2-3 supporting figures next to it
   (17-19px). Flat hierarchies (everything the same size) read as
   cluttered and "smaller" even when the average size is similar.
3. **Titles are big.** Page titles (28px) and hero headings (30px) should
   dominate — don't cap them down to save space. This is usually the
   single biggest lever for making an app feel "right-sized" vs cramped.
4. **Secondary labels stay small and muted.** Field captions and
   timestamps sit at 11-12.5px in the theme's secondary text color —
   contrast against the bigger value/title text is what creates
   hierarchy, not making everything medium-sized.
5. **Wrap, don't clip.** For a headline value inside a fixed-width card
   (e.g. a carousel card), don't add `noWrap`/ellipsis — let long numbers
   wrap to a second line rather than overflow the card's edge.
6. **Don't override the framework's base font size globally.** Set size
   explicitly per element/role using the table above, rather than
   changing a theme-wide default (which is fragile and doesn't give you
   per-role control anyway).
