export const FONT_SCALES = [0.9, 1, 1.15, 1.3] as const

export type FontScale = (typeof FONT_SCALES)[number]

const KEY = 'lalitamba.fontScale'

const LABELS: Record<FontScale, string> = {
  0.9: 'Small',
  1: 'Default',
  1.15: 'Large',
  1.3: 'Extra large',
}

export function fontScaleLabel(scale: FontScale) {
  return LABELS[scale]
}

export function readFontScale(): FontScale {
  try {
    const stored = Number(localStorage.getItem(KEY))
    return FONT_SCALES.includes(stored as FontScale) ? (stored as FontScale) : 1
  } catch {
    return 1
  }
}

export function applyFontScale(scale: FontScale) {
  document.documentElement.style.zoom = String(scale)
  document.documentElement.dataset.fontScale = String(scale)
  try {
    localStorage.setItem(KEY, String(scale))
  } catch {
    /* ignore */
  }
}

export function stepFontScale(scale: FontScale, delta: -1 | 1): FontScale {
  const index = FONT_SCALES.indexOf(scale)
  return FONT_SCALES[Math.min(FONT_SCALES.length - 1, Math.max(0, index + delta))]
}

export function initFontScale() {
  applyFontScale(readFontScale())
}
