// Fetch JSON with a hard timeout. The request is aborted and the promise rejects if either
// the response or its body takes longer than timeoutMs, so a bad connection can never leave
// a screen waiting forever.

export const DEFAULT_TIMEOUT_MS = 8000

export async function fetchJson(url, { fetchFn = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController()
  let timer

  async function request() {
    const res = await fetchFn(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
    return res.json()
  }

  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new Error(`Timed out after ${timeoutMs} ms: ${url}`))
    }, timeoutMs)
  })

  try {
    return await Promise.race([request(), timeout])
  } finally {
    clearTimeout(timer)
  }
}
