import { useEffect, useState } from 'react'

// Current time, re-rendering every intervalMs.
export default function useNow(intervalMs = 15000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
