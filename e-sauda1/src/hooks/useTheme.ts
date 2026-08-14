import { useCallback, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

function getInitialTheme(): Theme {
  // Mirrors the inline script in index.html exactly -- that script already set the
  // 'dark' class on <html> before React even mounted (to avoid a flash of the wrong
  // theme), so reading the class back here just syncs this hook's state to what's
  // already visually true, rather than deciding it fresh and risking disagreement.
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

// Single source of truth for theme state, used by ThemeToggle (and anywhere else that
// might want to know/change the theme later). Keeping this as a plain hook rather than
// a Context -- there's only ever one place (the toggle button) reading or writing it
// right now, so a Context would be adding indirection with no current benefit.
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setThemeState((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, toggleTheme }
}
