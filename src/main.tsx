import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'

import App from '@/App.tsx'
import { initFontScale } from '@/lib/font-scale'
import { initTheme } from '@/lib/theme'
import '@/index.css'

initTheme()
initFontScale()

if (import.meta.env.PROD) {
  registerSW({
    immediate: true,
    onNeedRefresh() {
      // Keep the current screen. The next cold open picks up the new shell.
    },
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
