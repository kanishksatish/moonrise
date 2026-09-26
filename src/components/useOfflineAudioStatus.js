import { useCallback, useEffect, useMemo, useState } from 'react'

const STATUS_TYPE = 'MOONRISE_AUDIO_STATUS'
export const AUDIO_STATUS_TIMEOUT_MS = 2500

function absoluteUrl(src) {
  return new URL(src, window.location.href).href
}

// The worker owns cache knowledge. A loaded player, a completed page load or
// navigator.onLine alone never proves a recording has been saved offline.
export default function useOfflineAudioStatus(recordings) {
  const [snapshot, setSnapshot] = useState(null)
  const [online, setOnline] = useState(() => navigator.onLine !== false)
  const [revision, setRevision] = useState(0)
  const approvedUrls = useMemo(() => new Set(recordings.map(item => absoluteUrl(item.src))), [recordings])

  useEffect(() => {
    const serviceWorker = navigator.serviceWorker
    let cancelled = false
    let closeRequest = () => {}

    function accept(data) {
      if (cancelled || data?.type !== STATUS_TYPE || data.version !== 1
        || !Array.isArray(data.cachedUrls) || !data.cachedUrls.every(url => typeof url === 'string')
        || typeof data.downloading !== 'boolean') return false
      setSnapshot({
        cachedUrls: new Set(data.cachedUrls.filter(url => approvedUrls.has(url))),
        downloading: data.downloading,
      })
      return true
    }

    function query() {
      closeRequest()
      const controller = serviceWorker?.controller
      if (!controller || typeof MessageChannel === 'undefined') {
        setSnapshot(null)
        return
      }
      const channel = new MessageChannel()
      let finished = false
      const timer = setTimeout(() => {
        if (!cancelled && !finished) setSnapshot(null)
        closeRequest()
      }, AUDIO_STATUS_TIMEOUT_MS)
      closeRequest = () => {
        finished = true
        clearTimeout(timer)
        channel.port1.onmessage = null
        channel.port1.close()
        channel.port2.close()
      }
      channel.port1.onmessage = ({ data }) => {
        if (serviceWorker.controller === controller && accept(data)) closeRequest()
      }
      try {
        controller.postMessage({ type: STATUS_TYPE }, [channel.port2])
      } catch {
        closeRequest()
        setSnapshot(null)
      }
    }

    function broadcast(event) {
      // An unrelated registration or an obsolete controller cannot declare the
      // current build ready. Only exact URLs in this catalog are accepted.
      if (event.source !== serviceWorker?.controller || !event.source) return
      if (accept(event.data)) closeRequest()
    }
    function controllerChanged() {
      setSnapshot(null)
      query()
    }
    function connectionChanged() {
      setOnline(navigator.onLine !== false)
      query()
    }
    serviceWorker?.addEventListener('message', broadcast)
    serviceWorker?.addEventListener('controllerchange', controllerChanged)
    window.addEventListener('online', connectionChanged)
    window.addEventListener('offline', connectionChanged)
    query()
    return () => {
      cancelled = true
      closeRequest()
      serviceWorker?.removeEventListener('message', broadcast)
      serviceWorker?.removeEventListener('controllerchange', controllerChanged)
      window.removeEventListener('online', connectionChanged)
      window.removeEventListener('offline', connectionChanged)
    }
  }, [approvedUrls, revision])

  const requestDownload = useCallback(() => {
    if (navigator.onLine === false) return
    try {
      navigator.serviceWorker?.controller?.postMessage({ type: 'MOONRISE_DOWNLOAD_AUDIO' })
    } catch { /* An old worker can remain usable without this optional protocol. */ }
    setRevision(value => value + 1)
  }, [])

  function statusFor(src) {
    if (!snapshot) return 'unknown'
    return snapshot.cachedUrls.has(absoluteUrl(src)) ? 'ready' : 'missing'
  }

  return {
    online, statusFor, requestDownload,
    known: Boolean(snapshot),
    readyCount: snapshot?.cachedUrls.size ?? 0,
    downloading: snapshot?.downloading ?? false,
  }
}
