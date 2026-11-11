import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'

// React Router keeps the previous scroll position when the route changes, so
// clicking a link from the bottom of one page used to land you at the bottom of
// the next one. This resets to the top on every navigation (or scrolls to the
// #anchor when the URL has one). `behavior: 'instant'` overrides the global
// `scroll-behavior: smooth` so the jump happens immediately.
export default function ScrollToTop() {
  const { pathname, hash } = useLocation()

  useLayoutEffect(() => {
    if (hash) {
      const el = document.getElementById(decodeURIComponent(hash.slice(1)))
      if (el) {
        el.scrollIntoView()
        return
      }
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname, hash])

  return null
}
