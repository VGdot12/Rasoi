// The app behaves like a native app: no pinch, double-tap or keyboard zoom.
// The viewport meta tag handles most browsers; Safari on iPhone ignores it, so gestures are blocked here too.

export function disableZoom() {
  const stop = (e: Event) => e.preventDefault()

  // Safari pinch (iOS and macOS trackpads)
  document.addEventListener('gesturestart', stop, { passive: false })
  document.addEventListener('gesturechange', stop, { passive: false })
  document.addEventListener('gestureend', stop, { passive: false })

  // Two-finger pinch on touch screens
  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length > 1) e.preventDefault()
    },
    { passive: false },
  )

  // Double-tap to zoom
  let lastTouch = 0
  document.addEventListener(
    'touchend',
    (e) => {
      const t = Date.now()
      if (t - lastTouch < 300) e.preventDefault()
      lastTouch = t
    },
    { passive: false },
  )

  // Ctrl/Cmd + scroll wheel and trackpad pinch in Chrome, Edge and Firefox
  window.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault()
    },
    { passive: false },
  )

  // Ctrl/Cmd + plus, minus, zero
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && ['+', '=', '-', '_', '0'].includes(e.key)) e.preventDefault()
  })
}
