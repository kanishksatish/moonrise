import { useEffect, useState } from 'react'
import { loadComfortPhoto } from '../engine/comfortPhoto.js'

export default function ComfortPhoto({ id, alt = 'Photo selected by the caregiver', className = '' }) {
  const [photo, setPhoto] = useState(null)
  useEffect(() => {
    let disposed = false; let url
    setPhoto(null)
    if (!id) return
    loadComfortPhoto(id).then(blob => {
      if (disposed) return
      if (!blob) { setPhoto({ id, error:true }); return }
      url = URL.createObjectURL(blob); setPhoto({ id, url })
    }).catch(() => { if (!disposed) setPhoto({ id, error:true }) })
    return () => { disposed = true; if (url) URL.revokeObjectURL(url) }
  }, [id])
  if (!id) return null
  if (photo?.id !== id) return <p className="small">Opening your saved photo…</p>
  if (photo.error) return <p className="small">This photo is unavailable on this device. The written story is still here.</p>
  return <img className={`comfort-photo ${className}`} src={photo.url} alt={alt}/>
}
