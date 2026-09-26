// Registers public/sw.js in production builds only, so the dev server never serves cached files.
// The worker caches the app shell for offline use; see public/sw.js for what it does and doesn't cache.
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  const serviceWorker = navigator.serviceWorker
  const base = import.meta.env.BASE_URL
  let registration
  let registering = false
  let disposed = false

  function downloadAudio() {
    if (disposed || navigator.onLine === false) return
    const worker = serviceWorker.controller || registration?.active
    try { worker?.postMessage({ type: 'MOONRISE_DOWNLOAD_AUDIO' }) } catch { /* Keep the page usable. */ }
  }
  function register() {
    if (disposed || registering) return
    registering = true
    serviceWorker.register(`${base}sw.js`, { scope: base }).then(registered => {
      registration = registered
      // Registration may resolve while the core shell is still installing.
      // Optional recordings start only after an active worker is ready.
      // Do not keep registration attempts locked behind ready: a failed first
      // installation may never resolve it, but reconnecting must still retry.
      serviceWorker.ready.then(ready => {
        registration = ready
        downloadAudio()
      }).catch(() => {})
    }).catch(() => {
      // The online page still works; a later connection can retry installation.
    }).finally(() => { registering = false })
  }
  function online() {
    if (serviceWorker.controller || registration?.active) downloadAudio()
    else register()
  }
  serviceWorker.addEventListener('controllerchange', downloadAudio)
  window.addEventListener('online', online)
  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
  return () => {
    disposed = true
    serviceWorker.removeEventListener('controllerchange', downloadAudio)
    window.removeEventListener('online', online)
    window.removeEventListener('load', register)
  }
}
