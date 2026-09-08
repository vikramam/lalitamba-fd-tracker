export type Theme = 'dark' | 'light'

const KEY = 'lalitamba.theme'

export function readTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('light', theme === 'light')
  const color = theme === 'light' ? '#fafafa' : '#09090b'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    /* ignore */
  }
}

export function initTheme() {
  applyTheme(readTheme())
}
