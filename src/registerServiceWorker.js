// Registers public/sw.js in production builds only, so the dev server never serves cached files.
// The worker caches the app shell for offline use; see public/sw.js for what it does and doesn't cache.
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {
      // Offline support is a bonus; the app works without it.
    })
  })
}
