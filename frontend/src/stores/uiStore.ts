import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'light' | 'dark' | 'auto'

interface UIState {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const prefersDark = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches

/** Resolves 'auto' against the OS preference and stamps the class <html>. */
export function applyTheme(theme: Theme): void {
  const dark = theme === 'dark' || (theme === 'auto' && prefersDark())
  document.documentElement.classList.toggle('dark', dark)
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'auto',
      setTheme: (theme) => {
        applyTheme(theme)
        set({ theme })
      },
    }),
    {
      name: 'sgt-ui',
      partialize: (state) => ({ theme: state.theme }),
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme)
      },
    }
  )
)

/**
 * Keeps 'auto' honest: when the OS flips between light and dark, re-resolve.
 * Only meaningful while theme === 'auto'; explicit choices ignore the event.
 */
export function watchSystemTheme(): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {}
  }
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const onChange = (): void => {
    if (useUIStore.getState().theme === 'auto') applyTheme('auto')
  }
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}
